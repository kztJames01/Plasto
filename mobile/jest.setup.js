/* global jest */

jest.mock('react-native-quick-sqlite', () => {
  const emptyRows = { _array: [], length: 0 };
  return {
    open: () => ({
      execute: (sql) => {
        if (String(sql).startsWith('PRAGMA user_version')) {
          return { rows: { _array: [{ user_version: 1 }], length: 1 } };
        }
        return { rows: emptyRows };
      },
      close: jest.fn(),
    }),
  };
});

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');
