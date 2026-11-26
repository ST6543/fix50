/**
 * Render-tests voor de UI-kit: de bouwstenen die elk scherm gebruikt.
 * Faalt een redesign hier, dan breekt de test — niet pas het scherm.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Badge, Button, Card, SegmentSwitch } from '@/components/ui';
import { colors } from '@/theme';

describe('Card', () => {
  it('toont de inhoud', () => {
    render(
      <Card>
        <Text>Onderhoudsplan</Text>
      </Card>,
    );

    expect(screen.getByText('Onderhoudsplan')).toBeTruthy();
  });

  it('is aan te tikken als er een onPress is', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress}>
        <Text>Openen</Text>
      </Card>,
    );

    fireEvent.press(screen.getByText('Openen'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Button', () => {
  it('toont het label en geeft de tik door', () => {
    const onPress = jest.fn();
    render(<Button label="Opslaan" onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('Opslaan'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('staat uit bij disabled en vuurt dan niet', () => {
    const onPress = jest.fn();
    render(<Button label="Opslaan" onPress={onPress} disabled />);

    const button = screen.getByLabelText('Opslaan');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('toont een spinner in plaats van het label tijdens laden', () => {
    render(<Button label="Opslaan" onPress={jest.fn()} loading />);

    expect(screen.queryByText('Opslaan')).toBeNull();
  });
});

describe('Badge', () => {
  it('kleurt het label per toon', () => {
    render(<Badge label="Te laat" tone="danger" />);

    const label = screen.getByText('Te laat');
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.danger);
  });

  it('toont een stip als dot is aangezet', () => {
    const { UNSAFE_root } = render(<Badge label="In orde" tone="success" dot />);

    // Badge bestaat uit de container, het stipje en het label; zonder stip één View minder.
    expect(UNSAFE_root.findAllByType(View)).toHaveLength(2);
  });
});

describe('SegmentSwitch', () => {
  const segments = [
    { key: 'onderhoud' as const, label: 'Onderhoud' },
    { key: 'diagnose' as const, label: 'Diagnose' },
  ];

  it('markeert het actieve segment', () => {
    render(<SegmentSwitch segments={segments} value="onderhoud" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Onderhoud').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText('Diagnose').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('geeft de keuze door bij een tik', () => {
    const onChange = jest.fn();
    render(<SegmentSwitch segments={segments} value="onderhoud" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Diagnose'));

    expect(onChange).toHaveBeenCalledWith('diagnose');
  });
});
