/** Sanity-check van de Excel-parser: telt rijen en toont steekproeven. Run: npx tsx scripts/check-parse.ts */
import { parseDiagnosisRows, parseMaintenanceRows } from './lib/parse-excel';

const diagnosis = parseDiagnosisRows();
const maintenance = parseMaintenanceRows();

console.log(`Diagnose-rijen  : ${diagnosis.length}`);
console.log(`Onderhoudsrijen : ${maintenance.length}`);

console.log('\nSteekproef diagnose (eerste 3):');
for (const r of diagnosis.slice(0, 3)) {
  console.log(` - [${r.category}] ${r.engine_type}: ${r.problem} (${r.severity})`);
}

console.log('\nSteekproef onderhoud (eerste 3):');
for (const r of maintenance.slice(0, 3)) {
  console.log(
    ` - ${r.name}: ${r.interval_km_min ?? '—'}–${r.interval_km_max ?? '—'} km · 2T=${r.applies_2t} 4T=${r.applies_4t} injectie=${r.applies_injectie}`,
  );
}
