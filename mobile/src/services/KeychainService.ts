import * as Keychain from 'react-native-keychain';
import { StoredKeys } from '../types/identity';

const CUSTOMER_KEYS = 'com.plasto.bank.keys';
const CUSTOMER_MNEMONIC = 'com.plasto.bank.mnemonic';
const OPERATOR_KEYS = 'com.plasto.bank.operator.keys';

export class KeychainService {
  static async storeCustomerKeys(keys: StoredKeys): Promise<void> {
    const json = JSON.stringify(keys);
    const result = await Keychain.setGenericPassword('plasto_customer', json, {
      service: CUSTOMER_KEYS,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (!result) {
      throw new Error('Failed to store keys');
    }
  }

  static async retrieveCustomerKeys(): Promise<StoredKeys | null> {
    const credentials = await Keychain.getGenericPassword({
      service: CUSTOMER_KEYS,
    });

    if (!credentials) {
      return null;
    }

    return JSON.parse(credentials.password) as StoredKeys;
  }

  static async hasCustomerKeys(): Promise<boolean> {
    const keys = await this.retrieveCustomerKeys();
    return keys !== null;
  }

  static async storeOperatorKeys(keys: StoredKeys): Promise<void> {
    const json = JSON.stringify(keys);
    const result = await Keychain.setGenericPassword('plasto_operator', json, {
      service: OPERATOR_KEYS,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!result) {
      throw new Error('Failed to store operator keys');
    }
  }

  static async retrieveOperatorKeys(): Promise<StoredKeys | null> {
    const credentials = await Keychain.getGenericPassword({
      service: OPERATOR_KEYS,
    });
    if (!credentials) {
      return null;
    }
    return JSON.parse(credentials.password) as StoredKeys;
  }

  static async storeMnemonic(mnemonic: string): Promise<void> {
    const result = await Keychain.setGenericPassword(
      'plasto_mnemonic',
      mnemonic,
      {
        service: CUSTOMER_MNEMONIC,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );

    if (!result) {
      throw new Error('Failed to store mnemonic');
    }
  }

  static async retrieveMnemonic(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
      service: CUSTOMER_MNEMONIC,
    });

    if (!credentials) {
      return null;
    }

    return credentials.password;
  }

  static async deleteAll(): Promise<void> {
    await Keychain.resetGenericPassword({ service: CUSTOMER_KEYS });
    await Keychain.resetGenericPassword({ service: CUSTOMER_MNEMONIC });
    await Keychain.resetGenericPassword({ service: OPERATOR_KEYS });
  }
}
