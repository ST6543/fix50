# FIX50 — Supabase-deploy-stappenplan (productie, volgorde = recept)

Alle commando's uit te voeren vanaf de projectroot, met de Supabase CLI (v1.x) ingelogd op het juiste project.

**Check vooraf:** `npx supabase projects list` → zie je je project? Dan zit je goed. Zo niet, eerst `npx supabase login`.

---

## Stap 1 — Database-migraties draaien

```bash
npx supabase db push
```

Dit draait alle migraties in `supabase/migrations/` in volgorde, inclusief:
- `20260924000000_init_schema.sql` — basistabellen (scooters, onderhoud, tuning, …)
- `20260924000400_notifications.sql` — `notifications` + `push_tokens` + RLS
- `20261007000000_scooter_photo_storage.sql` — de `scooter-photos`-bucket + policies

**Verificatie:** run hierna in de SQL-editor (dashboard → SQL):

```sql
select id, public from storage.buckets where id = 'scooter-photos';
```

Moet precies één rij geven met `public = true`. Zo niet — dan is de migratie niet gelopen; check de output van `db push` op fouten.

## Stap 2 — Secrets zetten (server-side, nooit in git)

```bash
npx supabase secrets set AI_API_KEY=jouw_api_key
npx supabase secrets set AI_MODEL=gpt-4o-mini            # of je alternatieve model
npx supabase secrets set AI_VISION_MODEL=gpt-4o-mini     # voor scan-invoice
npx supabase secrets set EXPO_ACCESS_TOKEN=jouw_expo_access_token   # voor push via exp.host
```

- `AI_API_KEY` — van je OpenAI-compatibele provider. **Nooit in de app-binary.**
- `EXPO_ACCESS_TOKEN` — van [expo.dev/accounts/<jij>/settings/access-tokens](https://expo.dev). Hiermee mag de Edge Function pushen via `exp.host`. Zonder deze werkt push-herinneringen niet.
- `AI_API_BASE` is alleen nodig bij een niet-OpenAI-provider (default `https://api.openai.com/v1`).

**Verificatie:** `npx supabase secrets list` toont de namen (niet de waarden).

## Stap 3 — Edge Functions deployen

```bash
npx supabase functions deploy scan-invoice --no-verify-jwt=false
npx supabase functions deploy diagnose-chat
npx supabase functions deploy delete-account
npx supabase functions deploy maintenance-reminders
npx supabase functions deploy register-push-token
npx supabase functions deploy verify
```

**Verificatie per functie** (vervang PROJECTREF door je project-ref):

```bash
# register-push-token: zonder auth moet 'Niet ingelogd' terugkomen
curl -X POST "https://PROJECTREF.supabase.co/functions/v1/register-push-token" \
  -H "Content-Type: application/json" -d '{}' -i | head -1

# scan-invoice: zonder auth moet 'Niet ingelogd' (401)
curl -X POST "https://PROJECTREF.supabase.co/functions/v1/scan-invoice" \
  -H "Content-Type: application/json" -d '{}' -i | head -1

# verify: is publiek — moet 200 en HTML teruggeven
curl -i "https://PROJECTREF.supabase.co/functions/v1/verify?voertuig=TEST" | head -1
```

Verwacht: `HTTP/2 401` voor de privé-functies, `HTTP/2 200` voor verify.

## Stap 4 — Cron voor onderhoudsherinneringen

De `maintenance-reminders`-functie moet periodiek draaien (bijv. dagelijks). Twee opties:

**A. Via `pg_cron` (aanbevolen, binnen de database):**

```sql
select cron.schedule(
  'fix50-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url:='https://PROJECTREF.supabase.co/functions/v1/maintenance-reminders',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || auth_key  -- service_role key via vault of literal
    ),
    body:='{}'::jsonb
  );
  $$
);
```

Run dit één keer in de SQL-editor. Zorg dat de service_role-key niet in de query-log komt: stop de key in Vault (`vault	table secret`) en gebruik een lookup.

**B. Via een externe cron (bijv. GitHub Actions, cron-job.org):** laat elke nacht een POST op `…/functions/v1/maintenance-reminders` met de service-role-key als Bearer-token.

**Verificatie:** de volgende ochtend → in de SQL-editor `select * from notifications order by created_at desc limit 5;` en zie je (als er reminders vervallen) nieuwe rijen.

## Stap 5 — End-to-end rooktest

1. Registreer een vers test-account in de app (of via `npx supabase auth admin create-user`).
2. Voeg een scooter toe, upload een foto → check in dashboard → Storage → `scooter-photos` of het bestand erin staat.
3. Registreer onderhoud; check dat in `notifications` een rij verschijnt als een interval in beeld is.
4. Chat: stel een diagnosevraag → check dat `diagnose-chat` een response geeft (geen 503; dat betekent ontbrekende `AI_API_KEY`).
5. `delete-account` — verwijder het test-account volledig. Play-review checkt deze flow handmatig, dus hij moet écht werken.

---

## Bekende valkuilen

| Symptoom | Oorzaak | Fix |
|----------|---------|-----|
| scan-invoice geeft 503 "niet geconfigureerd" | `AI_API_KEY` ontbreekt | Stap 2 herhalen |
| diagnose-chat 502 met `AI_error` | provider wijst key/model af | model checken in `secrets list`, `AI_MODEL` aanpassen |
| Foto-upload "bucket bestaat niet" | migratie niet gedraaid | Stap 1 herhalen, check `buckets`-query |
| Push komt niet aan | token is FCM i.p.v. ExpoPushToken, of geen `EXPO_ACCESS_TOKEN` | app-code stuurt nu altijd ExpoPushToken; check Stap 2 |
| Reminders lopen niet | cron ontbreekt | Stap 4 |
| verify geeft 500 | verkeerde query of ontbrekende tabel | migraties opnieuw pushen, functioneel log checkt |

Na deze vijf stappen is de backend gereed voor de Play-review.
