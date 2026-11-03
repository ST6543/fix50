# AFSTEL-KENNISBANK — 2-takt scooter/brommer tuning

Gevestigde research voor de Afstelhulp. Dit is de kennisbasis waarop
`src/lib/afstel.ts` (rekenmodellen) en `src/data/engineBlocks.ts` (blokken-dataset)
rusten. Status-legenda: ✅ = geverifieerd op geciteerde bron · ⚠️ = richtlijn /
forum-consensus, geen fabrieks-specificatie · ❌ = niet geverifieerd, geen claim.

---

## 1. Blokken per type (korte samenvatting; details in `src/data/engineBlocks.ts`)

Alle 2-takt blokken delen de basis: snor- en bromversies zijn hetzelfde blok met
allerlei restricties (varioring, uitlaatprop, CDI-begrenzing) ✅.

### Minarelli horizontaal (Aerox/Nitro/Jog/Neo's, AC en LC)
- Carter-reed (membraan in het carter) → groot mengsel-membraan mogelijk, het
  standaard tuning-platform van de NL-scene ✅.
- Standaard: gietijzer, 40 mm boring, 10 mm zuigerpen (let op 10 vs 12 mm pen bij
  kits!) ✅. Carb: Dellorto PHBN/PHVA 12 ✅.
- Stages: 50 sport (Stage6 Streetrace/Sport Pro), 65 (Airsal), 70 straat (Malossi
  Sport gietijzer, 47,6 mm, 6 spoelpoorten, 7–9 pk ⚠️ maxiscoot) en 70 race
  (MHR Replica / Stage6 R/T: piek 9.000–12.000 ✅ maxiscootproductpagina).
- Standaardkrukas houdt het bij ~10–12 pk; daarboven versterkte krukas + C4-lagers ⚠️.

### Minarelli verticaal (Booster/BW'S/Stunt/Slider)
- Membraan in het cilinderhuis → minder extrem potentieel, makkelijker sleutelen ✅.
- Carb PHBN 12 HS, bougie BR8HS-klasse ⚠️. Grote carb (PHBG 19) pas met Big Valve-intake ⚠️ maxiscoot-set.

### Minarelli AM6 (staand, schakel: Rieju RS2/MRT, MBK X-Power, Yamaha DT50)
- 5/6 versnellingen, natte koppeling, LC. Geen CVT: afstellen via carb, uitlaat,
  cilinder én **ketting/vertanding** (shift-point), niet via rollen ✅ (principe).
- Standaard carb Dellorto PHBN 16 NS/PS (Euro4/5: hoofdsproeier 84, pilot 36) ✅ pedparts.
- Bougie NGK BR9ES ✅ (koudere B10 voor race ⚠️). Stage 80cc race: Barikit ⚠️.
- Euro4/5: pas met ECU-flash hebben carb/uitlaat-wijzigingen zin ⚠️.

### Derbi EBE / EBS / D50B0 (Senda, GPR, DRD)
- EBE vs EBS = type toerenteller-aandrijving ✅ GPR Camp.
- GPR = tapse krukas, Senda = rechte — bepaalt welke performance-krukas past ✅ GPR Camp.
- D50B0 = Euro3/4-generatie; ECU en uitlaat-sensor spelen mee ⚠️.

### Piaggio horizontaal AC en LC (Zip, Vespa 50 2T, Fly, Runner, NRG)
- Werkpaard-blok; st. gietijzer 40 mm, 12 mm zuigerpen ✅ k-parts. Carb PHVA 12
  (45 km/u) of PHVA 17,5 ED (SP/LC) ✅. Bougie NGK BR9ES ✅.
- LC = meer upper-end potentieel; koelsysteem = faalpost ⚠️. PureJet (injectie) lastig te tunen ✅ scootparts.
- Let op koppelingshuis-Ø 105 vs 107 mm bij onderdelen ⚠️.

