#!/usr/bin/env python3
"""IceBerg frissítő: naponta kétszer (6:00 és 18:00, magyar idő) összegyűjti az új anyagot.

- YouTube-csatornák RSS-e és szakmai blogok RSS-e
- Claude (Haiku) válogat, kategorizál, címkéz és magyar leadet ír
- kétnaponta reggel Claude webes kereséssel új, nyitott pályázatokat keres
Csak a Python standard könyvtárát használja. Az API-kulcs az ANTHROPIC_API_KEY környezeti változóból jön.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TZ = ZoneInfo("Europe/Budapest")
NOW = dt.datetime.now(dt.timezone.utc)
LOCAL = NOW.astimezone(TZ)
TODAY = LOCAL.date()
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
FORCE = os.environ.get("FORCE", "").lower() in ("1", "true", "yes")
MODEL = os.environ.get("ICEBERG_MODEL", "claude-haiku-5-5")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 IceBergBot/1.0"
CATS = ("3d", "claude", "comfy")
RESEARCH_EVERY_DAYS = 2  # a pályázatkeresés ennyi naponta fut (reggel)
LOG = []


def log(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


def path(*p):
    return os.path.join(ROOT, *p)


def load(p, default):
    try:
        with open(path(p), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save(p, data):
    tmp = path(p) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, path(p))


def get(url, timeout=25, tries=2, headers=None):
    h = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8", "Cookie": "CONSENT=YES+1; SOCS=CAI"}
    h.update(headers or {})
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


# ---------------------------------------------------------------- időzítés
def slot_now(state):
    """Melyik futás jön: 'morning' (5–7 óra) vagy 'evening' (17–19 óra); None, ha most nem kell futni."""
    h = LOCAL.hour
    slot = "morning" if 4 <= h <= 7 else "evening" if 16 <= h <= 19 else None
    if FORCE:
        return slot or ("morning" if h < 12 else "evening")
    if slot and state.get("last_" + slot) == TODAY.isoformat():
        return None
    return slot


# ---------------------------------------------------------------- YouTube
CH_RE = re.compile(r'"(?:externalId|channelId|browseId)":"(UC[\w-]{22})"')


def resolve_channels(cfg):
    cache = load("config/channels.json", {})
    keys = [("h:" + x["handle"], x) for x in cfg["youtube_handles"]] + [("v:" + v, {"filter": True}) for v in cfg["youtube_seed_videos"]]
    out = {}
    for key, meta in keys:
        cid = cache.get(key)
        if not cid:
            url = "https://www.youtube.com/" + key[2:] if key.startswith("h:") else "https://www.youtube.com/watch?v=" + key[2:]
            try:
                m = CH_RE.search(get(url))
                cid = m.group(1) if m else None
            except Exception as e:  # noqa: BLE001
                log("  ! csatorna nem található:", key, e)
            if cid:
                cache[key] = cid
        if cid:
            out[cid] = out.get(cid, False) or (not meta.get("filter", True))  # True = nem kell szűrni
    save("config/channels.json", cache)
    return out  # {channel_id: trusted}


NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "m": "http://search.yahoo.com/mrss/"}


def youtube_items(cid, trusted):
    for feed in ("https://www.youtube.com/feeds/videos.xml?playlist_id=UULF" + cid[2:],
                 "https://www.youtube.com/feeds/videos.xml?channel_id=" + cid):
        try:
            root = ET.fromstring(get(feed))
            break
        except Exception:  # noqa: BLE001
            root = None
    if root is None:
        log("  ! YouTube feed hiba:", cid)
        return []
    res = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", "", NS)
        title = e.findtext("a:title", "", NS).strip()
        if not vid or "#shorts" in title.lower():
            continue
        pub = dt.datetime.fromisoformat(e.findtext("a:published", "", NS).replace("Z", "+00:00"))
        res.append({
            "id": "yt-" + vid, "yt": vid, "url": "https://www.youtube.com/watch?v=" + vid,
            "title": html.unescape(title), "published": pub,
            "src": "YouTube · " + (e.findtext("a:author/a:name", "", NS) or "").strip(),
            "desc": (e.findtext("m:group/m:description", "", NS) or "")[:700], "trusted": trusted,
        })
    return res


# ---------------------------------------------------------------- blogok
IMG_RE = re.compile(r'<img[^>]+src="(https://[^"]+)"', re.I)
OG_RE = re.compile(r'<meta[^>]+(?:property|name)="(?:og:image|twitter:image)"[^>]+content="(https://[^"]+)"', re.I)
OG_RE2 = re.compile(r'<meta[^>]+content="(https://[^"]+)"[^>]+(?:property|name)="(?:og:image|twitter:image)"', re.I)


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        pass
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(s)
    except (TypeError, ValueError):
        return None


def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def rss_items(src):
    try:
        root = ET.fromstring(get(src["url"]))
    except Exception as e:  # noqa: BLE001
        log("  ! RSS hiba:", src["name"], e)
        return []
    res = []
    entries = root.findall(".//item") or root.findall("a:entry", NS)
    for it in entries[:20]:
        title = (it.findtext("title") or it.findtext("a:title", "", NS) or "").strip()
        link = it.findtext("link") or ""
        if not link:
            l = it.find("a:link", NS)
            link = l.get("href") if l is not None else ""
        pub = parse_date(it.findtext("pubDate") or it.findtext("a:published", "", NS) or it.findtext("a:updated", "", NS))
        body = it.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or it.findtext("description") or it.findtext("a:summary", "", NS) or ""
        img = None
        for tag in ("{http://search.yahoo.com/mrss/}content", "{http://search.yahoo.com/mrss/}thumbnail", "enclosure"):
            el = it.find(tag)
            if el is not None and (el.get("url") or "").startswith("https://") and (tag != "enclosure" or "image" in (el.get("type") or "")):
                img = el.get("url")
                break
        if not img:
            m = IMG_RE.search(body)
            img = m.group(1) if m else None
        if not title or not link.startswith("http") or not pub:
            continue
        res.append({"id": "rss-" + re.sub(r"[^a-z0-9]+", "-", link.lower().split("//", 1)[-1])[:90].strip("-"),
                    "url": link.strip(), "title": html.unescape(title), "published": pub, "src": src["name"],
                    "desc": strip_tags(body)[:700], "img": img, "trusted": not src.get("filter", True)})
    return res


def og_image(url):
    try:
        page = get(url, timeout=15, tries=1)[:200000]
        m = OG_RE.search(page) or OG_RE2.search(page)
        return html.unescape(m.group(1)) if m else None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- Claude
def claude(prompt, max_tokens=4000, web_search=0):
    body = {"model": MODEL, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    if web_search:
        body["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": web_search}]
    text = []
    for _ in range(4):
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(),
                                     headers={"x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                res = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Claude API {e.code}: {e.read()[:300]!r}") from e
        text += [b.get("text", "") for b in res.get("content", []) if b.get("type") == "text"]
        if res.get("stop_reason") != "pause_turn":
            break
        body["messages"] = body["messages"][:1] + [{"role": "assistant", "content": res["content"]}]
    return "".join(text)


def json_array(txt):
    a, b = txt.find("["), txt.rfind("]")
    if a >= 0 and b > a:
        try:
            v = json.loads(txt[a:b + 1])
            if isinstance(v, list):
                return v
        except json.JSONDecodeError:
            pass
    # félbevágott vagy hibás válasz: a hiánytalan objektumokat egyenként mentjük meg
    out = []
    for m in re.finditer(r"\{[^{}]*\}", txt[a if a >= 0 else 0:]):
        try:
            out.append(json.loads(m.group(0)))
        except json.JSONDecodeError:
            pass
    return out


AI_RE = re.compile(r"\b(ai|a\.i\.|mcp|comfy\w*|claude|anthropic|generative|genai|diffusion|neural|llm|gpt|gemini|runway|kling|veo|sora|seedance|minimax|hailuo|ltx|wan ?2|flux|hunyuan|moss|h3)\b", re.I)


def kw_cat(t):
    t = t.lower()
    if re.search(r"claude|anthropic", t):
        return "claude"
    if "comfy" in t:
        return "comfy"
    if re.search(r"blender|cinema ?4d|\bc4d\b|houdini|\b3d\b|gaussian splat|unreal engine", t):
        return "3d"
    return None


def kw_tags(t, vocab):
    t = t.lower()
    alias = {"comfyui": "comfy", "cinema4d": r"cinema ?4d|\bc4d\b", "ai-film": r"\bai film|filmmak|short film", "video": r"\bvideo", "skill": r"\bskills?\b", "motion": r"motion graphic|motion design", "3d": r"\b3d\b", "h3": r"\bh3\b", "moss": r"\bmoss\b"}
    return [g for g in vocab if re.search(alias.get(g, re.escape(g)), t)][:4]


def classify(cands, cfg):
    vocab = cfg["tags"]
    if not API_KEY:
        out = []
        for c in cands:
            text = c["title"] + " " + c["desc"]
            cat = kw_cat(text) or ("comfy" if c["trusted"] and "comfy" in (c["src"] + c["url"]).lower() else None)
            if not cat or (not c["trusted"] and not AI_RE.search(text)):
                continue
            out.append(dict(c, cat=cat, tags=kw_tags(text, vocab) or [cat], lead=""))
        return out
    out = []
    for i in range(0, len(cands), 10):
        chunk = cands[i:i + 10]
        listing = "\n".join(f'{n}. FORRÁS: {c["src"]} | CÍM: {c["title"]} | LEÍRÁS: {c["desc"][:500]}' for n, c in enumerate(chunk))
        prompt = f"""Egy magyar AI-hírportál (IceBerg) szerkesztője vagy. Az olvasót ez érdekli: {cfg["topics"]}

