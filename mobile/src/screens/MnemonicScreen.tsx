import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  NativeModules,
} from 'react-native';
import { CryptoService } from '../services/CryptoService';
import { KeychainService } from '../services/KeychainService';
import { Identity } from '../types/identity';
import { Buffer } from 'buffer';

const { PreventScreenshot } = NativeModules;

interface Props {
  onComplete: (identity: Identity) => void;
}

export const MnemonicScreen: React.FC<Props> = ({ onComplete }) => {
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  useEffect(() => {
    // block screenshots
    if (PreventScreenshot?.enable) {
      PreventScreenshot.enable();
    }

    const newIdentity = CryptoService.generateIdentity();
    setIdentity(newIdentity);

    // store in keychain
    const storeKeys = async () => {
      await KeychainService.storeCustomerKeys({
        publicKey: Buffer.from(newIdentity.publicKey).toString('base64'),
        secretKey: Buffer.from(newIdentity.secretKey).toString('base64'),
      });
      await KeychainService.storeMnemonic(newIdentity.mnemonic);
    };
    void storeKeys();

    return () => {
      if (PreventScreenshot?.disable) {
        PreventScreenshot.disable();
      }
    };
  }, []);

  const handleConfirm = () => {
    if (!confirmed) {
      Alert.alert(
        'Have you written it down?',
        'This is the only time you will see these words. Without them, your account cannot be recovered.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'I have saved it',
            onPress: () => {
              setConfirmed(true);
              if (identity) {
                onComplete(identity);
              }
            },
          },
        ]
      );
    }
  };

  const words = identity?.mnemonic.split(' ') ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.subtitle}>
        Write these 12 words down in order and keep them safe
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Never share these words with anyone
        </Text>
      </View>

      <View style={styles.wordsContainer}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordBox}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleConfirm}>
        <Text style={styles.buttonText}>I have written it down</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    color: '#856404',
    textAlign: 'center',
    fontWeight: '600',
  },
  wordsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  wordBox: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  wordNumber: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
    minWidth: 20,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
