import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { QRDisplay } from '../components/QRDisplay';
import { BalanceService } from '../services/BalanceService';
import { CryptoService } from '../services/CryptoService';
import { Identity } from '../types/identity';

type Props = {
  identity: Identity;
  onBack: () => void;
};

export const RedeemScreen: React.FC<Props> = ({ identity, onBack }) => {
  const pubkey = useMemo(
    () => CryptoService.encodePublicKeyBase58(identity.publicKey),
    [identity.publicKey],
  );
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const redeemPayload = useMemo(
    () =>
      JSON.stringify({
        type: 'PLASTO_REDEEM_INTENT',
        customerPubkey: pubkey,
        credits: Number(amount) || 0,
        createdAt: Date.now(),
      }),
    [amount, pubkey],
  );

  useEffect(() => {
    BalanceService.getSnapshot(pubkey)
      .then(snapshot => setBalance(snapshot.balance))
      .catch(() => setBalance(0));
  }, [pubkey]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Redeem</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Available</Text>
        <Text style={styles.balance}>{balance}</Text>
        <Text style={styles.label}>Credits to redeem</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="0"
        />
      </View>
      <QRDisplay publicKeyBase58={redeemPayload} />
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
  },
  title: { alignSelf: 'flex-start', fontSize: 28, fontWeight: '800', color: '#111' },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 10, padding: 16, marginVertical: 16 },
  label: { color: '#555', fontWeight: '700', marginTop: 6 },
  balance: { color: '#111', fontSize: 42, fontWeight: '900' },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111',
    marginTop: 8,
  },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
});
