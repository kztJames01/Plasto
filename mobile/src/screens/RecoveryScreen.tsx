import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CryptoService } from '../services/CryptoService';
import { KeychainService } from '../services/KeychainService';
import { SyncService } from '../services/SyncService';
import { Identity } from '../types/identity';
import { Buffer } from 'buffer';

import { API_BASE } from '../config/api';

interface Props {
  onComplete: (identity: Identity) => void;
}

export const RecoveryScreen: React.FC<Props> = ({ onComplete }) => {
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [loading, setLoading] = useState(false);
  const [_focusedIndex, setFocusedIndex] = useState(0);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value.toLowerCase().trim();
    setWords(newWords);

    if (value.includes(' ') && index < 11) {
      const parts = value.split(/\s+/).filter(w => w.length > 0);
      if (parts.length > 1) {
        parts.slice(0, 12 - index).forEach((part, i) => {
          newWords[index + i] = part.toLowerCase().trim();
        });
        setWords([...newWords]);
      }
    }
  };

  const handleRecover = async () => {
    const mnemonic = words.join(' ').trim();

    if (words.some(w => !w)) {
      Alert.alert('Missing words', 'Please enter all 12 words');
      return;
    }

    setLoading(true);

    try {
      const identity = CryptoService.deriveFromMnemonic(mnemonic);

      const publicKeyBase58 = CryptoService.encodePublicKeyBase58(identity.publicKey);

      try {
        const response = await fetch(`${API_BASE}/users/${encodeURIComponent(publicKeyBase58)}/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok && response.status !== 404) {
          console.log('Recovery sync response:', response.status);
        } else {
          const imported = await SyncService.pull(publicKeyBase58);
          if (imported > 0) {
            console.log(`Recovered ${imported} events from cloud`);
          }
        }
      } catch (e) {
        console.log('Sync failed (offline?):', e);
      }

      await KeychainService.storeCustomerKeys({
        publicKey: Buffer.from(identity.publicKey).toString('base64'),
        secretKey: Buffer.from(identity.secretKey).toString('base64'),
      });
      await KeychainService.storeMnemonic(mnemonic);

      onComplete(identity);
    } catch {
      Alert.alert('Recovery failed', 'Invalid recovery phrase. Please check your words.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Recover Your Wallet</Text>
      <Text style={styles.subtitle}>
        Enter your 12-word recovery phrase
      </Text>

      <View style={styles.wordsContainer}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordInputBox}>
            <Text style={styles.wordNumber}>{index + 1}</Text>
            <TextInput
              style={styles.wordInput}
              value={word}
              onChangeText={(text) => handleWordChange(index, text)}
              onFocus={() => setFocusedIndex(index)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRecover}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Recover Wallet</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} disabled={loading}>
        <Text style={styles.backButtonText}>Go back</Text>
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
    marginBottom: 32,
  },
  wordsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  wordInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  wordNumber: {
    fontSize: 14,
    color: '#999',
    marginRight: 12,
    minWidth: 24,
  },
  wordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
  },
});