### Peugeot horizontaal (Speedfight 3/4, Ludix) en verticaal (Speedfight 1/2, TKR)
- Verticaal is laagtoerig touring-formaat; horizontal heeft het betere 70cc-pak
  (Malossi MHR Replica alu: 47 mm, 12 mm pen, 9.000–12.000 rpm piek ✅ maxiscoot).
- Verticaal: Gurtner 12 mm-carb ⚠️; snor- en bromcilinder zijn niet uitwisselbaar ✅ k-parts.

### Horizontaal vs verticaal (dwarsverband)
Carter-reed (horizontaal) kan grotere membranen en meer toerenpotentieel; cylinder-reed
(verticaal) is simpeler en in het algemeen iets beperkter ✅ scooterforum-vergelijking.

---

## 2. Carburateur-afstelling: de werkmethode

### Afstelvolgorde (skalend, vanuit het hele systeem)
1. **Valse lucht uitsluiten** — 50% van de race-blokken lekt ergens (GroepK); een
   blok met een lek carbureert nooit consistent ✅ K,O'Connor-leak-down.
2. **Hoofdsproeier (volgas)** — "start rijk, werk terug" ✅ Dellorto-handboek.
3. **Gasnaald/clip (1/4–3/4 gas)** — clip omhoog = naald omlaag = armer; clip
   omlaag = rijker ✅ Moped Wiki/Dellorto.
4. **Stationairsproeier + luchtschroef (0–1/8 gas)** — 2-takt: luchtschroef openen
   = armer ✅ Dirt Bike Test; ideaal 1–2 slagen uit ✅.
5. **Plug chop als eindcontrole** — alleen voor hoofdsproeier/hoogtoerengebied ✅ GroepK.

### Sproeierschalen (voorzichtig met nummer-vergelijken)
- Dellorto echt = kleiner nummer dan werkelijke boring (Dellorto 60 = 0,627 mm);
  generiek Dellorto 60 = 0,600 mm ✅ myronsmopeds.
- Keihin stappen 0/2/5/8; Mikuni is flow-gebaseerd: gelijk nummer stroomt meer ⚠️ jetsrus.
- Vuistregel notatie in de app: altijd **merk + type carb + nummer + gemeten boring**.

### Snel-startformule kleine Dellorto (≤21 mm) ✅ tuningmatters
`hoofdsproeier ≈ venturi(mm) × 5 × factor` met factor 0,90 (standaard) tot 1,0
(race-uitlaat + sportfilter). Voorbeelden: 12 mm + sport uitlaat → 60; 17,5 mm +
70cc sport + race filter/uitlaat → 88; 17,5 mm met airbox → 84.
Geldig voor kleine Dellorto's, niet voor Keihin PWK/Polini CP ✅.

### Choke-test (Dellorto, onderweg)
Volgas choke aanzetten: slechter/inkremmen = sproeier te groot; duidelijk beter =
te klein ✅ Dellorto-handboek.

### Volgas-viertakt-methode (veiligste WOT-punkt)
Start rijk (sproeier groot + clip rijkst), test volgas: viertakt hij op top? dan
kleiner. Sproeier zo groot tot hij net niet viertakt, dan 2–4 maten kleiner ✅ PHBG-guide.

### Valse lucht / leak-down (K,O'Connor / GroepK)
Vacuum 14 inHg 2 min vasthouden + druk 7 psi (nooit hoger——blaast keerringen eruit),
zeepsop op alle afdichtingen. Lekplaatsen op volgorde van waarschijnlijkheid: reed-
cage-pakking, inlaatspruitstuk (berucht op scooters), krukaskeerringen, carternaden,
cilinder-en-koppakking, bougie-ring ✅. **Nooit een lek compenseren met sproeiers** ✅.

### Luchtschroef-regel (2-takt)
Ideaal tussen 1 en 2 slagen open ✅. <1 slag open = pilot te groot (rijk), >2-3
slagen = te klein (arm) ✅. Procedure: warme motor, in stappen van 1/4 slag (finaal
1/8) het hoogste-stabielste toerental zoeken ✅ GroepK.
⚠️ Te kleine stationair-sproeier op 2-takt = vastlooprisico bij gas dicht
(Dellorto-fabriekswaarschuwing) ✅.

