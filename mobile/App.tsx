import { Buffer } from 'buffer';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDatabase } from './src/database/Database';
import { EventStore } from './src/services/EventStore';
import { KeychainService } from './src/services/KeychainService';
import { CryptoService } from './src/services/CryptoService';
import { OperatorService } from './src/services/OperatorService';
import { Identity } from './src/types/identity';

import { QRDisplay } from './src/components/QRDisplay';
import { MnemonicScreen } from './src/screens/MnemonicScreen';
import { RecoveryScreen } from './src/screens/RecoveryScreen';
import { OperatorRegisterScreen } from './src/screens/OperatorRegisterScreen';

type AppState =
  | { type: 'loading' }
  | { type: 'choose_role' }
  | { type: 'welcome' }
  | { type: 'create' }
  | { type: 'recover' }
  | { type: 'operator_register' }
  | { type: 'home'; identity: Identity }
  | { type: 'operator_home' };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [state, setState] = useState<AppState>({ type: 'loading' });

  const boot = useCallback(async () => {
    await getDatabase();
    const ck = await KeychainService.retrieveCustomerKeys();
    const ok = await KeychainService.retrieveOperatorKeys();
    let role = await EventStore.getAppRole();

    if (!role) {
      if (ck && !ok) {
        role = 'customer';
        await EventStore.setAppRole('customer');
      } else if (ok && !ck) {
        role = 'operator';
        await EventStore.setAppRole('operator');
      } else if (ck && ok) {
        setState({ type: 'choose_role' });
        return;
      }
    }

    if (role === 'customer' && ck) {
      setState({
        type: 'home',
        identity: {
          publicKey: Buffer.from(ck.publicKey, 'base64'),
          secretKey: Buffer.from(ck.secretKey, 'base64'),
          mnemonic: (await KeychainService.retrieveMnemonic()) ?? '',
        },
      });
      return;
    }

    if (role === 'operator' && ok) {
      setState({ type: 'operator_home' });
      return;
    }

    setState({ type: 'welcome' });
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const handleIdentityComplete = async (identity: Identity) => {
    await EventStore.setAppRole('customer');
    setState({ type: 'home', identity });
  };

  const pickCustomer = async () => {
    await EventStore.setAppRole('customer');
    await boot();
  };

  const pickOperator = async () => {
    await EventStore.setAppRole('operator');
    await boot();
  };

  const renderBody = () => {
    switch (state.type) {
      case 'loading':
        return (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        );

      case 'choose_role':
        return (
          <View style={styles.welcomeContainer}>
            <Text style={styles.title}>Pick profile</Text>
            <Text style={styles.subtitle}>Both wallets exist on this phone.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void pickCustomer()}>
              <Text style={styles.primaryBtnText}>Customer wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void pickOperator()}>
              <Text style={styles.primaryBtnText}>Plant operator</Text>
            </TouchableOpacity>
          </View>
        );

      case 'welcome':
        return (
          <View style={styles.welcomeContainer}>
            <View style={styles.header}>
              <View style={styles.logo} />
              <Text style={styles.title}>Plasto Bank</Text>
              <Text style={styles.subtitle}>Customer wallet + plant operator</Text>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setState({ type: 'create' })}
              >
                <Text style={styles.primaryBtnText}>New customer wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setState({ type: 'recover' })}
              >
                <Text style={styles.secondaryBtnText}>Recover customer wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setState({ type: 'operator_register' })}
              >
                <Text style={styles.secondaryBtnText}>Plant operator setup</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'create':
        return <MnemonicScreen onComplete={i => void handleIdentityComplete(i)} />;

      case 'recover':
        return <RecoveryScreen onComplete={i => void handleIdentityComplete(i)} />;

      case 'operator_register':
        return (
          <OperatorRegisterScreen onRegistered={() => setState({ type: 'operator_home' })} />
        );

      case 'home': {
        const pk = CryptoService.encodePublicKeyBase58(state.identity.publicKey);
        return (
          <View style={styles.homeContainer}>
            <Text style={styles.homeTitle}>Your wallet</Text>
            <QRDisplay publicKeyBase58={pk} />
          </View>
        );
      }

      case 'operator_home':
        return <OperatorHomePanel onRefresh={boot} />;

      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {renderBody()}
    </SafeAreaProvider>
  );
}

const OperatorHomePanel: React.FC<{ onRefresh: () => Promise<void> }> = ({
  onRefresh,
}) => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pk, setPk] = useState('');

  useEffect(() => {
    (async () => {
      const c = await OperatorService.getLocalCertificate();
      const r = await OperatorService.getRemainingFloat();
      setRemaining(r);
      setPk(c?.operatorPubkey?.slice(0, 18) ?? '—');
    })();
  }, []);

  return (
    <View style={styles.homeContainer}>
      <Text style={styles.homeTitle}>Operator</Text>
      <Text style={styles.subtitle}>Float left: {remaining ?? '…'}</Text>
      <Text style={styles.pkLabel}>Key {pk}…</Text>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => void OperatorService.syncCertificateToCloud()}
      >
        <Text style={styles.primaryBtnText}>Sync certificate</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => void onRefresh()}>
        <Text style={styles.secondaryBtnText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcomeContainer: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  buttons: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#007AFF', fontSize: 16 },
  homeContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  homeTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#1a1a1a' },
  pkLabel: { marginTop: 8, fontSize: 14, color: '#666' },
});

export default App;