Döntsd el minden tételről, hogy bekerüljön-e. Csak az kerüljön be, ami tényleg a fenti témákról szól és hasznos egy AI-val dolgozó vizuális alkotónak (VFX, 3D, AI film, motion design). Reklám, általános tech-hír, tisztán kódolás: ne.
Kategóriák: "comfy" (ComfyUI, képgenerálás, workflow-k, nyílt modellek), "3d" (Blender, Cinema 4D, 3D, VFX eszközök), "claude" (Claude/Anthropic, illetve AI film és motion design általában, ha nem ComfyUI-s és nem 3D-s).
Címkék csak ebből a listából: {", ".join(vocab)} (1–4 darab).
Lead: 1–2 mondat magyarul, legfeljebb 220 karakter, tárgyilagos, csak a megadott címre és leírásra támaszkodj, ne találj ki részleteket, ne használj felkiáltójelet.

Válaszolj KIZÁRÓLAG egy JSON tömbbel, minden tételhez egy objektummal:
[{{"n": 0, "keep": true, "cat": "comfy", "tags": ["comfyui"], "lead": "..."}}]

Tételek:
{listing}"""
        try:
            res = json_array(claude(prompt, max_tokens=6000))
        except Exception as e:  # noqa: BLE001
            log("  ! Claude hiba, kulcsszavas besorolás:", e)
            res = []
        done = {int(r["n"]) for r in res if isinstance(r, dict) and str(r.get("n", "")).isdigit()}
        missing = [c for n, c in enumerate(chunk) if n not in done]
        if missing:
            log(f"  ! {len(missing)} tételre nem jött értékelhető válasz, kulcsszavas besorolás (később újra próbálja)")
            out += [dict(x, kwfb=True) for x in classify_fallback(missing, vocab)]
        for r in res:
            try:
                c = chunk[int(r["n"])]
            except (KeyError, ValueError, IndexError, TypeError):
                continue
            if not r.get("keep") or r.get("cat") not in CATS:
                continue
            tags = [t for t in (r.get("tags") or []) if t in vocab][:4] or [r["cat"] if r["cat"] != "comfy" else "comfyui"]
            lead = re.sub(r"\s+", " ", str(r.get("lead") or "")).strip()[:260]
            out.append(dict(c, cat=r["cat"], tags=tags, lead=lead))
    return out


def classify_fallback(chunk, vocab):
    global API_KEY
    k, API_KEY = API_KEY, ""
    try:
        return classify(chunk, {"tags": vocab, "topics": ""})
    finally:
        API_KEY = k


# ---------------------------------------------------------------- pályázatok
CONTEST_TAGS = ["ai-film", "animáció", "kép", "fesztivál", "pénzdíj", "kredit", "gpu", "hardver", "comfyui", "blender", "vfx", "motion", "magyar", "h3"]


def norm_url(u):
    p = urllib.parse.urlsplit(u.strip().lower())
    return (p.netloc.removeprefix("www.") + p.path.rstrip("/"))


def research_contests(contests):
    known = "\n".join(f'- {c["title"]} ({c["url"]})' for c in contests["items"] if c.get("deadline", "") >= TODAY.isoformat())
    prompt = f"""Ma {TODAY.isoformat()} van. Keress a weben olyan most NYITOTT pályázatokat, versenyeket, challenge-eket és fesztiválokat, amelyekre AI-val készült kép, videó, animáció, film, 3D vagy ComfyUI workflow nevezhető, és amelyekre Magyarországról is lehet nevezni (világszerte nyitott vagy EU-s). Különösen érdekesek: videókártya/hardver-díjak, kredit-díjak, pénzdíjak, AI filmfesztiválok, ComfyUI/Comfy Org challenge-ek, magyar lehetőségek.

