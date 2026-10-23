/**
 * FIX50 design system — Stitch: koolzwart met neutrale zinc-grijstinten,
 * racing-oranje #FF6B00 als enige accentkleur.
 * Typografie: Space Grotesk (display, cijfers) + Inter (body).
 * Kleur is semantisch: oranje = interactie/accent, rood/groen/geel alléén status.
 */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const colors = {
  background: '#0C0D0F',
  surface: '#121417',
  surfaceAlt: '#17191E',
  surfaceHigh: '#1D2026',
  border: '#252830',
  borderSoft: '#1F2228',
  text: '#E6E8EB',
  textMuted: '#9BA1AB',
  textSubtle: '#6B7280',
  primary: '#FF6B00',
  primaryLight: '#FF7A00',
  primaryDim: '#D65900',
  primarySubtle: 'rgba(255,107,0,0.12)',
  primaryBorder: 'rgba(255,107,0,0.35)',
  onPrimary: '#0C0D0F',
  danger: '#EF4444',
  dangerDim: '#7F1D1D',
  success: '#22C55E',
  warning: '#FACC15',
  info: '#38BDF8',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '600' as const,
    color: colors.text,
    letterSpacing: -0.2,
  },
  subheading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15.5,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  metric: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -0.5,
  },
  /** Kleine uppercase labels boven secties en stats (Stitch-signatuur). */
  eyebrow: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  eyebrowBrand: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  /** Cijfers in tiles en readouts — display-font, strak getracked. */
  stat: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -0.3,
  },
} as const;

export const radii = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const;

export const theme = { colors, spacing, typography, radii, shadows, fonts };
export type Theme = typeof theme;
