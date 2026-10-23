/**
 * Import van "Diagonose Fix50.xlsx" naar Supabase.
 *
 * Gebruik:
 *   npm run import:diagnosis
 *   npm run import:diagnosis:sql   (schrijft SQL-seed naar supabase/seed/diagnosis_seed.sql)
 *
 * Idempotent: diagnose-rows worden geüpdatet op content_hash (uniek), zodat een
 * herhaalde import géén duplicaten maakt; gewijzigde rijen worden bijgewerkt.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import { parseDiagnosisRows, parseMaintenanceRows, DiagnosisRow, MaintenanceRow } from './lib/parse-excel';

const SQL_MODE = process.argv.includes('--sql');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Ontbrekende environment variable: ${name}`);
    console.error('   Zet deze in .env (zie .env.example) en gebruik bijv. `npx dotenv-cli` of export handmatig.');
    process.exit(1);
  }
  return v;
}

function sqlQuote(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'null';
  return `'${s.replace(/'/g, "''")}'`;
}

function toSqlKeywords(keywords: string[]): string {
  return `array[${keywords.map((k) => sqlQuote(k)).join(',')}]::text[]`;
}

function diagnosisSql(rows: DiagnosisRow[]): string {
  const values = rows
    .map(
      (r) =>
        `(${sqlQuote(r.category)}, ${sqlQuote(r.engine_type)}, ${sqlQuote(r.problem)}, ${sqlQuote(r.symptoms)}, ${sqlQuote(r.causes)}, ${sqlQuote(r.visual_test)}, ${sqlQuote(r.measurement_test)}, ${sqlQuote(r.road_test)}, ${sqlQuote(r.solution)}, ${toSqlKeywords(r.keywords)}, ${sqlQuote(r.search_text)}, ${sqlQuote(r.severity)}, ${sqlQuote(r.source)}, ${sqlQuote(r.content_hash)})`,
    )
    .join(',\n  ');
  return `-- Gegenereerd door scripts/import-diagnosis.ts --sql. NIET handmatig bewerken.
insert into public.diagnosis_entries
  (category, engine_type, problem, symptoms, causes, visual_test, measurement_test, road_test, solution, keywords, search_text, severity, source, content_hash)
values
  ${values}
on conflict (content_hash) do update set
  category = excluded.category,
  engine_type = excluded.engine_type,
  problem = excluded.problem,
  symptoms = excluded.symptoms,
  causes = excluded.causes,
  visual_test = excluded.visual_test,
  measurement_test = excluded.measurement_test,
  road_test = excluded.road_test,
  solution = excluded.solution,
  keywords = excluded.keywords,
  search_text = excluded.search_text,
  severity = excluded.severity,
  active = true,
  updated_at = now();
`;
}

async function importViaApi(rows: DiagnosisRow[], items: MaintenanceRow[]): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Diagnose-categorieën
  const categories = Array.from(new Set(rows.map((r) => r.category)));
  const { error: catErr } = await supabase
    .from('diagnosis_categories')
    .upsert(
      categories.map((name, i) => ({ name, sort_order: i })),
      { onConflict: 'name' },
    );
  if (catErr) throw catErr;

  // 2) Diagnose-entries: chunked upsert op content_hash
  const CHUNK = 100;
  let imported = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      category: r.category,
      engine_type: r.engine_type,
      problem: r.problem,
      symptoms: r.symptoms,
      causes: r.causes,
      visual_test: r.visual_test,
      measurement_test: r.measurement_test,
      road_test: r.road_test,
      solution: r.solution,
      keywords: r.keywords,
      search_text: r.search_text,
      severity: r.severity,
      source: r.source,
      content_hash: r.content_hash,
    }));
    const { error } = await supabase.from('diagnosis_entries').upsert(chunk, {
      onConflict: 'content_hash',
      defaultToNull: false,
    });
    if (error) throw error;
    imported += chunk.length;
    process.stdout.write(`  diagnose: ${imported}/${rows.length}\r`);
  }
  console.log('');

  // 3) Onderhoudsitems (Excel-sheet "Onderhoud")
  const { error: itemErr } = await supabase
    .from('maintenance_items')
    .upsert(items, { onConflict: 'name' });
  if (itemErr) throw itemErr;

  // 4) Rapportage
  const { count } = await supabase
    .from('diagnosis_entries')
    .select('*', { count: 'exact', head: true });
  console.log(`✅ Import klaar. Diagnose-records in database: ${count}`);
}

async function main(): Promise<void> {
  const diagnosisRows = parseDiagnosisRows();
  const maintenanceRows = parseMaintenanceRows();
  console.log(
    `Geparseerd: ${diagnosisRows.length} diagnose-rijen, ${maintenanceRows.length} onderhoudsitems.`,
  );

  if (diagnosisRows.length === 0) {
    console.error('❌ Geen diagnose-rijen gevonden — controleer de Excel.');
    process.exit(1);
  }

  if (SQL_MODE) {
    const outDir = path.join(__dirname, '..', 'supabase', 'seed');
    fs.mkdirSync(outDir, { recursive: true });
    const sql = diagnosisSql(diagnosisRows);
    const outPath = path.join(outDir, 'diagnosis_seed.sql');
    fs.writeFileSync(outPath, sql, 'utf8');
    console.log(`✅ SQL-seed geschreven naar ${outPath}`);
    return;
  }

  await importViaApi(diagnosisRows, maintenanceRows);
}

main().catch((err) => {
  console.error('❌ Import mislukt:', err instanceof Error ? err.message : err);
  process.exit(1);
});
