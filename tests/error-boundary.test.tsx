/**
 * App-brede error boundary: donkere fallback, centrale log met schermnaam en
 * "Opnieuw proberen" dat dezelfde boom opnieuw rendert.
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ErrorBoundary from '@/components/error-boundary';
import { clearAppErrors, recentAppErrors } from '@/lib/error-log';
import { setActiveScreen } from '@/lib/active-screen';

let boom = true;

function Risky() {
  if (boom) throw new Error('kapot scherm');
  return <Text>hersteld</Text>;
}

let spy: jest.SpyInstance;

beforeEach(() => {
  boom = true;
  clearAppErrors();
  setActiveScreen('Home');
  // React logt de gevangen fout ook; die ruis dempen we.
  spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  spy.mockRestore();
  setActiveScreen(null);
});

describe('ErrorBoundary', () => {
  it('toont de donkere fallback met de schermnaam en logt centraal', () => {
    render(
      <ErrorBoundary>
        <Risky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Dit scherm liep vast')).toBeTruthy();
    expect(screen.getByText('kapot scherm')).toBeTruthy();
    expect(screen.getByText('Scherm: Home')).toBeTruthy();
    expect(recentAppErrors()[0]).toMatchObject({ screen: 'Home', message: 'kapot scherm' });
  });

  it('rendert na "Opnieuw proberen" de kinderen opnieuw', () => {
    render(
      <ErrorBoundary>
        <Risky />
      </ErrorBoundary>,
    );

    boom = false;
    fireEvent.press(screen.getByLabelText('Opnieuw proberen'));

    expect(screen.getByText('hersteld')).toBeTruthy();
    expect(screen.queryByText('Dit scherm liep vast')).toBeNull();
  });

  it('gebruikt een vaste schermnaam als die is meegegeven', () => {
    render(
      <ErrorBoundary screen="Werkplaats">
        <Risky />
      </ErrorBoundary>,
    );

    expect(recentAppErrors()[0]?.screen).toBe('Werkplaats');
    expect(screen.getByText('Scherm: Werkplaats')).toBeTruthy();
  });

  it('roept onReset aan vóór het opnieuw renderen', () => {
    const onReset = jest.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Risky />
      </ErrorBoundary>,
    );

    boom = false;
    fireEvent.press(screen.getByLabelText('Opnieuw proberen'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
