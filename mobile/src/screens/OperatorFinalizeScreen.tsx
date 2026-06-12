import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { DepositProposalService } from '../services/DepositProposalService';
import { CustomerSignedResponse, DepositProposal } from '../types/events';

type Props = {
  onBack: () => void;
};

export const OperatorFinalizeScreen: React.FC<Props> = ({ onBack }) => {
  const [proposalJson, setProposalJson] = useState('');
  const [responseJson, setResponseJson] = useState('');
  const [status, setStatus] = useState('');

  const finalize = async () => {
    setStatus('');
    try {
      const proposal = JSON.parse(proposalJson) as DepositProposal;
      const response = JSON.parse(responseJson) as CustomerSignedResponse;
      await DepositProposalService.finalizeSignedDeposit(proposal, response);
      setStatus('Deposit finalized locally. It will sync from the sync dashboard.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Finalize deposit</Text>
        <Text style={styles.label}>Original proposal JSON</Text>
        <TextInput
          style={styles.textArea}
          value={proposalJson}
          onChangeText={setProposalJson}
          multiline
          autoCapitalize="none"
        />
        <Text style={styles.label}>Customer response JSON</Text>
        <TextInput
          style={styles.textArea}
          value={responseJson}
          onChangeText={setResponseJson}
          multiline
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void finalize()}>
          <Text style={styles.primaryBtnText}>Verify and save event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  label: { color: '#333', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  textArea: {
    minHeight: 160,
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
  status: { color: '#333', marginTop: 10 },
});
