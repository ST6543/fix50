# Fix50 — Play Store launchpack

Alles om van hier naar **"Fix50 staat in de Play Store"** te gaan, in de juiste volgorde.

---

## 1. App-configuratie (staat in de repo)

| Wat | Waarde | Waar |
|-----|--------|------|
| Package name | `nl.fix50.app` | [app.json](../app.json) |
| Versie | 1.0.0, `versionCode 1` (auto-increment via EAS) | [app.json](../app.json) |
| Permissions | alleen `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` | [app.json](../app.json) |
| Adaptive icon | voorgrond + monochrome + donkere achtergrond `#0B0D10` | [app.json](../app.json) |
| Splash-icoon | `assets/splash-icon.png` op donkere achtergrond | [app.json](../app.json) |
| Build-type | AAB (`app-bundle`) voor Play, APK voor interne test | [eas.json](../eas.json) |
| Submit | naar `internal`-track via service-account | [eas.json](../eas.json) |

Geen ads-ID, geen aangifte van data-verkoop: de Play-Data-safety-formulier hieronder sluit hierbij aan.

---

## 2. EAS-configuratie (eenmalig)

```bash
npm i -g eas-cli          # of: npx eas-cli
eas login
eas init                  # vult extra.eas.projectId in app.json automatisch
```

`eas init` vraagt om een nieuw project; kies het bestaande Expo-account en de slug `fix50`.

Plaats daarna het Google-service-account-bestand (JSON met Play Console-rechten) op:

```
secrets/play-service-account.json
```

...en zet `secrets/` op de .gitignore. Zet ook lokaal (nooit in git):

```bash
supabase/config/config-link.json   # al aanwezig via supabase init
```

De `.env` hoeft voor de Android-build niets te bevatten: de app haalt Supabase-credentials uit `app.json`/hardcoded `src/lib/supabase.ts` (anon-key is publiek). AI-keys blijven in Supabase-secrets op de server.

---

## 3. Build + submit

```bash
# 1. AAB bouwen (productie) — via EAS, geen lokale Android SDK nodig
eas build --platform android --profile production

# 2. Lokaal testen als .apk (optioneel)
eas build --platform android --profile preview

# 3. Na de build: automatisch naar de internal-test-track uploaden
eas submit --platform android --latest
```

**Checklist vóór de eerste build:**

- [ ] `eas init` uitgevoerd → `extra.eas.projectId` gevuld
- [ ] Service-account-JSON op `secrets/play-service-account.json`
- [ ] `.gitignore` bevat `secrets/` en `*.keystore`
- [ ] Keystore-laat EAS beheren (`eas credentials` → Generate new keystore)
- [ ] `npm run typecheck` groen

EAS tekent de AAB zelf; er is geen handmatige keystore-zaak nodig.

---

## 4. Play Console — éénmalige setup

1. **App maken** → naam "Fix50", standaardtaal Nederlands (Nederland), app (niet game), gratis.
2. **App-signing**: Play App Signing aan laten staan (EAS levert de upload-key).
3. **Data safety** — formulier hieronder.
4. **Inhoudsclassificatie** — questionnaire invullen (geen geweld, geen gokken, geen user-generated content die gedeeld wordt; de diagnose-antwoorden zijn per-account privé).
5. **Doelgroep**: 13+, "De app is niet gericht op kinderen".
6. **Statistieken, advertenties**: geen advertenties.
7. **Screenshots**: zie het marketing-hoofdstuk hieronder.

---

## 5. Store-listing (Nederlands)

**App-naam** (max 30 tekens)
```
Fix50: Scooter Onderhoud
```

**Korte beschrijving** (max 80 tekens)
```
Onderhoud, diagnose en tuning voor je scooter — in één app. Gratis.
```