Csak olyat adj vissza, aminek a nevezési határideje {(TODAY + dt.timedelta(days=2)).isoformat()} vagy későbbi, és a határidőt a hivatalos oldal vagy megbízható forrás megerősíti. Ne adj vissza olyat, ami már szerepel itt:
{known or "- (még nincs)"}

Válaszolj KIZÁRÓLAG JSON tömbbel (legfeljebb 8 elem, ha nincs új, akkor []):
[{{"title": "...", "organizer": "...", "url": "hivatalos https link", "deadline": "YYYY-MM-DD", "elig": "ok | check | hu", "fee": "ingyenes | összeg | nincs megadva", "tags": ["..."], "lead": "1–2 mondat magyarul: mit kell beadni és mi a díj (max 260 karakter)"}}]
elig: "ok" = a forrás szerint világszerte/Magyarországról is nevezhető; "hu" = magyar pályázat; "check" = nem egyértelmű.
tags csak ebből: {", ".join(CONTEST_TAGS)}"""
    try:
        found = json_array(claude(prompt, max_tokens=6000, web_search=6))
    except Exception as e:  # noqa: BLE001
        log("  ! pályázatkeresés hiba:", e)
        return 0
    have = {norm_url(c["url"]) for c in contests["items"]} | {c["title"].strip().lower() for c in contests["items"]}
    added = 0
    for f in found:
        try:
            title, url, dl = str(f["title"]).strip(), str(f["url"]).strip(), str(f["deadline"]).strip()
            dt.date.fromisoformat(dl)
        except (KeyError, ValueError, TypeError):
            continue
        if not url.startswith("https://") or dl < (TODAY + dt.timedelta(days=2)).isoformat() or norm_url(url) in have or title.lower() in have:
            continue
        contests["items"].append({
            "id": "c-" + re.sub(r"[^a-z0-9]+", "-", norm_url(url))[:80].strip("-"), "cat": "palyazat", "title": title[:140],
            "date": TODAY.isoformat(), "src": str(f.get("organizer") or "")[:80], "url": url, "deadline": dl,
            "elig": f.get("elig") if f.get("elig") in ("ok", "check", "hu") else "check",
            "fee": str(f.get("fee") or "nincs megadva")[:40],
            "tags": [t for t in (f.get("tags") or []) if t in CONTEST_TAGS][:4],
            "lead": re.sub(r"\s+", " ", str(f.get("lead") or "")).strip()[:300], "first_seen": NOW.isoformat(timespec="seconds"),
        })
        have |= {norm_url(url), title.lower()}
        added += 1
    return added


# ---------------------------------------------------------------- fő
def main():
    cfg = load("config/sources.json", {})
    items = load("data/items.json", {"items": []})
    contests = load("data/contests.json", {"items": []})
    slot = slot_now(items)
    if not slot:
        log(f"Most nincs teendő ({LOCAL:%H:%M}, ez a futás már megvolt vagy nincs ütemezve).")
        return False
    log(f"IceBerg frissítés: {LOCAL:%Y-%m-%d %H:%M} ({slot}), Claude: {'igen' if API_KEY else 'NINCS KULCS, kulcsszavas mód'}")

    if API_KEY:  # a kulcs nélkül, kulcsszavasan felvett tételeket most újra feldolgozzuk Claude-dal
        dropped = sum(1 for x in items["items"] if x.get("kw"))
        items["items"] = [x for x in items["items"] if not x.get("kw")]
        if dropped:
            log(f"Kulcsszavas tételek újrafeldolgozása: {dropped}")
    seen = {x["id"] for x in items["items"]}
    cutoff = NOW - dt.timedelta(days=cfg.get("max_age_days", 14))
    cands = []
    for cid, trusted in resolve_channels(cfg).items():
        cands += youtube_items(cid, trusted)
    for src in cfg.get("rss", []):
        cands += rss_items(src)
    uniq = {}
    for c in cands:
        if c["id"] not in seen and c["published"] >= cutoff:
            uniq[c["id"]] = c
    cands = sorted(uniq.values(), key=lambda c: c["published"], reverse=True)[:80]
    log(f"Új jelölt: {len(cands)}")

    new = classify(cands, cfg) if cands else []
    for n in new:
        if not n.get("yt") and not n.get("img"):
            n["img"] = og_image(n["url"])
        rec = {"id": n["id"], "cat": n["cat"], "title": n["title"][:200], "date": n["published"].astimezone(TZ).date().isoformat(),
               "src": n["src"][:80], "url": n["url"], "tags": n["tags"], "lead": n.get("lead", ""), "first_seen": NOW.isoformat(timespec="seconds")}
        if n.get("yt"):
            rec["yt"] = n["yt"]
        if n.get("img"):
            rec["img"] = n["img"]
        if not API_KEY or n.get("kwfb"):
            rec["kw"] = True
        items["items"].append(rec)
    items["items"].sort(key=lambda x: (x["date"], x.get("first_seen", "")), reverse=True)
    items["items"] = items["items"][:3000]
    log(f"Bekerült: {len(new)} cikk " + str({c: sum(1 for n in new if n['cat'] == c) for c in CATS}))

    added = 0
    last = contests.get("last_research") or "2000-01-01"
    due = (TODAY - dt.date.fromisoformat(last)).days >= RESEARCH_EVERY_DAYS
    if API_KEY and ((slot == "morning" and due) or os.environ.get("RESEARCH", "").lower() == "true"):
        added = research_contests(contests)
        contests["last_research"] = TODAY.isoformat()
        log(f"Új pályázat: {added}")
    keep_from = (TODAY - dt.timedelta(days=365)).isoformat()
    contests["items"] = [c for c in contests["items"] if c.get("deadline", "9999") >= keep_from][:500]

    stamp = NOW.isoformat(timespec="seconds")
    items["updated"] = stamp
    items["last_" + slot] = TODAY.isoformat()
    contests["updated"] = stamp
    save("data/items.json", items)
    save("data/contests.json", contests)
    return True


if __name__ == "__main__":
    changed = main()
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("## IceBerg frissítés\n\n" + "\n".join("- " + l for l in LOG) + "\n")
    sys.exit(0)
