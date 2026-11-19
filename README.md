# IceBerg

AI-hírportál vizuális alkotóknak: ComfyUI, 3D (Blender, Cinema 4D), Claude, valamint AI-s pályázatok és fesztiválok. Az oldal naponta kétszer, 6:00-kor és 18:00-kor (magyar idő) frissül magától.

## Hogyan működik

- **Az oldal** (`index.html`, `app.js`, `assets/`) GitHub Pagesen fut, és a `data/` mappából tölti be a cikkeket.
- **A frissítő program** (`scripts/update.py`) GitHub Actionsben fut (`.github/workflows/update.yml`):
  1. végignézi a `config/sources.json`-ban felsorolt YouTube-csatornákat és blogokat;
  2. a Claude API (Haiku) kiválogatja a témába vágó anyagot, besorolja, címkézi, és magyar leadet ír;
  3. reggelente Claude webes kereséssel új, nyitott pályázatokat keres;
  4. elmenti az adatokat, és újra kiteszi az oldalt.
- Kategóriánként a 8 legfrissebb cikk látszik, a többi és a lejárt pályázatok az archívumba kerülnek.
- A képeket nem tárolja, csak hivatkozik rájuk; így a tároló mérete évekig kicsi marad.

## Beállítás (egyszer)

1. **Settings → Pages → Build and deployment → Source:** „GitHub Actions”.
2. **Settings → Secrets and variables → Actions → New repository secret:** név `ANTHROPIC_API_KEY`, érték a console.anthropic.com-on létrehozott kulcs. Kulcs nélkül is fut, de akkor csak kulcsszavak alapján válogat, magyar lead és pályázatkeresés nélkül.
3. **Actions → IceBerg frissítés → Run workflow:** azonnali próbafrissítés.

## Források módosítása

A `config/sources.json` fájlban lehet YouTube-csatornát (`@név`) vagy RSS-forrást hozzáadni, törölni. A `"filter": true` azt jelenti, hogy arról a forrásról csak a témába vágó anyag kerül be.

## Költség

A tárhely és a GitHub Actions ingyenes. A Claude API díja napi két futással várhatóan havi néhány dollár (Haiku, illetve reggelente legfeljebb 6 webes keresés).
