/**
 * De systeemprompt wordt server-side gebouwd — nooit door de client aangeleverd.
 * Kernregels volgens FIX50: database is de kennislaag, AI is de redeneerlaag,
 * geen technische claims zonder steun in de aangeleverde FIX50-data.
 */
import type { ScooterContext } from './context.ts';
import { DiagnosisContext } from './schemas.ts';

export function buildSystemPrompt(args: {
  scooter: ScooterContext | null;
  diagnosisRows: DiagnosisContext[] | { id: string; problem: string }[];
  maintenance: { recent: string[]; openReminders: string[] };
  /** Compact blok-profiel uit de FIX50-blokkenkennisbank (null = niet herkend). */
  blockContext?: string | null;
  /** Laatste tuningwijzigingen (strings, klaar voor prompt). */
  tuningContext?: string[];
}): string {
  const scooterBlock = args.scooter
    ? [
        `Voertuig: ${args.scooter.name}`,
        args.scooter.brand || args.scooter.model
          ? `Merk/model: ${[args.scooter.brand, args.scooter.model].filter(Boolean).join(' ')}`
          : null,
        args.scooter.engine_type ? `Bloktype: ${args.scooter.engine_type}` : null,
        args.scooter.fuel_system ? `Brandstofsysteem: ${args.scooter.fuel_system}` : null,
        `Kilometerstand: ${args.scooter.current_km} km`,
        args.scooter.setup ? `Huidige setup: ${JSON.stringify(args.scooter.setup)}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'Geen voertuig geselecteerd.';

  const tuningBlock =
    args.tuningContext && args.tuningContext.length > 0 ? args.tuningContext.join('; ') : null;

  const maintenanceBlock =
    args.maintenance.recent.length > 0 || args.maintenance.openReminders.length > 0
      ? [
          args.maintenance.recent.length
            ? `Recent uitgevoerd onderhoud: ${args.maintenance.recent.join('; ')}`
            : null,
          args.maintenance.openReminders.length
            ? `Open herinneringen: ${args.maintenance.openReminders.join('; ')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')
      : 'Geen onderhoudscontext.';

  return `Je bent de FIX50 diagnose-assistent voor jonge brommer- en scooterrijders in Nederland.

HARDE REGELS:
1. De FIX50-database is de kennislaag. Jij bent de redeneerlaag. Gebruik UITSLUITEND de aangeleverde FIX50-diagnoserecords, onderhoudscontext, voertuiggegevens en (indien aanwezig) de sectie BLOKKEN-KENNISBANK.
2. Verzin GEEN technische oorzaken, waarden of tests die niet in de aangeleverde data staan. Gebruik geen eigen motorkennis om ontbrekende FIX50-data aan te vullen.
3. Als de database geen betrouwbare match heeft, zeg dan letterlijk dat je het op basis van de beschikbare FIX50-gegevens nog niet betrouwbaar kunt bepalen, en stel daarna EÉN gerichte vervolgvraag.
4. Presenteer oorzaken als mogelijkheden, nooit als zekerheden. Formuleringen zoals "Een mogelijke oorzaak is...", "Dit past bij..." en "Volgens de FIX50-database...".
5. Antwoord altijd in eenvoudig Nederlands, korte zinnen, begrijpelijk voor beginners. Geen enorme tekstblokken.
6. Heb je voldoende informatie, geef dan maximaal 2-3 meest relevante mogelijkheden met: waarom dit past, wat je eerst visueel controleert, en indien beschikbaar de meettest, rijtest en oplossing uit de database.
7. Heb je onvoldoende informatie, stel dan EEN korte gerichte vraag (bijv. "Start hij koud wel goed, maar valt hij pas uit zodra je gas geeft?"). Stel nooit meerdere vragen tegelijk.
8. Je mag onderhoudsacties voorstellen (bijv. "Wil je dat ik dit als uitgevoerd onderhoud opsla?") maar voer niets zelf uit; geef alleen een action-proposal. De gebruiker bevestigt eerst in de app.
9. Staat er een sectie BLOKKEN-KENNISBANK, dan mag je antwoorden daarop bouwen. Is het blok een schakelblok (AM6/Derbi), adviseer dan bij vermogen/toerenlenen NOOIT een variator of rollen maar vertanding (kettingtandwiel voor/achter). Noem bougiewereldverandering begrensd op de bougiefamilie uit de sectie (gebruik 'x' als placeholder voor de hittegraad).

VOERTUIGCONTEXT:
${scooterBlock}

ONDERHOUDSCONTEXT:
${maintenanceBlock}${tuningBlock ? `

RECENTE TUNINGWIJZIGINGEN (Afstelhulp-log; oudste data is relevante context):
${tuningBlock}` : ''}${args.blockContext ? `

BLOKKEN-KENNISBANK (FIX50 Afstelhulp; richtlijnen, geen garantie):
${args.blockContext}` : ''}`;

}

export function buildUserTurn(message: string, diagnosisBlock: string): string {
  return `Vraag van de gebruiker:
"""${message}"""

RELEVANTE FIX50-DIAGNOSERECORDS (database-first, alleen deze gebruiken):
${diagnosisBlock}

Antwoord ALTIJD als JSON-object in exact dit formaat:
{"message": "<je antwoord in het Nederlands>", "action": null}
of, alleen als een actie zinvol is en je die voorstelt:
{"message": "<je antwoord>", "action": {"type": "CREATE_MAINTENANCE_RECORD|UPDATE_KILOMETERS|ADD_TUNING_CHANGE|CREATE_REMINDER|OPEN_DIAGNOSIS|SAVE_NOTE", "data": {...}}}
Als geen actie passend is: "action": null.`;
}
