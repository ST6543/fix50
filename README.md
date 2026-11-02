# FIX50 🛵

## 📲 App installeren (Windows)

1. Download de laatste versie: **[FIX50.exe](https://github.com/ST6543/fix50/releases/latest/download/FIX50.exe)** (~219 MB).
2. Dubbelklik op het bestand — **geen installatie nodig**.
3. Bij de eerste start kan Windows waarschuwen ("Windows heeft je pc beveiligd"): kies **Meer info → Toch uitvoeren**. Dit komt doordat de app geen betaald certificaat gebruikt; het bestand is veilig.
4. De allereerste start duurt enkele seconden (de app pakt zichzelf uit), daarna start hij normaal.
5. In de app: kies **Registreren** en maak je eigen account aan (met e-mail + wachtwoord of alleen een gebruikersnaam). Je data is privé per account.

De app werkt op elke laptop/pc met internet — backend, AI en herinneringen draaien allemaal in de cloud, dus je netwerk maakt niet uit.

> Vraagjes of hij start niet op? Stuur een berichtje.

<details>
<summary>🧑‍💻 Voor ontwikkelaars (source, build, tests)</summary>

Dé app voor brommer- en scooterrijders: AI-diagnose in gewone taal, onderhoudsbeheer met herinneringen, kostenregistratie en tankbeurt-log, tuning-setup-registratie en GPS-prestatiemeting — met de diagnose-database (464 entries, 11 bloktypes) als bron van waarheid.

> **Kernprincipe:** de database is de kennislaag, de AI is de redeneerlaag, de Edge Function is de beveiligde tussenlaag. De AI verzint géén diagnoses; zonder relevante FIX50-data zegt de chatbot dat eerlijk.

---

## Functionaliteit

| Module | Wat doet het |
|---|---|
| **Diagnose-chatbot** | Chat in gewone taal ("mijn AM6 valt meteen uit") → Edge Function zoekt relevante diagnose-entries in PostgreSQL (full-text + pg_trgm) → AI formuleert antwoord op basis van díe data. Inclusief chatgeschiedenis en actie-knoppen (onderhoud registreren, km bijwerken, reminder aanmaken). |
| **Slimme signalen** | Deterministische signalen-laag op Home (fase A van het AI-plan, `src/lib/insights.ts`): verbruikstrend (laatste tankbeurt vs. gewogen gemiddelde in 1-op-X), te laat onderhoud, setup-vergelijking en prestatie-daling — met evidence uit de eigen data. AI-verwoording komt in fase B (zie `docs/AI-SLIMMER-PLAN.md`). || **Onderhoud** | Weekoverzicht, interval-gebaseerde schema's (automatisch berekend bij km-registratie), herinneringen, registratiegeschiedenis. 26 onderhoudsitems uit de Excel. Met km-per-week instelling: Home schat de huidige kilometerstand automatisch en voorspelt per taak over hoeveel weken deze verwacht wordt. In te vullen als **km per dag óf km per week** (wordt automatisch omgerekend, ×7/÷7). Elke registratie kan **kosten en gebruikte onderdelen** bevatten; de historie toont de totaalkosten en kan geëxporteerd worden als **officieel onderhoudsboekje** (PDF in verkoopdossier-design: voertuiggegevens, KPI-strip, historietabel en proactieve planning) — handig als bewijs bij verkoop. |
| **Tankbeurten** | Verbruik-log per scooter: kilometerstand, liters, prijs per liter, station. Verbruik wordt getoond als **1 op X (km per liter)** — bijv. "1 op 25" — met L/100km als extra detail; afwijkende metingen (dezelfde/lagere stand = typfout) vervuilen het gemiddelde niet. Met totaal getankte liters en totale brandstofkosten. |
| **Tuning & Afstelhulp** | Setup-registratie (blok, cilinder, carburateur, uitlaat, variateur, …), wijzigingshistoriek, setup-vergelijking **én een afstelhulp**: startafstelling carburateur (hoofdsproeier-range, naaldclip, bougie-hittegraad, powerband-richtpunt), afstelkaart per gasstand, bougie-lezen en CVT-opstelling (rollengewicht, drukveer, snaar, trekveren, powerband) met snelheid-vs-toeren-simulatie, symptoom-diagnose en voorgestelde afstelrichting. |
| **Performance** | Live GPS-meting met veiligheidsflow, snelheidssmoothing, 0–50/0–100-tijden, top-snelheid, grafiek en historiek. |
| **Voertuigen** | Meerdere scooters/brommers, volledige setup per voertuig, km-bijhouden. |
| **Notificaties** | Echte push via expo-notifications (token-registratie via de `register-push-token` Edge Function), in-app meldingen en de dagelijkse server-side herinneringen-job via `pg_cron` (stuurt via de Expo push API, alleen als de gebruiker onderhouds-push aan heeft staan). |
| **Offline** | SQLite-cache + sync-queue voor scooters/setups/onderhoudsregistraties. Op web een localStorage-fallback (SQLite/wasm kan op web hangen). |
| **Auth** | Registreren, inloggen, wachtwoord vergeten, sessie-behoud, onboarding. |

## Technische stack

- **React Native 0.86 + Expo SDK 57 + TypeScript** (strict)
- **React Navigation 7** (bottom-tabs + native stack)
- **Supabase**: Auth, PostgreSQL (RLS overal), Edge Functions (Deno), `pg_cron` + `pg_net`
- **Expo-modules**: location, notifications, sensors, sqlite, device
- **Zod**-validatie (client én Edge Functions)
- **Jest** unit-tests

## Projectstructuur

```
src/
  navigation/      # RootStack + MainTabs, gecentreerde nav-types
  features/        # Schermen per domein (auth, diagnosis, maintenance, …)
  services/        # Supabase-API-wrappers (auth, scooters, chat, …)
  hooks/           # useAuth, useScooters (met offline-cache)
  lib/             # supabase client, env, validation (zod), format
  components/ui/   # Herbruikbare UI-bouwstenen (Button, Card, …)
  theme/           # Donker thema, oranje accent (#F97316)
supabase/
  migrations/      # 7 migrations (schema t/m cron + kosten/tankbeurten)
  functions/       # diagnose-chat, ai-insights, insights-cron, maintenance-reminders, register-push-token, scan-invoice, scan-odometer, verify, delete-account
scripts/
  lib/parse-excel.ts   # Excel → rijen (idempotent via content_hash)
  import-diagnosis.ts  # Import: API-modus of SQL-dump
tests/             # 13 Jest-suites (152 tests)
docs/              # Onderzoeks- en plandocumenten (o.a. AI-SLIMMER-PLAN.md, release-checklist.md)
src/lib/insights.ts # Slimme signalen (fase A van het AI-plan)
```

---

## 1. Ontwikkelinstallatie

```bash
npm install
cp .env.example .env
```

Vul in `.env` **minimaal** de eerste twee waarden in:

```ini
EXPO_PUBLIC_SUPABASE_URL=https://gdjargpxcdgciusycyya.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<je publishable/anon key — Supabase Dashboard → Settings → API>
```

Start de app:

```bash
npm start          # scan de QR met Expo Go (Android/iOS)
npm run android    # of Android-emulator
npm run ios        # of iOS-simulator (macOS)
```

> De app start pas écht zonder waarschuwingen zodra de database is ingericht (stap 2) en de diagnosedata is geïmporteerd (stap 3).

## 2. Supabase-backend inrichten

Vereist: [Supabase CLI](https://supabase.com/docs/guides/cli) en eenmalig `supabase login`.

```bash
supabase link --project-ref gdjargpxcdgciusycyya
supabase db push
```

Dit zet alle 7 migrations neer:

1. `20260924000000_init_schema` — profiles, scooters, setups, settings, triggers, RLS
2. `20260924000100_diagnosis` — diagnose-tabellen, full-text (NL) + pg_trgm-indexen, `search_diagnosis()` RPC
3. `20260924000200_maintenance` — items/schedules/records/reminders + km-triggers
4. `20260924000300_tuning_performance_chat` — tuning, performance (GPS-points als JSONB), chat
5. `20260924000400_notifications` — notificaties (dedupe), push-tokens, auto-profiel-trigger
6. `20260924000500_cron` — `pg_cron` + `pg_net`: dagelijkse herinneringen-job
7. `20261005000000_maintenance_costs_fuel_logs` — kosten + onderdelen bij onderhoudsregistraties, `fuel_logs`-tabel (verbruik) + RLS

**Belangrijk:** de cron-migratie heeft `pg_cron` en `pg_net` nodig. Op het hosted Supabase-project: enable `pg_net` onder Database → Extensions. `pg_cron` is op hosted projecten standaard beschikbaar; als de cron-job er niet staat, run migratie 6 handmatig via de SQL Editor.

**RLS is overal aan**: gebruikers zien en muteren uitsluitend hun eigen rijen; diagnose-tabellen zijn read-only voor ingelogde gebruikers.

## 3. Diagnosedata (Excel) importeren

De bron staat in `scripts/data/Diagonose Fix50.xlsx` (464 diagnose-rijen, 26 onderhoudsitems). Import is **idempotent** op `content_hash` — opnieuw importeren maakt geen duplicaten.

**Optie A — direct via de API (aanbevolen):**

```ini
# .env
SUPABASE_URL=https://gdjargpxcdgciusycyya.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key — alleen lokaal, nooit in de app>
```

```bash
npm run import:diagnosis
```

**Optie B — SQL-dump (zonder service key):**

```bash
npm run import:diagnosis:sql
# genereert supabase/seed/diagnosis_seed.sql
# → plak & run in Supabase Dashboard → SQL Editor
```

Verificatie van de parser (zonder database): `npx tsx scripts/check-parse.ts`

## 4. Edge Functions deployen + secrets

```bash
supabase functions deploy diagnose-chat
supabase functions deploy ai-insights
supabase functions deploy maintenance-reminders
supabase functions deploy register-push-token
```

Server-side secrets (komen **nooit** in de app of in Git):

```bash
supabase secrets set \
  AI_API_KEY=<key van je OpenAI-compatibele provider> \
  AI_API_BASE=https://api.openai.com/v1 \
  AI_MODEL=gpt-4o-mini \
  CRON_SECRET=<sterk zelfverzonnen wachtwoord>
```

En zet het cron-secret in de vault zodat de nachtelijke herinneringen-job zich kan authentiseren (SQL Editor):

```sql
select vault.create_secret('<zelfde CRON_SECRET>', 'cron_secret');
```

### AI-instellingen

De Edge Function praat met elke OpenAI-compatibele API (OpenAI, OpenRouter, Azure, Together, …). Standaard (gratis): `AI_API_BASE=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b` — Groq Cloud, 1.000 requests/dag gratis zonder creditcard. Elke OpenAI-compatibele provider (OpenAI, OpenRouter, Azure, Together, …) werkt ook. De response móét JSON zijn en wordt met zod gevalideerd; bij ongeldige/falende AI-output krijgt de gebruiker een nette DB-gebaseerde fallback (zoekresultaten), nooit een verzonnen diagnose.

**Zonder `AI_API_KEY` werkt de app gewoon**, maar de chatbot geeft dan alleen de DB-gebaseerde fallback-antwoorden.

## 5. Environment variables (overzicht)

| Variabele | Waar | Geheim? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` → app | nee |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` → app | publishable, mag in client |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `.env` → importscript | **ja** — nooit in app/Git |
| `AI_API_KEY`, `AI_API_BASE`, `AI_MODEL` | `supabase secrets` | **ja** |
| `AI_DAILY_USER_LIMIT` | `supabase secrets` (optioneel, default 60/dag) | nee |
| `CRON_SECRET` | `supabase secrets` **+** vault | **ja** |
| `EXPO_ACCESS_TOKEN` | `.env` (EAS) **en** `supabase secrets set` (Expo push voor de herinneringen-job) | ja |

## 6. Tests & typecheck

```bash
npm test        # 13 suites, 152 tests (validatie, GPS, onderhoud, AI-guardrails, Excel-parser, km-voorspelling, tankbeurten & export, PDF-dossiers, slimme signalen, AI-inzichten, afstelmodellen & blokken-kennisbank)
npm run typecheck
```

De AI-guardrail-test verifieert o.a. dat acties zoals `DROP TABLE` of negatieve km geweigerd worden door het actie-schema.

## 7. Productie-build (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # APK voor testen
eas build --platform android --profile production
eas build --platform ios --profile production
```

`app.json` is al ingericht (bundle id `nl.fix50.app`, NL-permission-teksten voor locatie/motion/notificaties, donkere statusbar, logo in `assets/icon.png`).

### Web-versie delen via een publieke link (EAS Hosting)

Een `localhost`-link werkt alleen op je eigen netwerk. Voor een link die je naar anderen kunt sturen:

```bash
eas login                              # één keer inloggen (of EXPO_ACCESS_TOKEN in .env)
eas init                               # koppelt het project (vult extra.eas.projectId)
npx expo export --platform web         # bouwt dist/
eas deploy --prebuilt                  # → https://<project>.expo.app — publieke link
```

Die link werkt overal (ook buiten je eigen wifi) en blijft gelijk: opnieuw deployen updatet dezelfde URL.

## 8. Deployment-checklist

> Voor een desktop-release (EXE bouwen → GitHub-release) is een aparte vaste procedure: [docs/release-checklist.md](docs/release-checklist.md).

- [ ] `supabase db push` → migrations staan op het project (incl. kosten/tankbeurten)
- [ ] `pg_net`-extensie enabled, cron-migratie gecontroleerd
- [ ] `npm run import:diagnosis` → 464 entries + 26 items in de database
- [ ] 10 Edge Functions gedeployed
- [ ] `supabase secrets set AI_API_KEY … CRON_SECRET …` + vault-secret
- [ ] `.env` gevuld met publishable key → `npm start` werkt
- [ ] Test-chat gestuurd → antwoord citeert FIX50-data (check metadata `diagnosis_ids` in het bericht)
- [ ] (optioneel) `eas deploy --prebuilt` → publieke web-link gedeeld

## 9. Troubleshooting

| Probleem | Oplossing |
|---|---|
| `[FIX50] EXPO_PUBLIC_… ontbreken` bij start | `.env` niet aangemaakt of leeg — zie stap 1; herstart `npm start` (env wordt ingebed bij opstarten). |
| `Invalid API key` in de app | Je gebruikt een verlopen/verkeerde key; neem de **publishable** key uit Dashboard → Settings → API. |
| Chatbot geeft "onvoldoende FIX50-data"-antwoorden | Diagnosedata nog niet geïmporteerd (stap 3), of `AI_API_KEY` niet gezet (stap 4) — beide checken. |
| `search_diagnosis does not exist` | Migratie 2 niet gelopen → `supabase db push`. |
| Geen herinneringen om 08:00 | `pg_net` niet enabled, cron-job ontbreekt, of `cron_secret` in de vault mismatched met `supabase secrets`. |
| Push-token registratie faalt | `register-push-token` niet gedeployed, of Expo Go zonder notificatie-permissie. |
| Import geeft auth-fout | `SUPABASE_SERVICE_ROLE_KEY` ontbreekt/verkeerd in `.env` (Optie A) — of gebruik Optie B (SQL-dump). |
| `supabase db push` vraagt om password | Database-password van het project (Dashboard → Settings → Database), niet je account-wachtwoord. |

## Beveiligingsmodel

- Publishable key zit als enige key in de app; alle gevoelige keys zijn Edge-Function-secrets.
- RLS op élke gebruikerstabel; ownership wordt server-side afgedwongen.
- Edge Function `diagnose-chat` authenticeert via `auth.getUser`, checkt scooter-eigenaarschap, limietereert AI-gebruik (60/dag/gebruiker) en slaat berichten op vóór de AI-call.
- Cron-endpoint vereist `CRON_SECRET` als Bearer-token.
- Service key staat alleen lokaal in `.env` (ge-gitignoreerd) voor de import.

</details>