### Plug chop — procedure en interpretatie
1. Nieuwe bougie, motor volledig warm rijden.
2. Volgas (min ~800 m), dan op top: kill-switch + ontkoppelen/remmen **gelijktijdig**.
3. NOOIT daarna nog partijgas rijden (leest ongedaan) ✅ Kawatriple.
4. Bougie lezen op het witte porselein aan de basis ("smoke ring", ~2 mm gebied) —
   voet van de isolator is het enige betrouwbare gebied ✅ GroepK.

| Smoke ring | Betekenis | Actie |
|---|---|---|
| Chocoladebruin, ~2 mm | hoofdsproeier goed | laten staan |
| Donkerder / hoger dan 2 mm | rijk (veilig) | kan |
| Kleiner of lichter bruin | arm | +1 maat, opnieuw ✅ GroepK |

Breed tabel Perspectief (Polini): licht- tot donkerbruin droog = normaal; wit/grijs
= oververhitting te arm; zwart/nat = te rijk ✅.
❌ Het bovendeel van het porselein voorspelt LOW/midrange niet ⚠️ GroepK.

### EGT (voor de geavanceerde gebruiker)
Thermokoppel type K; probe 3–8 inch van de zuiger of 40–60 mm diep in de pijp ✅.
Eerders gebruikt *relatief*: jouw vaste metplek/weather zijn de referentie;
combinatie CHT+EGT i.p.v. absolute getallen ⚠️ foxvalleykart.
**CHT stijgt + EGT daalt = detonatie** ✅ foxvalleykart (contra-intuïtief).

### Pingelen/detonatie
Metaal-geluid vooral volgas onder last; sporen: metaal-spikkeltjes op het porselein
("peppering"), gesmolten elektrode, putjes in de zuigerkroon ✅.
Eerste hulp: direct rijker (hoofdsproeier +1 à +2), daarna pas timing/compressie ⚠️.

### Carb-maat vs. vermogen ✅ Polini (fabrieksbron)
Grotere venturi = meer piek bovenin, minder signaal onderin (bog/slechte stationair);
kleinere venturi = beter onderin en makkelijker afstellen, maar beperkt bovenin.
Praktijk-richtlijnen ⚠️ forum-consensus: 70cc sport → 17.5–19 mm; 70 race → 19–24 mm;
de beste maat is de kleinste die nog net de top niet kost.

## 3. CVT / overbrenging: regels en tabellen

### Drie krachten bepalen het werkpunt
- **Rollen** -> wanneer er opgeschakeld wordt (werktoerental van het blok).
- **Drukveer (contraveer)** -> backshift-snelheid en slip-grens van de snaar.
- **Trekveren** -> aangriptoerental van de koppeling.
(⚠️ k-parts / freshparts / j-p-s)

### Rollen: regels ✅
- Lichter -> hoger toerental, later opschakelen, blijft langer in de powerband.
- Zwaarder -> eerder opschakelen, rustiger; te zwaar = lui en onder de powerband.
- **Meer vermogen -> juist LICHTER** (powerband schuift omhoog). Zwaarder wordt pas
  nodig als de drukveer óók harder wordt of als de rollen te licht zijn.
- Stapgrootte bij afstellen: **0,25-0,5 g**; mengen mag (verschil max ~2 g);
  testsetjes zijn voor testen, niet om te laten zitten (slijten snel).
- Platte kanten op rollen/glijbus of vette vario -> eerst reviseren, dan afstellen.

### Drukveer: kleurcodes (Malossi) ⚠️ STN/freshparts/scooterforum
Percentages = sterker dan origineel; kleuren zijn NIET uitwisselbaar tussen merken.
| Kleur | 107 mm Piaggio-2T huis | gebruiksrichtlijn |
|---|---|---|
| Wit | +30% | standaard t/m middentoerige 50cc / lage 70cc |
| Geel | versterkt/standaard+ | Stage6 Pro 70 / DR70 RPM |
| Groen | +60% | midrace 70cc alu |
| Paars | +82% | hoogtoerige 70cc alu |
| Blauw | +106% | sportieve krachtige setups |
| Zwart | ~+114% | race 70cc |

