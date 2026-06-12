import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ClassSelector } from '../components/ClassSelector';
import { DepositProposalService } from '../services/DepositProposalService';
import { PhotoEvidenceService } from '../services/PhotoEvidenceService';
import { DepositProposal, PlasticClass } from '../types/events';

type Props = {
  onBack: () => void;
};

export const DepositFlowScreen: React.FC<Props> = ({ onBack }) => {
  const [customerPubkey, setCustomerPubkey] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [plasticClass, setPlasticClass] = useState<PlasticClass>('A');
  const [material, setMaterial] = useState('plastic bottle');
  const [photoHashes, setPhotoHashes] = useState(['', '', '']);
  const [proposal, setProposal] = useState<DepositProposal | null>(null);
  const [error, setError] = useState('');

  const updatePhoto = (index: number, value: string) => {
    setPhotoHashes(current => current.map((h, i) => (i === index ? value : h)));
  };

  const generateHash = async (index: number) => {
    const hash = PhotoEvidenceService.hashEvidence({
      label: `deposit-photo-${index + 1}`,
      note: `${customerPubkey}:${weightKg}:${material}`,
    });
    await PhotoEvidenceService.storeEvidence(null, hash, `deposit-photo-${index + 1}`);
    updatePhoto(index, hash);
  };

  const createProposal = async () => {
    setError('');
    setProposal(null);
    try {
      const next = await DepositProposalService.createProposal({
        customerPubkey,
        weightKg: Number(weightKg),
        plasticClass,
        material,
        photoHashes,
        aiSuggestion: plasticClass,
        aiConfidence: 0,
      });
      setProposal(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const proposalJson = proposal ? JSON.stringify(proposal, null, 2) : '';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>New deposit</Text>
        <Text style={styles.label}>Customer public key</Text>
        <TextInput
          style={styles.input}
          value={customerPubkey}
          onChangeText={setCustomerPubkey}
          autoCapitalize="none"
          placeholder="Scan or paste customer wallet key"
        />

        <Text style={styles.label}>Weight kg</Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.label}>Material</Text>
        <TextInput
          style={styles.input}
          value={material}
          onChangeText={setMaterial}
          placeholder="plastic bottle, can, glass bottle"
        />

        <Text style={styles.label}>Class</Text>
        <ClassSelector value={plasticClass} onChange={setPlasticClass} />

        <Text style={styles.label}>Evidence hashes</Text>
        {photoHashes.map((hash, index) => (
          <View key={index} style={styles.hashRow}>
            <TextInput
              style={[styles.input, styles.hashInput]}
              value={hash}
              onChangeText={value => updatePhoto(index, value)}
              autoCapitalize="none"
              placeholder={`Photo hash ${index + 1}`}
            />
            <TouchableOpacity
              style={styles.hashBtn}
              onPress={() => void generateHash(index)}
            >
              <Text style={styles.hashBtnText}>Hash</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => void createProposal()}>
          <Text style={styles.primaryBtnText}>Create signed proposal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {proposal ? (
          <View style={styles.output}>
            <Text style={styles.outputTitle}>Customer signing payload</Text>
            <TextInput
              style={styles.outputText}
              value={proposalJson}
              multiline
              editable={false}
              selectTextOnFocus
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  label: { color: '#333', fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#FFF',
    borderColor: '#D6D6D6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111',
  },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hashInput: { flex: 1 },
  hashBtn: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  hashBtnText: { color: '#FFF', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  error: { color: '#B00020', marginTop: 12 },
  output: { marginTop: 16 },
  outputTitle: { fontWeight: '800', color: '#111', marginBottom: 8 },
  outputText: {
    minHeight: 220,
    backgroundColor: '#111',
    color: '#FFF',
    borderRadius: 10,
    padding: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
