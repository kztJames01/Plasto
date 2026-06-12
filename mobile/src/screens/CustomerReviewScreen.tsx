import React, { useMemo, useState } from 'react';
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

import { DepositProposalService } from '../services/DepositProposalService';
import { CryptoService } from '../services/CryptoService';
import { DepositProposal } from '../types/events';
import { Identity } from '../types/identity';

type Props = {
  identity: Identity;
  onBack: () => void;
};

export const CustomerReviewScreen: React.FC<Props> = ({ identity, onBack }) => {
  const customerPubkey = useMemo(
    () => CryptoService.encodePublicKeyBase58(identity.publicKey),
    [identity.publicKey],
  );
  const [proposalJson, setProposalJson] = useState('');
  const [responseJson, setResponseJson] = useState('');
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<DepositProposal | null>(null);

  const review = () => {
    setError('');
    setResponseJson('');
    try {
      const parsed = JSON.parse(proposalJson) as DepositProposal;
      setProposal(parsed);
      const response = DepositProposalService.signProposal(parsed, identity);
      setResponseJson(JSON.stringify(response, null, 2));
    } catch (err) {
      setProposal(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Review deposit</Text>
        <Text style={styles.meta}>Wallet {customerPubkey.slice(0, 28)}...</Text>
        <Text style={styles.label}>Operator proposal JSON</Text>
        <TextInput
          style={styles.textArea}
          value={proposalJson}
          onChangeText={setProposalJson}
          multiline
          autoCapitalize="none"
        />
        {proposal ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>Credits: {proposal.credits}</Text>
            <Text style={styles.summaryText}>Weight: {proposal.weightKg} kg</Text>
            <Text style={styles.summaryText}>Class: {proposal.plasticClass}</Text>
            <Text style={styles.summaryText}>Material: {proposal.material}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={review}>
          <Text style={styles.primaryBtnText}>Sign acceptance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {responseJson ? (
          <>
            <Text style={styles.label}>Return this response to operator</Text>
            <TextInput
              style={styles.outputText}
              value={responseJson}
              multiline
              editable={false}
              selectTextOnFocus
            />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111' },
  meta: { color: '#555', marginTop: 6, marginBottom: 16 },
  label: { color: '#333', fontWeight: '700', marginTop: 14, marginBottom: 6 },
  textArea: {
    minHeight: 210,
    backgroundColor: '#FFF',
    borderColor: '#D6D6D6',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#111',
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  summary: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginTop: 12 },
  summaryText: { color: '#111', fontSize: 15, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  error: { color: '#B00020', marginTop: 10 },
  outputText: {
    minHeight: 150,
    backgroundColor: '#111',
    color: '#FFF',
    borderRadius: 10,
    padding: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
