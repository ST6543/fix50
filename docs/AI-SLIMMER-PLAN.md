# FIX50 — "AI die meekijkt": onderzoek & implementatieplan

> **Vraag:** kan de app slimmer worden met een AI die actief meekijkt (proactief),
> in plaats van alleen te antwoorden als je iets vraagt?
>
> **Kort antwoord:** ja — en het meeste nut zit niet in een groter model, maar in
> een **signalen-laag** die de bestaande data (onderhoud, tankbeurten, metingen,
> tuning) continu doorrekent. De AI verwoordt en prioriteert die signalen; de
> cijfers komen altijd uit de database. Dat is sneller, gratis en betrouwbaarder
> dan een model laten "vrij kijken".

---

## 1. Uitgangspunten (sluit aan op het bestaande kernprincipe)

De app heeft al een bewezen architectuur: **database = kennislaag, AI = redeneerlaag,
Edge Function = beveiligde tussenlaag**. De AI verzint nooit een diagnose; zonder
FIX50-data zegt de chatbot dat eerlijk.

Een "meekijkende AI" moet dezelfde regel volgen:

1. **Eerst rekenen, dan praten.** Signalen (trends, afwijkingen, verwachte
   onderhoudsmomenten) worden deterministisch berekend — geen model nodig.
2. **AI alleen voor taal en prioriteit.** Het model krijgt de berekende signalen
   + relevante diagnose-entries en maakt er een korte, persoonlijke tip van,
   met bronverwijzing (`diagnosis_ids`) zoals de chatbot nu al doet.
3. **Nooit ongevraagd pushen zonder grond.** Een melding komt alleen als een
   concreet signaal de drempel haalt (bijv. verbruik >15% verslechterd).
4. **Werkt ook zonder AI-key.** Zonder `AI_API_KEY` blijft de signalen-laag
   volledig functioneren; alleen de "verwoording" valt terug op vaste teksten.

---

## 2. Wat de data nu al kan vertellen (signalen-laag, géén AI)

Alle data is aanwezig in Supabase: `maintenance_records` + `maintenance_schedules`
+ `maintenance_items` (26 items, intervallen), `fuel_logs`, `performance_runs`
(GPS-punten, 0–50/0–80/topsnelheid), `tuning_changes` + `tuning_setups`.

| Signaal | Berekening (puur, unit-testbaar) | Voorbeeldmelding |
|---|---|---|
| **Verbruikstrend** | Laatste tankbeurt(en) vs. gewogen gemiddelde in km/L (de nieuwe "1 op X") | "Je scooter rijdt nu 1 op 21 i.p.v. 1 op 25 — 16% onzuiniger. Vaak: luchtfilter, bougie of sproeier." |
| **Onderhoudsvoorspelling** | Bestaat al: `buildWeekForecast()` met km/week | "Oliewissel over ~3 weken (17.500 km)" |
| **Kosten per km** | Totale kosten ÷ gereden km sinds eerste registratie | "Je onderhoud kost nu €0,031/km" |
| **Meetafwijking** | Nieuwe GPS-run vs. beste run van dezelfde setup | "0–50 was 0,6s trager dan je beste meting — koppeling/rollen checken?" |
| **Setup-effect** | Runs gegroepeerd per `setup_id`, gemiddelden vergelijken | "Met setup Sport rijd je 0,4s sneller 0–50 dan Origineel" |
| **Stilstand** | Dagen sinds laatste km-update vs. gemiddeld gebruik | "Je scooter staat 6 weken stil — accu en bandenspanning checken" |

Statistische onderbouwing: voor dit soort kleine tijdreeksen (5–30 meetpunten per
scooter) zijn eenvoudige methodes zoals **voortschrijdend gemiddelde + drempel**
(bijv. 15% afwijking) en **z-score** de juiste keuze. Machine learning of
auto-encoders zijn pas zinvol bij honderden voertuigen; voor één gebruiker
leveren ze vooral ruis en valse meldingen op.

**Concreet:** nieuwe module `src/lib/insights.ts` met pure functies
(`detectFuelTrend(stats)`, `detectPerformanceDrop(runs)`, `setupComparison(runs)`, …)
die een lijst `Insight[]` teruggeven: `{ kind, severity, title, detail, evidence }`.
Volledig offline, direct testbaar met Jest — past bij de bestaande aanpak
(73 → ~90 tests).

---

## 3. Waar AI écht iets toevoegt

De signalen-laag is een rekenmachine. De AI maakt het verschil bij:

1. **Prioriteren en verwoorden** — meerdere signalen tegelijk ("verbruik stijgt"
   + "V-snaar-interval nadert" + "meting trager") combineren tot één advies in
   gewone taal, afgestemd op het bloktype (AM6, i-Get, …) en de setup.
2. **Diagnose koppelen** — de 464 diagnose-entries doorzoeken (full-text +
   pg_trgm, bestaat al) op basis van de signalen en de best passende oorzaken
   citeren. Dat is precies wat `diagnose-chat` al doet, maar dan getriggerd
   door data in plaats van door een vraag.
3. **Vervolgvragen** — "waarom stijgt mijn verbruik?" moet de AI kunnen
   beantwoorden met de al berekende context (nu begint elk gesprek zonder
   scooter-context).