### Backshift ⚠️
Te slap -> snaar gaat te snel naar lange verhouding, slipt bij veel koppel en zakt
weg in toeren. Te strak -> blijft te lang op korte verhouding: meer toeren, meer
warmte, extra frictie, pk-verlies bovenin.

### Koppeling / trekveren ⚠️
- Strakke trekveer -> laat aangrijpen, felle launch, maar warmte en snelle slijtage.
- Malossi-volgorde slap->strak: Origineel -> Wit -> Groen -> Geel.
  Stage6: Wit = soft, Oranje = medium, Rood = heavy.
- Bell: door hitte glad/blauw verkleurd -> koppeling glijdt. Lichte glans kun je
  schuren; diepe groeven/blauwe plekken/kromme bell = vervangen.
  Nieuwe segmenten in een ingebrande bell slijten weer direct.

### V-snaar ⚠️
- Maten zijn L x B x H (lengte x breedte x dikte); check altijd koppelingshuis-O
  (105 vs 107 mm) en meet de oude snaar op meerdere punten.
- Minarelli H/V lang carter: 747x16,5x8 (ook 751/757 afh. van huis).
  Minarelli kort: 777x16,5x30. Piaggio 2T lang: eigen maat.
- **Stift-test** ✅: kleur een radiale streep op de vario, rij volgas, meet hoeveel
  weggeveegd: streep volledig weg = snaar loopt bijna tot de rand (max, niet er
  voorbij); bovenkant streep blijft staan = snaar komt niet hoog genoeg
  (varioring, uitlaatprop, te korte snaar, te zware rollen of strakke drukveer).

### Vertanding (eindoverbrenging) ✅ speed-parts
RF = (groot/klein primair) x (groot/klein secundair). Lagere RF = langere
vertanding => hogere top, tragere acceleratie; hogere RF = korter => meer trek,
lagere top. Vertanding pas veranderen NA cilinder/uitlaat/vario.

De diagnose-chat (Edge Function `diagnose-chat`) leest deze kennisbank live:
`supabase/functions/_shared/blocks.ts` kiest via `pickEngineBlock()` het blok-profiel
(setup → engine_type → merk/model) en zet het als BLOKKEN-KENNISBANK-sectie in de
systeemprompt; bij schakelblokken adviseert de AI dus vertanding, geen vario.
Gedekt door tests/ai-blocks.test.ts.
Bekende fabrieksoverbrengingen (kettingtandwiel: voor/achter, 420-ketting):
Rieju MRT 11/52 · Rieju RS2/Matrix en MBK X-Power/TZR 11/47 · Yamaha DT50
11/50 (richtlijn) · Derbi Senda nieuw blok (D50B0) 11/53 · oud blok (EBE)
14/53. Interne primaire verhouding: AM6 20/71 (3,55), Derbi 21/78 (3,7).
Vuistregels: 1 tand kleiner voor = ±3 tand groter achter; 1 tand groter
voor ≈ ±500 rpm lager op top (derbi-forum praktijk).
Voorbeelden Piaggio 2T: 16/37 + 15/39 = RF 6,006 (langst); 13/39 + 14/48 = RF 10,29 (kortst).

### Powerband-indicaties ⚠️ forum-consensus/praktijk
| Setup | Werktoerental (indicatie) |
|---|---|
| 50cc standaard (ontgrensd) | ~6.500-7.500 rpm |
| 50cc + sportuitlaat | ~7.500-8.500 |
| 70cc sport | ~8.000-9.000 |
| 70cc midrace | ~9.500-10.500 |
| 70cc race | ~11.000-13.000+ |

