import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { OperatorService } from '../services/OperatorService';

interface Props {
  onRegistered: () => void;
}

export const OperatorRegisterScreen: React.FC<Props> = ({ onRegistered }) => {
  const [plantId, setPlantId] = useState('');
  const [floatCap, setFloatCap] = useState('500000');
  const [adminPk, setAdminPk] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!plantId.trim()) {
      Alert.alert('Plant ID', 'Enter plant id');
      return;
    }
    const cap = parseInt(floatCap, 10);
    if (!Number.isFinite(cap) || cap <= 0) {
      Alert.alert('Float', 'Enter a positive credit cap');
      return;
    }
    if (!adminPk.trim()) {
      Alert.alert('Admin key', 'Enter admin public key (base58)');
      return;
    }

    setBusy(true);
    try {
      await OperatorService.registerOperator(
        plantId.trim(),
        cap,
        adminPk.trim(),
      );
      void OperatorService.syncCertificateToCloud();
      onRegistered();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Plant operator</Text>
      <Text style={styles.hint}>
        Matches idea doc: device keypair + treasury float signed by admin (demo
        uses same sig as operator proof).
      </Text>

      <Text style={styles.label}>Plant ID</Text>
      <TextInput
        style={styles.input}
        value={plantId}
        onChangeText={setPlantId}
        placeholder="e.g. plant-yangon-north"
        editable={!busy}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Float cap (credits)</Text>
      <TextInput
        style={styles.input}
        value={floatCap}
        onChangeText={setFloatCap}
        keyboardType="number-pad"
        editable={!busy}
      />

      <Text style={styles.label}>Admin public key (base58)</Text>
      <TextInput
        style={styles.input}
        value={adminPk}
        onChangeText={setAdminPk}
        placeholder="Treasury / plant master key"
        editable={!busy}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDis]}
        onPress={() => void go()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnTxt}>Register device</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#666', marginBottom: 20, fontSize: 14 },
  label: { fontWeight: '600', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  btnDis: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
