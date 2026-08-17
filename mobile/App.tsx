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
import { HashChainService } from './src/services/HashChainService';
import { BalanceService } from './src/services/BalanceService';
import { Identity } from './src/types/identity';

import { MnemonicScreen } from './src/screens/MnemonicScreen';
import { RecoveryScreen } from './src/screens/RecoveryScreen';
import { OperatorRegisterScreen } from './src/screens/OperatorRegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CustomerReviewScreen } from './src/screens/CustomerReviewScreen';
import { DepositFlowScreen } from './src/screens/DepositFlowScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { OperatorDashboardScreen } from './src/screens/OperatorDashboardScreen';
import { OperatorFinalizeScreen } from './src/screens/OperatorFinalizeScreen';
import { OperatorRedeemScreen } from './src/screens/OperatorRedeemScreen';
import { RedeemScreen } from './src/screens/RedeemScreen';
import { SyncDashboardScreen } from './src/screens/SyncDashboardScreen';
import { TransactionDetailScreen } from './src/screens/TransactionDetailScreen';
import { EventPayload } from './src/types/events';

type AppState =
  | { type: 'loading' }
  | { type: 'choose_role' }
  | { type: 'welcome' }
  | { type: 'create' }
  | { type: 'recover' }
  | { type: 'operator_register' }
  | { type: 'home'; identity: Identity }
  | { type: 'customer_review'; identity: Identity }
  | { type: 'customer_history'; identity: Identity }
  | { type: 'customer_detail'; identity: Identity; event: EventPayload }
  | { type: 'redeem'; identity: Identity }
  | { type: 'operator_home' }
  | { type: 'operator_deposit' }
  | { type: 'operator_redeem' }
  | { type: 'operator_finalize' }
  | { type: 'operator_sync' };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [state, setState] = useState<AppState>({ type: 'loading' });

  const runStartupChecks = useCallback(async (customerPubkey: string) => {
    // Startup check is async so the app opens without waiting.
    const chainResult = await HashChainService.validateChain(customerPubkey);
    if (chainResult.valid) {
      await BalanceService.recalculate(customerPubkey);
    }
  }, []);

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
      const customerPubkey = CryptoService.encodePublicKeyBase58(
        Buffer.from(ck.publicKey, 'base64'),
      );
      runStartupChecks(customerPubkey).catch(() => undefined);
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
  }, [runStartupChecks]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const handleIdentityComplete = async (identity: Identity) => {
    await EventStore.setAppRole('customer');
    const customerPubkey = CryptoService.encodePublicKeyBase58(identity.publicKey);
    runStartupChecks(customerPubkey).catch(() => undefined);
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
        return (
          <HomeScreen
            identity={state.identity}
            onReviewProposal={() =>
              setState({ type: 'customer_review', identity: state.identity })
            }
            onRedeem={() => setState({ type: 'redeem', identity: state.identity })}
            onHistory={() =>
              setState({ type: 'customer_history', identity: state.identity })
            }
          />
        );
      }

      case 'customer_review':
        return (
          <CustomerReviewScreen
            identity={state.identity}
            onBack={() => setState({ type: 'home', identity: state.identity })}
          />
        );

      case 'customer_history':
        return (
          <HistoryScreen
            identity={state.identity}
            onBack={() => setState({ type: 'home', identity: state.identity })}
            onOpenEvent={event =>
              setState({ type: 'customer_detail', identity: state.identity, event })
            }
          />
        );

      case 'customer_detail':
        return (
          <TransactionDetailScreen
            event={state.event}
            onBack={() =>
              setState({ type: 'customer_history', identity: state.identity })
            }
          />
        );

      case 'redeem':
        return (
          <RedeemScreen
            identity={state.identity}
            onBack={() => setState({ type: 'home', identity: state.identity })}
          />
        );

      case 'operator_home':
        return (
          <OperatorDashboardScreen
            onNewDeposit={() => setState({ type: 'operator_deposit' })}
            onRedeem={() => setState({ type: 'operator_redeem' })}
            onFinalize={() => setState({ type: 'operator_finalize' })}
            onSync={() => setState({ type: 'operator_sync' })}
            onRefresh={boot}
          />
        );

      case 'operator_deposit':
        return <DepositFlowScreen onBack={() => setState({ type: 'operator_home' })} />;

      case 'operator_redeem':
        return <OperatorRedeemScreen onBack={() => setState({ type: 'operator_home' })} />;

      case 'operator_finalize':
        return (
          <OperatorFinalizeScreen onBack={() => setState({ type: 'operator_home' })} />
        );

      case 'operator_sync':
        return <SyncDashboardScreen onBack={() => setState({ type: 'operator_home' })} />;

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
});

export default App;