Implementatie: **Edge Function `ai-insights`** (nieuw), die per gebruiker:
- de laatste signalen ophaalt (uit de app of server-side herberekend),
- relevante diagnose-entries zoekt via de bestaande `search_diagnosis()` RPC,
- het model (Groq, OpenAI-compatibel, `AI_MODEL`) om **JSON** vraagt,
- valideert met zod (bestaat al in `supabase/functions/_shared`),
- resultaat opslaat in een nieuwe tabel `ai_insights` (dedupe op signaal-hash),
- optioneel een push stuurt via de bestaande notificatie-infrastructuur.

**Kosten & limieten:** Groq gratis tier (1.000 req/dag) is ruim voldoende.
Omdat inzichten gecachet worden op signaal-hash, kost het openen van de app
**nul** extra AI-calls. De bestaande `AI_DAILY_USER_LIMIT` (60/dag) blijft als
vangnet. De wekelijkse `pg_cron`-job kan 's nachts de inzichten verversen —
dezelfde job die al herinneringen stuurt.

---

## 4. On-device of cloud?

Onderzoek naar de actuele trade-offs (2025–2026):

- **On-device LLM's** (bijv. via ExecuTorch/MediaPipe): privacy, offline, geen
  API-kosten — maar 1–3 GB modelgeheugen, batterijgebruik, langzame eerste
  inferentie en een complexe model-lifecycle. Voor korte taken haalbaar, voor
  een Nederlandse diagnose-assistent met domeinkennis niet praktisch.
- **Cloud (huidige aanpak)** is beter voor kwaliteit, context en onderhoud.
  De gevoelige data blijft beperkt tot **samengevatte getallen** (geen
  GPS-routes, geen VIN/kenteken naar het model) — dat is een bewuste,
  uitlegbare keuze in de privacyverklaring.

**Advies:** cloud houden, maar de *signalen* lokaal berekenen. Dat combineert
snelheid/privacy (rekenen op het toestel) met taalvaardigheid (AI in de cloud).
On-device LLM is voorlopig een oplossing zonder probleem in deze app.

---

## 5. Gefaseerd plan

| Fase | Wat | Waarom eerst | Inspanning |
|---|---|---|---|
| **A. Signalen-laag** | `src/lib/insights.ts` + "Slimme signalen"-kaart op Home + tests | Gratis, offline, direct nuttig; geen backend-wijziging | klein |
| **B. AI-verwoording** | `ai_insights`-tabel + Edge Function `ai-insights` + cache + dagelijkse/weekelijkse job | Maakt van cijfers begrijpelijk advies; gebruikt bestaande Groq-key en guardrails | middel |
| **C. Correlaties** | Setup-vergelijking en meet-trends in inzichten + push bij verslechtering | Uniek t.o.v. concurrenten; vereist fase A-signalen | middel |
| **D. Vision (later)** | Foto → km-stand uitlezen bij tankbeurt; foto → onderdeel herkennen | Mooie UX-winst, maar duurder per call en foutgevoelig; pas na A–C | groot |

### Aanbevolen eerste stap

Fase A + het verbruikssignaal, want:
- sluit direct aan op het nieuwe **1-op-X**-verbruik (drempel: <85% van gemiddelde),
- geen nieuwe infra, geen kosten, volledig testbaar,
- en het levert de data-structuur (`Insight[]`) waar fase B op voortbouwt.

---

## 6. Guardrails (verplicht bij implementatie)

- **DB-first:** elk inzicht verwijst naar `evidence` (meting, tankbeurt of
  diagnose-id); geen advies zonder onderbouwing.
- **Geen medische/technische stelligheid:** formuleer als "vaak voorkomende
  oorzaak — controleer X", nooit als vaststaande diagnose.
- **Rate limit + cache:** `AI_DAILY_USER_LIMIT` blijft; insights gecachet op
  hash van de onderliggende data.
- **Fallback:** zonder AI-key of bij API-fout toont de app de vaste
  signaaltekst (laag 1) — nooit een leeg scherm.
- **Privacy:** alleen samengevatte cijfers naar het model; geen ruwe GPS-routes,
  geen kenteken/VIN, geen e-mailadres.
- **Kill switch:** instelling "AI meekijken aan/uit" in `user_settings`
  (naast de bestaande push/onderhoud-instellingen).

---

## 7. Conclusie

De app kan aanzienlijk slimmer worden **zonder** een groter of duurder model:
de grootste winst zit in een deterministische signalen-laag die continu
meekijkt, en een AI die die signalen prioriteert en in gewone taal uitlegt met
verwijzing naar de FIX50-diagnosedatabase. On-device LLM's zijn voor deze
gebruikssituatie (kleine gebruikersschaal, NL-domeinkennis, kosten) nog niet de
moeite; de bestaande cloud-opzet met Groq is toereikend en schaalbaar.

*Bronnen (selectie):* N-IX gids AI predictive maintenance (2026) — anomaliedetectie
vs. faalvoorspelling; Tinybird/QuestDB — eenvoudige statistiek (voortschrijdend
gemiddelde, z-score) voor tijdreeksen; OpenForge (dec. 2025) en arXiv-onderzoek
naar on-device vs. cloud-LLM trade-offs (geheugen, batterij, lifecycle).