Koppeling grijpt aan tussen ~3.500-4.500 rpm, net onder de powerband;
trekveren als LAATSTE afstellen.

### Symptomen -> diagnose ⚠️
| Symptoom | Meest waarschijnlijke oorzaak | Eerste actie |
|---|---|---|
| Veel toeren, weinig snelheid | rollen te licht; snaar slipt; koppeling slipt | stift-test; rollen +0,5g; snaar/bell meten |
| Lui wegrijden | rollen te zwaar; drukveer of trekveren te slap | rollen -0,5g; drukveer +1; trek strakker |
| Top te laag, trekt verder goed | snaar komt niet bovenin; varioring/prop; vertanding te kort | stift-test; begrenzers eruit; snaar/RF |
| Jankt eerst, vertrekt dan pas | trekveren te strak | 1 stap slapper |
| Instelling verandert vanzelf | versleten rollen, vette vario, oude snaar | eerst reviseren/schoonmaken |

### Workflow ✅/⚠️ (freshparts e.a.)
1. Baseline: snaar op maat en huis-O, schone droge vario, gave rollen/bus.
2. Vertanding vastleggen (RF).
3. Drukveer kiezen op toerengebied van cilinder + uitlaat.
4. Trekveren: aangRIJP net onder powerband-begin.
5. Rollen in stappen van 0,25-0,5 g tot gelijkmatig van stilstand tot top.
6. Stift-test als controle.
7. Proefrit warm, zelfde traject, per test EEN variabele; noteer instellingen
   en de dagtemperatuur (GroepK schrijft ze op de motorkap).
## 4. Structuur & stijl (DutchRiders/Opvoerkit-voorbeeld)

Werkende structuur van de voorbeeld-tools (gelezen in de gerenderde iframes):
- **Carburateur-tool**: 1. Jouw setup -> 2. Jouw startafstelling (hoofdsproeier
  + gasnaald + bougie) -> 3. Afstelkaart per gasstand -> 4. Mengsel & diagnose
  (symptoomknoppen) -> losse sectie Bougie lezen.
- **CVT-tool**: 1. Welk type overbrenging (cartertje-types met richt-snaar) ->
  2. CVT-setup (rollen, drukveer, snaar, trekveren, powerband) -> 3. Snelheid vs
  toerental (grafiek + verdict + launch/balans/shift) -> 4. Symptomen invullen ->
  voorgestelde richting (huidig vs voorgesteld) + Suggestie toepassen.

UI-personages die werken (zowel in de webtool als in de FIX50-app):
- **Keuzeblokken met titel + detail + hint** (bv. cartertypen).
- **Instelling-presets** ("70cc sport", "70cc race") in plaats van losse sliders.
- **Symptoomknoppen**: gebruikers herkennen symptomen beter dan ze onderdelen
  kunnen benoemen.
- **Vergelijking huidig vs voorgesteld** met druk eenheid en delta.
- **Verbetsbandbreedte** per getal ("sproeier 84-91, start op 91") in plaats van
  schijnprecisie.
- **Disclaimer = voorwaarden, geen tekstje onderaan**: altijd warme motor,
  waarschuwing te arm = kappen met testen, uitleg "tool = startpunt".
- Toon: direct, korte zinnen, één droge grap per sectie als saus, nooit ín de instructie.

## 5. Wat NIET hard geverifieerd is (transparantie)

Veel koppelpunttemperatuur/powerband-getallen zijn forum-consensus, geen fabrieksdata.
- EGT-zones: alleen kart-motoren (Rotax/Vortex/IAME/KT100, 500-680 graden C) zijn
  hard; voor 50-70cc scooters gebruik je de trend, niet een absoluut getal.
- "70cc race -> 21 mm carb" en dergelijke: forum-consensus.
- (Sproeier-)kleurcodes van Malossi/Polini/Stage6 trekveren: per merk-jaren
  verschillend - check altijd de bijsluiter van de eigen veer.
