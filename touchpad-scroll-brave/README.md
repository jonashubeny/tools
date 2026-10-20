# Pomalejší touchpad (rozšíření pro Brave)

Zpomalí scrollování touchpadem v prohlížeči Brave a kolečko myši nechá na
výchozí rychlosti. Ostatních aplikací ani nastavení GNOME se nedotkne.

Rozšíření je pro Manifest V3, nemá žádné externí závislosti a nic neposílá ven.
Oprávnění: `storage` pro nastavení a `activeTab` pro tlačítko „Vypnout na tomto webu“.

## Instalace

1. Otevři `brave://extensions`.
2. Vpravo nahoře zapni **Vývojářský režim**.
3. Klikni na **Načíst rozbalené** a vyber složku `touchpad-scroll-brave/`
   (tu, ve které je `manifest.json`).
4. Ikonu rozšíření si můžeš připnout přes ikonu puzzle v liště.

Už otevřené karty je potřeba obnovit (F5), teprve pak se do nich rozšíření načte.
Po úpravě kódu klikni v `brave://extensions` u rozšíření na šipku pro opětovné
načtení a karty znovu obnov.

**Brave z Flatpaku** vidí jen část domovské složky. Pokud v dialogu složku
nevidíš nebo ji nejde načíst, zkopíruj ji do `~/Downloads`, nebo Brave povol
přístup jen ke čtení:

```sh
flatpak override --user --filesystem=~/PROJEKTY/tools/touchpad-scroll-brave:ro com.brave.Browser
```

## Nastavení

Klikni na ikonu rozšíření. Stejné nastavení je i na stránce rozšíření
v `brave://extensions` → Podrobnosti → Možnosti rozšíření.

