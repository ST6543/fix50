# FIX50 — Release-checklist (desktop/Windows)

Vast procedure-document: van code-wijziging naar gepubliceerde Windows-release op GitHub, zodat elke nieuwe versie dezelfde stappen doorloopt en `(nieuwe) gebruikers` de app downloaden en opent zonder dat wij erbij moeten.

> Downloadlink die altijd werkt: `https://github.com/ST6543/fix50/releases/latest/download/FIX50.exe` — deze verwijst automatisch naar de nieuwste release.

## 1. Kwaliteitsronde (verplicht vóór elke release)

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest
```

Faalt één van beide: oplossen of niet releasen — geen release met rode checks.

## 2. Source-kant naar GitHub

```bash
git add <bestanden>          # alleen relevante files
git commit -m "Fase X: <samenvatting>"
git push origin master
```

## 3. Backend (alleen als de wijziging server-side is)

```bash
npx -y supabase@latest functions deploy <functie-naam>   # per gewijzigde Edge Function
supabase db push                                          # alleen bij nieuwe migraties
```

Secrets van Edge Functions staan al op het project; alleen bij nieuwe secrets eerst `supabase secrets set` en daarna opnieuw deployen.

## 4. Desktop-EXE bouwen

```bash
npm run desktop:build
```

Doet `expo export --platform web --output-dir desktop/www` en daarna `electron-builder --win portable` → output in **desktop-build/**:

- `desktop-build/FIX50.exe` — de portable single-file EXE die op GitHub gaat.
- `desktop-build/win-unpacked/FIX50.exe` — de uitgepakte variant, nodig voor de testmodus in stap 6.

Info: config staat in [electron-builder.desktop.json](../electron-builder.desktop.json) — appId `nl.fix50.desktop`, productName `FIX50`, win-target `portable`, output-map `desktop-build`.

## 5. (Optioneel) Code-signing

Alleen als er een certificaat bij de hand is; anders overslaan — Windows toont dan de bekende SmartScreen-melding bij de eerste start ("Meer info → Toch uitvoeren"), die in de app-instructies benoemd is.

```bash
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 desktop-build/FIX50.exe
```

## 6. Testmodus (verplicht vóór een release)

```bash
FIX50_DESKTOP_TEST=1 ./desktop-build/win-unpacked/FIX50.exe
```

Verwacht in de output: `[desktop] FIX50 server gereed`, waarna de app vanzelf stopt. Dit simuleert een schone eerste start (zoals Patrick die krijgt) — als dit niet werkt, niet releasen.

## 7. Versie-tag + GitHub-release

```bash
gh release create v1.0.1 desktop-build/FIX50.exe \
  --title "Fix50 desktop app (v1.0.1)" \
  --notes "$(cat <<'EOF'
Fix50 — desktop-versie (Windows, portable)

- Download **FIX50.exe** en dubbelklik — geen installatie nodig.
- Bij de eerste start kan Windows waarschuwen: kies **Meer info → Toch uitvoeren**.
- Eerste start duurt enkele seconden, daarna start hij normaal.
- In de app: **Registreren** → eigen account aanmaken. Werkt op elk netwerk met internet.

Nieuw in v1.0.1:
- <kort per verbetering, zodat gebruikers weten wat er is veranderd>
EOF
)"
```

- Vervang `v1.0.1` op **alle** plekken (tag, titel, notes) door de nieuwe versie.
- Houd de tag in lijn met de versie-in `package.json` (Bump in dezelfde commit als de wijzigingen).
- Zet per release de "Nieuw in"-punten in voor gebruikerstaal, niet ontwikkelaarstaal.

## 8. Verificatie na release

```bash
gh release view v1.0.1 --json assets --jq '.assets[].name + " (" + (.assets[].size|tostring) + " bytes)"'   # FIX50.exe + grootte
curl -sIL https://github.com/ST6543/fix50/releases/latest/download/FIX50.exe | grep "^HTTP"                 # verwacht 302 + 200
gh repo view ST6543/fix50 --json visibility --jq .visibility                                               # verwacht PUBLIC
```

Het README op GitHub bevat bovenaan al de downloadlink + SmartScreen-note, en wijst op `releases/latest` — die klopt automatisch met de nieuwste release; het README hoeft daar dus niet aangepast te worden bij elke release.