- AM6/derbi boringsstanden en fabrieksrestrictoren per bouwjaar: niet geverifieerd.
- Sproeierschaal van "Denso": bestaat niet in de praktijk; Denso is een bougie-merk.


## 6. ECU/CDI-ontgrenzing bij schakelblokken (AM6 E4/E5, Derbi D50B0)

### Geverifieerd (NL/BE-bronnen)
- **AM6 t/m 2018 (Euro 1-3):** onbegrensde CDI, begrenzing was puur mechanisch (uitlaatprop, carburateurrestrictie, tandwielen). **Vanaf Euro4/Euro5 (2018+) op Rieju/Beta/Sherco/Fantic/SWM:** ECU met elektronische toerentalbegrenzing (o.a. via toerentalsensor).
- **AM6 E4/E5-praktijk:** eerst de gratis B5-draad-methode (zwarte draad op positie B5 van de ECU-stekker, door Beta beschreven voor de RR 50 E5). Werkt NIET op elk model - een NL-forumcasus (Rieju MRT Pro E5) meldt dat B5 geen effect had. Daarna: plug-and-play vervangende ECU (Stage6 onbegrensd Euro4/5, 24-pins, ±93 euro, dekt beide; Polini; VOCA).
- **Belangrijk bij ECU-vervanging (bijv. AM6 E4/E5):** aftermarket-ECU's kunnen de **elektronische oliepomp** niet aansturen - olietekort-levering = motorschade. Controleer of de unit de oliepomp regelt of dat je olieratio handmatig bijstelt.
- **D50B0 (Derbi Senda, Euro4 vanaf 2018):** gangbare route is een **vervangende CDI/ECU-unit** (Mezoly als de meest gekochte; 101 Octane "verstelbaar" ±39 euro met traploos af te passen begrenzer; dealer-ECU via importeur circa 65 euro). De NL-bronnen noemen dit NOOIT "flash". Of de D50B0 E4 een elektronisch geregelde carburateur/lambda heeft is een CONFLICT in de bronnen (zie "Niet geverifieerd").
- Praktische gevolgen na ECU-vervanging: sproeier opnieuw afstellen (groter), bougie een graad kouder overwegen, vertanding herzien.

### Niet geverifieerd (expliciet gemarkeerd)
- "Flash-software op de originele ECU" bij AM6 E4/E5: geen NL/BE-pagina noemt een concrete partij, tool of prijs; de bronnen zeggen slechts "uitsluitend door gespecialiseerde bedrijven".
- Of de D50B0 Euro4 lambda/O2-sensoren of een elektronisch geregelde carburateur heeft: de 50factory-datasheet zegt "carburateur, CDI" (geen lambda), forumleden menen juist "elektronische carburateur". CONFLICT, niet te beslissen op NL-bronnen.
- Euro5+ (vanaf 2025): de bekende plug-and-play-units (Stage6/VOCA) dekken dit nog niet; EZrider labelt ze expliciet "NIET Euro 5+". Wacht je op een unit, check dan per verkoper het ondersteuningsmodel.

### Bronnen
ezrider.nl "CDI/ECU ontgrenzen" · speed-line.com (Stage6 CDI/ECU Euro4/5) · k-parts.be (Mezoly/Polini CDI-ECU) · allesvoorscooters.nl "CDI onbegrensd verstelbaar per-derbi-D50B0-Euro4" · derbi-forum.nl #22475 & #26142 · scooterforum.net #228442 & #236476 · en.50factory.com (factsheet Senda Euro4) · scootertourclubnederland.com (lambda-bung-passten).

## 7. Bougies: hittegraad en aflezen (NGK-basis, GEVERIFIEERD)

