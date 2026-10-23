/** Environment configuratie — geen defaults met echte keys, alles via env. */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Hard falen bij een verkeerde setup, zodat de app nooit stilletjes zonder backend draait.
  // In Expo worden EXPO_PUBLIC_* tijdens build/bundling ingebed.
  // eslint-disable-next-line no-console
  console.warn(
    '[FIX50] EXPO_PUBLIC_SUPABASE_URL en/of EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ontbreken. ' +
      'Kopieer .env.example naar .env en vul de waarden in.',
  );
}

export const env = {
  supabaseUrl: url ?? '',
  supabasePublishableKey: key ?? '',
} as const;
