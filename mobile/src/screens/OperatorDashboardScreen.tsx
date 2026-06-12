import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventStore } from '../services/EventStore';
import { OperatorService } from '../services/OperatorService';

type Props = {
  onNewDeposit: () => void;
  onFinalize: () => void;
  onSync: () => void;
  onRefresh: () => Promise<void>;
};

export const OperatorDashboardScreen: React.FC<Props> = ({
  onNewDeposit,
  onFinalize,
  onSync,
  onRefresh,
}) => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [operatorKey, setOperatorKey] = useState('');
  const [plantId, setPlantId] = useState('');
  const [unsynced, setUnsynced] = useState(0);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const cert = await OperatorService.getLocalCertificate();
    setRemaining(await OperatorService.getRemainingFloat());
    setUnsynced(await EventStore.countUnsynced());
    setOperatorKey(cert?.operatorPubkey ?? '');
    setPlantId(cert?.plantId ?? '');
  }, []);

  useEffect(() => {
    load().catch(err => setNote(String(err.message ?? err)));
  }, [load]);

  const syncCertificate = async () => {
    setNote('Syncing certificate...');
    await OperatorService.syncCertificateToCloud();
    setNote('Certificate sync attempted');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Operator</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Plant</Text>
        <Text style={styles.value}>{plantId || 'Not registered'}</Text>
        <Text style={styles.label}>Remaining float</Text>
        <Text style={styles.balance}>{remaining ?? '...'}</Text>
        <Text style={styles.small}>Key {operatorKey ? `${operatorKey.slice(0, 24)}...` : '-'}</Text>
        <Text style={styles.small}>Unsynced events: {unsynced}</Text>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onNewDeposit}>
        <Text style={styles.primaryBtnText}>New deposit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryBtn} onPress={onFinalize}>
        <Text style={styles.primaryBtnText}>Finalize customer signature</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onSync}>
        <Text style={styles.secondaryBtnText}>Sync dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => void syncCertificate()}>
        <Text style={styles.secondaryBtnText}>Sync certificate</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => {
          void onRefresh();
          void load();
        }}
      >
        <Text style={styles.secondaryBtnText}>Refresh</Text>
      </TouchableOpacity>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  panel: { backgroundColor: '#FFF', borderRadius: 10, padding: 16, marginBottom: 16 },
  label: { color: '#666', fontSize: 13, marginTop: 6 },
  value: { color: '#111', fontSize: 18, fontWeight: '700', marginTop: 2 },
  balance: { color: '#111', fontSize: 42, fontWeight: '900', marginTop: 2 },
  small: { color: '#555', fontSize: 13, marginTop: 8 },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  note: { color: '#555', marginTop: 10, textAlign: 'center' },
});