| Volba | Význam |
| --- | --- |
| **Zapnuto** | Hlavní vypínač. |
| **Rychlost touchpadu** | Násobek rychlosti, od 0.1 do 1.0, výchozí 0.5. Hodnota 1.0 znamená beze změny. |
| **Vypnout na *web*** | Přidá aktuální web do vyjmutých domén, nebo ho z nich odebere. |
| **Vyjmuté domény** | Jedna na řádek. `google.com` platí i pro `maps.google.com`. Vložit jde i celá URL. |
| **Debug režim** | Loguje každou wheel událost do konzole stránky (viz níže). |
| **Pokročilé** | Parametry detekce, viz [Kalibrace](#kalibrace). |

Nastavení se ukládá přes `chrome.storage.sync`. Pokud máš zapnutou
synchronizaci Brave, přenese se i na další zařízení. Změny se projeví hned,
stránku není potřeba obnovovat.

## Debug režim

1. V popupu zapni **Debug režim**.
2. Na libovolné stránce otevři konzoli (F12 → Console).
3. Scrolluj a sleduj řádky začínající `[touchpad-scroll]`:

```
[touchpad-scroll] touchpad (irregular) deltaY=4.25 wheelDeltaY=-4 deltaX=0 wheelDeltaX=0 deltaMode=0 dt=-ms NOVÝ-PROUD → zpomaleno ×0.5 → root
[touchpad-scroll] touchpad (proud) deltaY=7.50 wheelDeltaY=-8 deltaX=0.50 wheelDeltaX=-1 deltaMode=0 dt=12ms → zpomaleno ×0.5 → root
[touchpad-scroll] mouse    (notch) deltaY=120 wheelDeltaY=-120 deltaX=0 wheelDeltaX=0 deltaMode=0 dt=1012ms NOVÝ-PROUD → nativní (myš)
```

- **zařízení a v závorce důvod**: druh události (`notch`, `hires`,
  `irregular`, `two-axis`, `tiny`, `line`) nebo `proud` (verdikt převzatý
  z dřívější události stejného gesta), případně `hlasy n/m`.
- **deltaY, wheelDeltaY, deltaX, wheelDeltaX, deltaMode**: surové hodnoty z události.
- **dt**: odstup od předchozí události v ms.
- **NOVÝ-PROUD**: začátek nového gesta. Na jeho první události se rozhoduje nejvíc.
- **necancelable**: prohlížeč nedovolil událost zrušit, proto ji zpomalit nejde.
- **→ akce**: co rozšíření udělalo. Možnosti jsou `zpomaleno … → cíl`,
  `nativní (myš)`, `nativní (canvas)`, `stránka si scroll řeší sama`,
  `nativní (v tomto rámci není co scrollovat)` a `zablokováno (overscroll-behavior)`.

Události s Ctrl, tedy zoom a pinch na touchpadu, se nelogují. Rozšíření je úplně ignoruje.

Až budeš hotový, debug režim vypni. Logování každé události stránky zpomaluje.

## Jak detekce funguje

Vlastnost `wheelDeltaY` počítá Chromium jako počet tiků kolečka × 120, a to
nezávisle na zoomu stránky. Z ní se pozná:

| Hodnoty | Zařízení |
| --- | --- |
| `deltaMode` ≠ 0 (řádky/stránky) | myš |
| násobek 120 v jedné ose | klasické kolečko |
| násobek 15 (nebo 30, 45…) v jedné ose | high-res kolečko, výjimečně náhoda u touchpadu |
| obě osy najednou | touchpad |
| jiná čísla (4, 7, 13…) | touchpad |
| `deltaY` ≠ 0, ale `wheelDeltaY` = 0 | touchpad (drobky na konci dojezdu) |

**Proč se rozhoduje hned na první události gesta:** Chromium dovolí zrušit
(`preventDefault`) jen první wheel událost scroll sekvence. Pokud ji nikdo
nezruší, zbytek gesta posílá jako necancelable a zpomalit ho už nejde. Detektor
proto u každého gesta rozhodne hned a k tomu využívá dvě pojistky:

- **Okno posledních událostí:** když gesto začne jako myš, ale v okně se objeví
  aspoň 2 „touchpadové“ události, přepne se na touchpad. Pomůže to, pokud
  prohlížeč nechá události zrušitelné. Pokud ne, uvidíš v logu `necancelable`.
- **Paměť:** nejednoznačný začátek gesta (např. hodnota 30) se do 5 s po
  použití touchpadu bere jako touchpad. Pokud se pak ukáže, že jde o high-res
  myš (2 pravidelné události za sebou), detektor se přepne zpět na myš.
- Gesto rozpoznané jako touchpad zůstane touchpadem až do konce, včetně
  dojezdu, ve kterém může náhodou padnout i „pravidelná“ hodnota.

**Scrollování:** rozšíření najde nejbližšího předka cíle, který umí scrollovat
ve směru gesta (`overflow: auto/scroll` a ještě nedojel na konec). Prochází při
tom i shadow DOM. Scroller, který je na konci, přeskočí a pokračuje k rodiči až
po dokument, stejně jako nativní řetězení scrollu. `overscroll-behavior:
contain/none` řetězení zastaví. Cíl se vybere na začátku gesta a drží se, jako
to dělá prohlížeč. Posun se sčítá a provede jednou za snímek
(`requestAnimationFrame`) s `behavior: 'instant'`. Zbytky menší než fyzický
pixel se přenáší dál, takže ani při malém faktoru se drobné delty neztrácí.

**Kinetický dojezd:** prohlížeč ho po zvednutí prstů posílá jako další wheel
události. Ty se zpomalí stejným faktorem, dojezd tedy zůstává, jen je kratší.

**Co se nechává prohlížeči:**

- události s Ctrl (zoom),
- myš,
- cíl `<canvas>`,
- stránky, které si wheel obsluhují samy (zavolají `preventDefault`, typicky
  mapy a editory). Rozšíření zasahuje až v bubble fázi, takže to pozná.
- vyjmuté domény (platí i pro iframy vložené do vyjmuté stránky),
- situace, kdy v daném rámci není co scrollovat. Díky tomu dál fungují
  navigační gesta a předání scrollu z iframu rodičovské stránce.

## Kalibrace

Výchozí hodnoty jsou odhad, protože rozšíření vzniklo bez přístupu k tvému
hardwaru. Postup kalibrace:

1. Zapni debug režim a otevři dlouhou stránku.
2. **Myš:** otáčej kolečkem pomalu i rychle. Mělo by se objevit jen `mouse`.
   - `wheelDeltaY` jsou jen ±120 a násobky: máš klasické kolečko. V
     Pokročilých můžeš nastavit **krok high-res kolečka na 0**. Detekce
     touchpadu je pak nejspolehlivější, protože všechno, co není násobek 120,
     je touchpad.
   - Hodnoty jako ±15 nebo ±30: high-res kolečko. Nastav krok na nejmenší
     hodnotu, kterou vidíš (obvykle 15).
3. **Touchpad:** udělej pomalý tah, rychlý tah i švih s dojezdem. Mělo by se
   objevit `touchpad` a `zpomaleno`.
   - Pokud se gesto někdy rozpozná jako `mouse`, podívej se na hodnotu první
     události (`NOVÝ-PROUD`). Jestli je to násobek kroku high-res kolečka, jde
     o vzácnou náhodu, kterou má řešit paměť.
   - Pokud se jedno gesto rozpadá na víc proudů (`NOVÝ-PROUD` uprostřed tahu),
     zvyš **mezeru mezi gesty**.
   - Pokud po zvednutí prstů stránka zastaví hned a bez dojezdu, napiš mi. Znamená
     to, že Brave při zrušených událostech dojezd negeneruje a rozšíření by si ho
     muselo dopočítat samo.
4. Faktor rychlosti doladíš posuvníkem.

Ze zkopírovaného logu můžeš udělat testovací data. Funkce `fromLog()`
v `test/fixtures.js` převede řádky z konzole na vzorky pro testy.

## Testy

Logika detekce a pomocné funkce jsou čisté funkce bez DOM. Testy se spouští
přímo v Node, nic se neinstaluje:

```sh
cd touchpad-scroll-brave
node --test
```

Ukázkové sekvence v `test/fixtures.js` (myš, myš se zoomem, high-res kolečko,
touchpad s dojezdem, touchpad s nešťastným začátkem) jsou **sestavené**, ne
nahrané. Odpovídají tomu, jak Chromium plní `deltaY` a `wheelDeltaY`. Skutečné
hodnoty z tvého stroje je ověří nejlépe.

## Známá omezení

- Rozšíření neběží na interních stránkách (`brave://…`, nová karta), v Chrome
  Web Store ani ve vestavěném prohlížeči PDF. Tam scroll zůstane rychlý.
- Pokud stránka zavolá u wheel události `stopPropagation()`, rozšíření se o ní
  v bubble fázi nedozví a nechá ji být (log: „stránka zastavila propagaci“).
- Iframe z jiné domény, který už nemá co scrollovat, předá scroll rodičovské
  stránce nativně, tedy plnou rychlostí. Rozšíření nemůže scrollovat cizí rámec.
- Kvůli posluchači s `passive: false` čeká prohlížeč u první události každého
  gesta na JavaScript stránky. Na hodně vytížených stránkách se tak může začátek
  scrollu nepatrně zpozdit, a to i u myši.

## Alternativy, kdyby rozšíření nestačilo

Žádná z nich není implementovaná. Všechny mají zásadní nevýhody:

- **libinput-config / LD_PRELOAD:** na GNOME Waylandu čte vstupní zařízení
  přímo Mutter (compositor). Úprava se proto projeví ve všech aplikacích, ne
  jen v Brave. Navíc jde o knihovnu podstrčenou do `gnome-shell`, kterou může
  rozbít každá aktualizace a na Fedoře si s ní nemusí rozumět SELinux.
- **Brave přes XWayland** (`--ozone-platform=x11`): nepomůže. XWayland slije
  touchpad i myš do jednoho virtuálního zařízení a X11 nemá nastavení rychlosti
  scrollu pro jednu aplikaci. Brave by navíc přišel o nativní Wayland (HiDPI,
  plynulost).
- **Chromium flagy:** pokud vím, na Linuxu neexistuje flag pro rychlost scrollu
  touchpadu. `#smooth-scrolling` mění jen animaci kolečka. Ověřit se to dá
  v `brave://flags`.
