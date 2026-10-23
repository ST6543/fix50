Secrets manager in use: none

# Secrets met Infisical (in plaats van `.env`)

FIX50 leest zijn configuratie via `process.env` (`src/lib/env.ts`, `scripts/*.mjs`) en
`Deno.env.get` (Edge Functions). Er verandert niets aan de app-code: `infisical run`
zet de waarden als omgevingsvariabelen neer vóór het dev-commando start.

## Commands

| Waar | Commando | Wat het is |
|---|---|---|
| Lokaal dev (nieuw) | `npm run dev` → `infisical run --env=dev -- expo start` | Expo dev-server met secrets uit Infisical |
| Lokaal dev (zonder Infisical) | `npm start` → `expo start` | Leest nog steeds `.env` als die bestaat |
| Emulator | `npm run android` / `npm run ios` / `npm run web` | Ongewijzigd |
| Productie / distributie | `eas build …`, `npm run desktop:build` | Ongewijzigd — geen `infisical run`, die horen bij een machine identity |
| Scripts | `npm run import:diagnosis`, `npm run pdf:preview`, … | Ongewijzigd; wrap zelf met `infisical run --env=dev -- …` als je ze met Infisical-secrets wilt draaien |

## Environment variables (alleen namen, nooit waarden)

App (Expo, worden ingebed bij bundelen):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Lokale scripts (`scripts/import-diagnosis.ts`, `scripts/test-*.mjs`, `scripts/key-status.mjs`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_API_BASE`
- `AI_MODEL`

Edge Functions (server-side, normaal via `supabase secrets set`):

- `AI_VISION_MODEL`
- `AI_DAILY_USER_LIMIT`
- `CRON_SECRET`
- `EXPO_ACCESS_TOKEN`

Alleen Electron-desktop testmodus (`desktop/main.js`):

- `FIX50_DESKTOP_TEST`

`.env.example` is de plek waar namen en placeholders staan; echte waarden horen daar niet.

## Afronden (Finish setup)

Eenmalig, in deze volgorde — één commando per regel (Windows PowerShell 5.1 kent geen `&&`):

```powershell
# 1. Maak in het Infisical-dashboard een project voor FIX50.
#    Development / Staging / Production bestaan al; gebruik voor lokaal "dev".

# 2. Installeer de CLI (kies je platform):
scoop bucket add org https://github.com/Infisical/scoop-infisical.git
scoop install infisical
# macOS: brew install infisical/get-cli/infisical
# overal: npm install -g @infisical/cli

# 3. Inloggen (opent je browser; zonder browser: infisical login -i)
infisical login

# 4. Deze map aan het project koppelen — schrijft .infisical.json (geen secrets, mag in Git)
infisical init

# 5. Secrets importeren: sleep je .env op de Secrets Overview-pagina van het project,
#    kies environment "Development", en controleer daarna de key-namen.

# 6. App starten met secrets uit Infisical
npm run dev

# 7. Bewijzen dat de waarden uit Infisical komen: verplaats .env BUITEN deze map
#    (bijv. naar %USERPROFILE%\fix50-env-backup\.env — niet hernoemen binnen de repo)
#    en start opnieuw:
npm run dev
```

Daarna is `.infisical.json` het enige bestand dat aan Git wordt toegevoegd; `.env` blijft
buiten de repository (zie `.gitignore`).

## CI en productie

`eas build`, de desktop-build en geplande jobs draaien niet via de dev-CLI. Gebruik daar een
machine identity met Universal Auth en zet `INFISICAL_UNIVERSAL_AUTH_CLIENT_ID` /
`INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET` in de secret store van het platform (EAS secrets,
GitHub Actions secrets, Supabase secrets), nooit in de repo.

## Ooit gecommit = roteren

Een secret die ooit in een commit heeft gestaan, staat voor altijd in de Git-historie: roteer
hem (nieuwe key aanmaken, oude intrekken) en trek daarna de nieuwe waarde in Infisical. Zoek
gelekte waarden met `infisical scan`.
