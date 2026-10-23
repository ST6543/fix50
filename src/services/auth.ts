/**
 * Authenticatie-service rond Supabase Auth — alleen e-mailadres + wachtwoord.
 *
 * Waterdicht gemaakt:
 * - Na registreren wordt de gebruiker meteen ingelogd (fallback signIn als
 *   Supabase geen sessie teruggeeft).
 * - Duidelijke Nederlandse foutmeldingen voor elke bekende fout.
 */
import { AppError } from './api';
import { supabase } from './api';
import { env } from '@/lib/env';

export async function signUp(email: string, password: string, displayName: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || cleanEmail.length < 6) {
    throw new AppError('Vul een geldig e-mailadres in (bijv. jij@voorbeeld.nl).');
  }
  if (displayName.trim().length < 2) {
    throw new AppError('Vul je naam in (minimaal 2 tekens).');
  }
  if (password.length < 6) {
    throw new AppError('Gebruik minimaal 6 tekens voor je wachtwoord.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw new AppError(signUpError(error.message));

  // Direct ingelogd na registreren. Bevestigingsmails staan uit; als Supabase
  // om welke reden dan ook geen sessie teruggeeft, loggen we alsnog in.
  if (!data.session) {
    await signIn(cleanEmail, password);
  }
  return data.user;
}

export async function signIn(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new AppError('Vul je e-mailadres in.');
  if (!password) throw new AppError('Vul je wachtwoord in.');

  const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw new AppError(signInError(error.message));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new AppError('Kon niet uitloggen. Probeer het opnieuw.');
}

export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) throw new AppError('Vul een geldig e-mailadres in.');
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
  if (error) throw new AppError('Kon geen herstelmail versturen. Probeer het later opnieuw.');
}

export async function updatePassword(newPassword: string) {
  if (newPassword.length < 6) throw new AppError('Gebruik minimaal 6 tekens voor je wachtwoord.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new AppError('Kon wachtwoord niet wijzigen. Probeer het opnieuw.');
}

/** Verwijdert het account incl. alle eigen data (cascade via FK's) + foto's. */
export async function deleteAccount(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Je bent uitgelogd. Log opnieuw in.');

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new AppError('Geen internetverbinding — account verwijderen werkt alleen online.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? 'Kon het account niet verwijderen. Probeer het opnieuw.');
  }
  // Server-side verwijderd; lokale cache + sessie opruimen (doet de caller).
}

function configError(): string {
  return (
    'Verbinding met de server mislukt (ongeldige API-key). ' +
    'Kopieer de publishable key opnieuw van Supabase → Project Settings → API Keys naar .env ' +
    'en herstart de app.'
  );
}

function signUpError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid api key') || m.includes('invalid key') || m.includes('401')) return configError();
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Dit e-mailadres is al in gebruik. Log in, of ga terug en gebruik "Wachtwoord vergeten?".';
  }
  if (m.includes('password') && m.includes('short')) {
    return 'Je wachtwoord is te kort. Gebruik minimaal 6 tekens.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('429')) {
    return 'Even geduld: er zijn te veel aanmeldingen. Wacht een minuutje en probeer het opnieuw.';
  }
  if (m.includes('invalid')) {
    return 'Dit e-mailadres wordt niet geaccepteerd. Controleer de spelling (bijv. jouwnaam@gmail.com).';
  }
  if (m.includes('network')) return 'Geen internetverbinding. Probeer het later opnieuw.';
  return 'Registreren mislukt. Probeer het opnieuw.';
}

function signInError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid api key') || m.includes('invalid key') || m.includes('401')) return configError();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'E-mailadres of wachtwoord is onjuist.';
  }
  if (m.includes('not confirmed')) {
    return 'Bevestig eerst je e-mailadres via de mail die je hebt gekregen. Check ook je spammap.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('429')) {
    return 'Te veel pogingen. Wacht een minuutje en probeer het opnieuw.';
  }
  if (m.includes('network')) return 'Geen internetverbinding. Probeer het later opnieuw.';
  return 'Inloggen mislukt. Probeer het opnieuw.';
}