### Hittegraad
- **Hoger getal = kouder** (NGK/Denso/Pulstar). Bij Champion/Autolite/Bosch is de nummering omgekeerd - een klassieke verwarring in fora.
- "Kouder/heter" = **warmte-afvoersnelheid van de isolatorneus naar de kop**, NIET de vonkenergie. Korte, hapere isolatorneus = koudere bougie; lange, dunne neus = hetere bougie.
- Optimaal werkvenster ca. **500-800 C** op de neus; onder ±450 C start zelfreiniging niet (koolstofresten) en van lucht over 800 C oververhitting & pre-ignition. Verschil per graad: ongeveer 70-100 C op de tip.
- Praktijk 50cc 2-takt: **standaard/stil gebruik: BR8 · licht opgevoerd: BR8-9 · sterk opgevoerd / langdurig volgas: BR9-10.**
- NGK-devies: **twijfel tussen twee graden → kies de koudere** (te koud: alleen sneller vervuiled; te heet: mogelijke zuigerschade). Verander nooit tegelijk de bougiegraad én sproeier/clip.
- Betekenis van de code (BRxHS/BRxES): B = schroefdraad 14 mm · R = resistor · 8/9/10 = hittegraad · H = schacht 12,7 · E = schacht 19 mm · S = standaard kern-elektrode. **H en E zijn NIET onderling verwisselbaar** (verschillende schachtlengtes; te lange schacht kan de zuiger raken).
- In de app is 'x' = hittegraad-plek: BRxHS (vario-blokken) / BRxES (AM6/Derbi).

### Aflezen (kleur van de isolatorneus)
| Kleur | Betekenis | Eerste actie |
| --- | --- | --- |
| Koffiebruin, droog, egaal | Gezond: goed mengsel en ontsteking | Niets |
| Lichtgrijs / grijze as | Vaak normaal bij moderne 2-takt-olie | Olie-additieven controleren als de laag dik/verhard is |
| Droog zwart / roet | Te rijk of zwakke vonk | Sproeier kleiner, luchtfilter checken, vonk controleren |
| Zwart én nat / olieachtig | **Te veel olie** (mengverhouding/oliepomp of lekkende krukaskeering) | Mengverhouding/oliepomp controleren; carterdruk-test bij vraag tussen |
| Wit / krijtwit of gebladderdee neus | **Te arm of te heet — "GEVAAR"** | Direct stoppen; valse lucht checken; sproeier rijker en een graad kouder |
| Gebladderde of gesmolten neus | Oververhitting / pre-ignition | Niet opnieuw starten; cilinder en zuiger inspecteren |

### Leesprocedure (de stap die vaak fout gaat)
warm rijden → 30-60 s **onder belasting** op ¾ tot volgas → **contact af terwijl je nog onder belasting bent** → laten afkoelen → bougie eruit → **isolatorneus lezen, niet de elektrode-tip**. Na lang stationair draaien ziet elke bougie te donker: dan zat de neus onder 450 C en reinigt niet.

### Bronnen
ngksparkplugs.com/resources/spark-plug-basics · /understanding-spark-plug-heat-range · ngk.com heat-range 2 · ngk.com.au heat-range · gsparkplug.com "Identifying Spark Plugs" · vespa-ciao.nl "bougies aflezen" · ms-marshal.com 2-stroke-Colour-Diagnosis · scooterforum.net #114459.

**App-koppeling:** sectie 5 "BOUGIE LEZEN" in de carburateur-tab van de Afstelhulp (PLUG_READING / PLUG_HEAT_INFO / PLUG_CODE_INFO in src/lib/afstel.ts).

## 8. Statusupdate kennisbank (november 2026)

- Nieuw: sectie 6 (ECU/CDI-ontgrenzing, deels geverifieerd) en sectie 7 (bougie: NGK-kennis, overwegend geverifieerd).
- Nieuw in de app: vertanding-suggesties per doel (buildGearSuggestions), bougie-hittegraadinfo in de carb-tab, Afstel-log als context voor de diagnose-chat.
- Op de korte-termijnlijst: GPS-verificatie van een afstelling (prestatie voor/na in de rijlog), de afstelplan-PDF, en het daadwerkelijk deployen van de diagnose-chat-Edge-Function met de secties hierboven.
- Waar "niet geverifieerd" of "conflict" staat, toont de app dit als richtlijn, niet als vaststaand feit.
