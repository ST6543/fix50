// Genereert src/lib/pdf-brand.ts: de base64-assets voor de PDF-huisstijl.
// - Space Grotesk TTF's (uit @expo-google-fonts, dezelfde als de app gebruikt)
// - FIX50-logo (assets/logo.png) voor de merkband in de kop
// Run: npm run pdf:brand
import { readFileSync, writeFileSync } from 'node:fs';

const FONTS = [
  ['SPACE_GROTESK_REGULAR_BASE64', 'node_modules/@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf'],
  ['SPACE_GROTESK_BOLD_BASE64', 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'],
];

let out = `/**
 * Gegenereerd door scripts/gen-pdf-brand.mjs — NIET handmatig bewerken.
 * Base64-assets voor de PDF-huisstijl (meegewogen in src/lib/pdf.ts):
 * - Space Grotesk TTF's → @font-face 'FIX50 Grotesk' in de documentkoppen
 * - FIX50-logo (assets/logo.png) → merkband linksboven
 * Opnieuw genereren: npm run pdf:brand
 */
`;

for (const [name, path] of FONTS) {
  try {
    const buf = readFileSync(path);
    out += `export const ${name} = '${buf.toString('base64')}';\n`;
    console.log(`  ✓ ${name}: ${(buf.length / 1024).toFixed(0)} KB ttf`);
  } catch {
    console.error(`Font niet gevonden: ${path}. Installeer @expo-google-fonts/space-grotesk.`);
    process.exit(1);
  }
}

// Logo: optioneel — ontbreekt het, dan valt de PDF terug op de typografische
// merklockup (geen harde fout).
try {
  const logo = readFileSync('assets/logo.png');
  out += `\n/** FIX50-logo (assets/logo.png) als base64-PNG; '' betekent "niet aanwezig". */\nexport const LOGO_PNG_BASE64 = '${logo.toString('base64')}';\n`;
  console.log(`  ✓ LOGO_PNG_BASE64: ${(logo.length / 1024).toFixed(0)} KB png`);
} catch {
  out += `\n/** FIX50-logo niet gevonden bij generatie; '' = typografische fallback. */\nexport const LOGO_PNG_BASE64 = '';\n`;
  console.warn('  ! assets/logo.png ontbreekt — PDF gebruikt de typografische merklockup.');
}

writeFileSync('src/lib/pdf-brand.ts', out);
console.log('src/lib/pdf-brand.ts geschreven.');