**Volledige beschrijving** (max 4000 tekens)
```
Je scooter start niet. Wat nu?

Fix50 is de onderhouds- en diagnose-app voor je scooter. Alles over je
brommer of snorfiets in één dashboard — gratis.

DASHBOARD
• Kilometerstand en weekgemiddelde, automatisch bijgeschoven
• Onderhoudsschema op maat: olie, bougie, variator, ketting, luchtfilter
• Waarschuwingen als iets te laat is — met herinnering op tijd

PECH ONDERWEG? DIAGNOSE-CHAT
• "Hij springt koud niet aan" — en Fix50 zegt wat je moet checken
• Antwoorden op basis van jouw scooter en je dossier
• Volgorde: brandstof → vonk → compressie, net als de monteur

FACTUREN INLEZEN
• Foto van de bon of factuur; Fix50 leest datum, bedrag en
  werkzaamheden uit; jij bevestigt en het staat in je dossier

TUNING & METEN
• Met GPS: topsnelheid en 0–50 km/u sprint
• Vergelijk vóór en na je aanpassing — hard data, geen buikgevoel

DOSSIER ALS PDF
• Volledig onderhoudsrapport, netjes opgemaakt
• Handig bij verkoop, servicebeurt of een discussie over garantie

GOED OM TE WETEN
• Fix50 is gratis en bevat geen advertenties
• Je data is van jou: alles kan via de app verwijderd worden
• Werkt met benzine- en 2-takt/4-takt scooters

Fix50 denkt met je mee — van eerste krasje tot laatste beurt.
```

**Categorie**: `Productiviteit` (secundair: `Tools` / `Auto & Voertuigen`).
**Tags**: scooter, brommer, onderhoud, diagnose, tuning.

---

## 6. Data safety-formulier (exact invullen)

| Vraag | Antwoord |
|-------|----------|
| Verzamelt of deelt de app gebruikersgegevens? | Ja, verzameld |
| Is data versleuteld tijdens verzending? | Ja |
| Kunnen gebruikers om verwijdering verzoeken? | Ja (in-app in Privacy & gegevens) |
| E-mailadres | Verzameld — accountbeheer — niet optioneel |
| Naam | Verzameld — accountbeheer — optioneel |
| App-interactie (crash logs) | Niet verzameld door ons; Play verzamelt dit zelf |
| Locatie (precies) | Verzameld — app-functionaliteit — alleen tijdens meting — niet gedeeld — verwijderbaar |
| Foto's (facturen/scooter) | Verzameld — app-functionaliteit — alleen met opdracht van gebruiker — verwijderbaar |
| Tekstinvoer (diagnose-chat, notities) | Verzameld — app-functionaliteit — verwijderbaar |
| Wordt data verkocht? | Nee |
| Wordt data gedeeld met derden? | Nee (enkel de AI-provider verwerkt chatberichten opdrachtmatig, zonder training) |

**Privacybeleid-URL** (verplicht): zet de privacy policy hieronder live op
`https://fix50.works/privacy` (of elk stabiel domein) en vul die URL in de listing in.

---

## 7. Privacy policy (als Markdown, klaar om te publiceren)

*Titel op de pagina:* "Privacyverklaring — Fix50"

```
Laatst bijgewerkt: 16 oktober 2026

Fix50 ("wij", "ons") respecteert je privacy. Dit is wat we verzamelen,
waarom, en wat je zelf kunt doen.

1. WELKE GEGEVENS
- Account: e-mailadres en (optioneel) naam, om je dossier veilig bij jou te bewaren.
- Scooterdata: kilometerstand, onderhoud, tuning, metingen, notities — alleen zichtbaar voor jou.
- Locatie: alléén tijdens een performance-meting (snelheid/acceleratie). Routes worden NIET opgeslagen; we bewaren alleen snelheid en nauwkeurigheid van meetpunten.
- Foto's: als jij een foto van je scooter of factuur toevoegt. Gebruikt voor je dossier.
- Chat: je berichten in de diagnose-chat, zodat je gesprek verbetert en je systeem begrijpt.

2. HOE WE OMGAAN MET JE GEGEVENS
- Je gegevens staan versleuteld bij Supabase (EU), met versleutelde overdracht (HTTPS).
- Diagnose-antwoorden lopen via een AI-provider die de tekst uitsluitend opdrachtmatig verwerkt en NIET gebruikt om modellen te trainen.
- We verkopen niets, delen niets met advertentiebedrijven en hebben geen ad-trackers.

3. JOUW RECHTEN
- Bekijk en verwijder metingen, scooters, facturen en chats in de app.
- Verwijder je complete account via Privacy & gegevens → Account verwijderen.
  Alles (serverdata, foto's, gesprekken) wordt permanent gewist.
- Vragen? Mail privacy@fix50.works.

4. KINDEREN
Fix50 is niet gericht op kinderen onder de 13 en verzamelt bewust geen
gegevens van hen.

5. WIJZIGINGEN
Grote wijzigingen kondigen we in de app aan. Verder gebruik betekent
akkoord met de nieuwste versie.
```

