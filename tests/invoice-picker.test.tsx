/**
 * UI-test voor de factuurkeuze op de onderhoudsgeschiedenis: standaard deze
 * maand, of expliciet één losse beurt — nooit stilzwijgend alles.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MaintenanceHistoryScreen from '@/features/maintenance/MaintenanceHistoryScreen';
import { defaultPeriod, formatDateInput, isoDateToInput } from '@/lib/invoice-selection';
import { exportInvoicePdf } from '@/services/pdf-export';
import { exportStoredInvoicePdf } from '@/services/pdf-export';
import { listRecords } from '@/services/maintenance';
import { listInvoices } from '@/services/invoices';
import { buildInvoiceSnapshot } from '@/lib/invoice-snapshot';
import type { MaintenanceRecord, Scooter } from '@/types';

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(effect, [effect]),
  };
});

const mockScooter: Scooter = {
  id: 'scooter-1',
  user_id: 'user-1',
  name: 'Aerox',
  brand: 'Yamaha',
  model: 'Aerox',
  year: 2019,
  engine_type: 'AM6',
  engine_code: null,
  fuel_system: '2T',
  license_plate: null,
  current_km: 12000,
  avg_km_per_week: 120,
  notes: null,
  image_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-11-20T00:00:00.000Z',
};

jest.mock('@/hooks/useScooters', () => ({
  useScooters: () => ({
    scooters: [mockScooter],
    activeScooter: mockScooter,
    setup: null,
    loading: false,
    reload: jest.fn(),
    setActiveScooterId: jest.fn(),
    updateKm: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAppData', () => ({
  useMaintenanceData: () => ({
    items: [],
    schedules: [],
    reminders: [],
    km: 12000,
    kmIsEstimated: false,
    kmAnchor: null,
    loading: false,
    refreshing: false,
    error: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/services/maintenance', () => ({
  listRecords: jest.fn(),
}));

jest.mock('@/services/pdf-export', () => ({
  exportInvoicePdf: jest.fn().mockResolvedValue(undefined),
  exportMaintenancePdf: jest.fn().mockResolvedValue(undefined),
  exportStoredInvoicePdf: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/invoices', () => ({
  listInvoices: jest.fn(),
}));

function record(id: string, name: string, doneAt: Date): MaintenanceRecord {
  return {
    id,
    scooter_id: 'scooter-1',
    item_id: null,
    custom_name: name,
    done_at: doneAt.toISOString(),
    km_at_service: 12000,
    cost_cents: 2450,
    parts: null,
    notes: null,
    created_at: doneAt.toISOString(),
  };
}

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
const records = [
  record('record-1', 'Oliewissel', firstOfMonth),
  record('record-2', 'Remblokjes', new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)),
];

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderHistory() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <MaintenanceHistoryScreen />
    </SafeAreaProvider>,
  );
}

// Eerste render in dit bestand is koud (jest-expo transformeert de modal-boom).
jest.setTimeout(20_000);
// Onder parallelle workers duurt de eerste state-update soms langer dan 1 s.
configure({ asyncUtilTimeout: 10_000 });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listRecords).mockResolvedValue(records);
  jest.mocked(listInvoices).mockResolvedValue([]);
});

describe('Factuurkeuze', () => {
  it('staat standaard op deze maand en genereert alleen die periode', async () => {
    renderHistory();
    await screen.findByText('Oliewissel');

    fireEvent.press(screen.getByLabelText('Factuur (PDF)'));

    expect(screen.getByText('Factuur maken')).toBeTruthy();
    const range = defaultPeriod(new Date());
    expect(screen.getByDisplayValue(isoDateToInput(range.fromIso))).toBeTruthy();
    expect(screen.getByDisplayValue(isoDateToInput(range.toIso))).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Factuur genereren'));

    await waitFor(() =>
      expect(exportInvoicePdf).toHaveBeenCalledWith(mockScooter, {
        kind: 'period',
        fromIso: range.fromIso,
        toIso: range.toIso,
      }),
    );
  });

  it('laat één losse onderhoudsbeurt kiezen', async () => {
    renderHistory();
    await screen.findByText('Oliewissel');

    fireEvent.press(screen.getByLabelText('Factuur (PDF)'));
    fireEvent.press(screen.getByLabelText('Eén beurt'));
    fireEvent.press(screen.getByLabelText(new RegExp(`^Kies Remblokjes van`)));

    expect(screen.getByText('1 beurt op de factuur.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Factuur genereren'));

    await waitFor(() =>
      expect(exportInvoicePdf).toHaveBeenCalledWith(mockScooter, {
        kind: 'record',
        recordId: 'record-2',
      }),
    );
  });

  it('waarschuwt bij een ongeldige periode zonder de factuur te maken', async () => {
    renderHistory();
    await screen.findByText('Oliewissel');

    fireEvent.press(screen.getByLabelText('Factuur (PDF)'));
    fireEvent.changeText(
      screen.getAllByDisplayValue(formatDateInput(firstOfMonth))[0],
      '31-02-2026',
    );
    fireEvent.press(screen.getByLabelText('Factuur genereren'));

    await waitFor(() => expect(screen.getByText('Geen beurten in deze selectie.')).toBeTruthy());
    expect(exportInvoicePdf).not.toHaveBeenCalled();
  });

  it('toont eerdere facturen en deelt ze opnieuw uit het opgeslagen snapshot', async () => {
    const snapshot = buildInvoiceSnapshot({
      scooter: { ...mockScooter, fuel_system: '2T' },
      ownerName: 'Sam',
      issuedAtIso: '2026-11-20T10:00:00.000Z',
      selection: { kind: 'period', fromIso: '2026-11-01', toIso: '2026-11-26' },
      lines: [
        {
          description: 'Oliewissel',
          detail: null,
          doneAtIso: '2026-11-02T09:00:00.000Z',
          km: 12000,
          amountCents: 1995,
        },
      ],
    });
    const entry = {
      id: 'invoice-1',
      user_id: 'user-1',
      scooter_id: mockScooter.id,
      sequence_year: 2026,
      sequence_no: 1,
      invoice_number: 'F50-2026-0001',
      issued_at: snapshot.issuedAtIso,
      selection: snapshot.selection,
      snapshot,
      created_at: snapshot.issuedAtIso,
    };
    jest.mocked(listInvoices).mockResolvedValue([entry]);

    renderHistory();
    await screen.findByText('F50-2026-0001');
    fireEvent.press(screen.getByLabelText('Factuur F50-2026-0001 opnieuw delen'));

    await waitFor(() => expect(exportStoredInvoicePdf).toHaveBeenCalledWith(entry));
  });
});
