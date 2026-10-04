import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { OperatorService } from '../services/OperatorService';
import { OperatorCertificate } from '../types/events';

interface Props {
  onRegistered: () => void;
}

export const OperatorRegisterScreen: React.FC<Props> = ({ onRegistered }) => {
  const [plantId, setPlantId] = useState('');
  const [certJson, setCertJson] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!plantId.trim()) {
      Alert.alert('Plant ID', 'Enter plant id');
      return;
    }
    if (!certJson.trim()) {
      Alert.alert('Admin certificate', 'Paste the JSON certificate the admin issued for this device');
      return;
    }
    setBusy(true);
    try {
      // 1) Generate + store the device keypair locally.
      const { operatorPubkey } =
        await OperatorService.provisionLocalOperator(plantId.trim());

      // 2) Parse the admin-signed cert the admin returned (e.g. via QR).
      let parsed: OperatorCertificate;
      try {
        parsed = JSON.parse(certJson.trim()) as OperatorCertificate;
      } catch {
        throw new Error('admin certificate is not valid JSON');
      }
      if (parsed.operatorPubkey !== operatorPubkey) {
        throw new Error(
          `admin certificate is for a different operator (${parsed.operatorPubkey} vs ${operatorPubkey})`,
        );
      }

      // 3) Activate: persist the cert and switch to operator mode.
      await OperatorService.activateIssuedCertificate(parsed);
      onRegistered();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Plant operator</Text>
      <Text style={styles.hint}>
        Provision a device keypair, then paste the admin-signed certificate
        JSON. The backend will reject the certificate on first sync if the
        admin signature does not match.
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

      <Text style={styles.label}>Admin-signed certificate (JSON)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={certJson}
        onChangeText={setCertJson}
        placeholder='{"operatorPubkey":"...","plantId":"...","floatCap":...,"adminPubkey":"...","adminSig":"...","issuedAt":...,"expiresAt":...,"isActive":true}'
        editable={!busy}
        autoCapitalize="none"
        multiline
      />

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDis]}
        onPress={() => void go()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnTxt}>Provision + activate</Text>
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
  multiline: { minHeight: 120, textAlignVertical: 'top', fontFamily: 'Menlo' },
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