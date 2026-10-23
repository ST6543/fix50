/**
 * Jest-setup: maakt unit-tests mogelijk zonder device en zonder echte backend.
 * - AsyncStorage (native-only) vervangen door in-memory mock.
 * - Dummy Supabase-env zodat de client geïnitialiseerd kan worden;
 *   tests gebruiken nooit echte netwerkcalls.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'test-publishable-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
