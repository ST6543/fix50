/**
 * App-brede error boundary in de donkere FIX50-huisstijl.
 *
 * Vangt renderfouten in de hele boom, logt ze centraal met de schermnaam en
 * toont een rustige fallback met "Opnieuw proberen". De kinderen worden niet
 * weggegooid: na een geslaagde herstart rendert dezelfde boom opnieuw.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getActiveScreen } from '@/lib/active-screen';
import { logAppError } from '@/lib/error-log';
import { colors, fonts, layout, radii, spacing, typography } from '@/theme';

interface Props {
  children: React.ReactNode;
  /** Vaste schermnaam voor de log; leeg = de actieve route. */
  screen?: string;
  /** Wordt aangeroepen bij "Opnieuw proberen", vóór het opnieuw renderen. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logAppError(error, this.props.screen ?? getActiveScreen(), info.componentStack ?? undefined);
  }

  private handleRetry = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Alleen de melding tonen, geen stack: die staat in het centrale log.
    const detail = error.message?.trim() || 'Onbekende fout.';

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={typography.eyebrowBrand}>Onverwachte fout</Text>
            <Text style={styles.title}>Dit scherm liep vast</Text>
            <Text style={styles.body}>
              Je gegevens zijn veilig. Probeer het opnieuw; blijft het misgaan, herstart dan de
              app. De fout is met schermnaam vastgelegd voor support.
            </Text>
            <View style={styles.detailBox}>
              <Text style={styles.detail}>{detail}</Text>
              <Text style={styles.detailMeta}>Scherm: {this.props.screen ?? getActiveScreen()}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Opnieuw proberen"
              onPress={this.handleRetry}
              style={({ pressed }) => [styles.retry, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.retryLabel}>Opnieuw proberen</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  card: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: layout.cardPadding + 6,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: spacing.s,
  },
  detailBox: {
    marginTop: spacing.l,
    padding: spacing.m,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  detailMeta: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSubtle,
    marginTop: spacing.s,
  },
  retry: {
    marginTop: spacing.l,
    minHeight: 50,
    borderRadius: radii.m,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.onPrimary,
  },
});