**Publiceren:** als statische pagina op `https://fix50.works/privacy` (zelfde donkere stijl als de walkthrough). Als je liever hebt dat ik die pagina nu genereer, zeg het — dan lever ik `marketing/privacy.html` op.

---

## 8. Screenshots (uit bestaande assets)

De walkthrough-video is de bron van waarheid; hier kader je screenshots uit:

| Positie | Tijdstempel in [out/fix50-walkthrough-120.mp4](../marketing/out/fix50-walkthrough-120.mp4) | Onderwerp |
|---------|--------|-----------|
| 1 (phone) | 4,0 s | Dashboard — kilometerstand + onderhoud |
| 2 | 9,0 s | Diagnose-chat "hij springt koud niet aan" |
| 3 | 14,0 s | Factuur-scan met gelezen waarden |
| 4 | 19,0 s | GPS-meting — 0–50 sprint |
| 5 | 23,0 s | Tuning-vergelijk (vóór/na) |
| 6 | 27,0 s | PDF-rapport |

Genereren:

```bash
cd marketing/out
for t in 4 9 14 19 23 27; do
  ffmpeg -y -ss $t -i fix50-walkthrough-120.mp4 -frames:v 1 sh$t.png
done
```

- Verplicht: minimale 2 screenshots (we adviseren 6); telefoons 720×1280 of meer, 16:9‑verhouding-vs-portret mag.
- Feature graphic: 1024×500 — is af. Bron: `marketing/feature-graphic.html`, geëxporteerd als `marketing/out/store/feature-graphic.png` (exact 1024×500). Regenereren:

```bash
cd "$(pwd)"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,500 --virtual-time-budget=8000 --screenshot="$PWD/marketing/out/store/feature-graphic.png" "file://$PWD/marketing/feature-graphic.html"
```
- Ook nodig: een 512×512-hoge-res-app-icoon (bestaat al als `assets/icon.png`).

---

## 9. Main Enforcement-getter

- **Geen advertenties-verklaring**: de app bevat geen SDK-advertenties; niets aan te geven.
- **Permissions**: alleen locatie; camera/foto gaat via de OS-picker (expo-image-picker) — dat is een runtime prompt, geen manifest-permission.
- **Backend**: Supabase Edge Functions; AI-keys zitten in Supabase-secrets, nooit in de app-binary.
- **Account verwijderen**: Play vereist een in-app-weg én (optioneel) een web-weg. De in-app-weg bestaat (Privacy & gegevens). Noem ook het mailadres privacy@fix50.works in de listing als reserveweg.

---

## 10. Volgorde van alles op een rij

1. `eas init` (vult projectId)
2. Service-account op `secrets/play-service-account.json` + .gitignore
3. `eas build --platform android --profile production`
4. `eas submit --platform android --latest` (internal track)
5. Play Console: listing (hoofdstuk 5) + data safety (hoofdstuk 6) + privacy-URL live
6. Screenshots uit de walkthrough (hoofdstuk 8)
7. Internal test → promo-release → productie
