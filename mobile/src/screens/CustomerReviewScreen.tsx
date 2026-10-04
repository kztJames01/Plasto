import React, { useMemo, useState } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

import { ChunkedQrPanel } from '../components/ChunkedQrPanel';
import { QrScanSheet } from '../components/QrScanSheet';
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
  const [responsePackets, setResponsePackets] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<DepositProposal | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [, setScanFrames] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const review = () => {
    setError('');
    setResponseJson('');
    try {
      const parsed = JSON.parse(proposalJson) as DepositProposal;
      setProposal(parsed);
      setReviewOpen(true);
    } catch (err) {
      setProposal(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const approve = async () => {
    if (!proposal) {
      return;
    }
    setError('');
    try {
      const response = DepositProposalService.signProposal(proposal, identity);
      await DepositProposalService.appendCustomerCopy(proposal, response);
      const raw = JSON.stringify(response, null, 2);
      setResponseJson(raw);
      setResponsePackets(DepositProposalService.encodeForQr('response', response));
      setReviewOpen(false);
      Vibration.vibrate(220);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reject = () => {
    setReviewOpen(false);
    setResponseJson('');
    setResponsePackets([]);
    setError('Proposal rejected by customer');
  };

  const addFrame = (raw: string) => {
    if (!raw) {
      return;
    }
    setScanFrames(curr => {
      if (curr.includes(raw)) {
        return curr;
      }
      const next = [...curr, raw];
      const decoded = DepositProposalService.decodeProposalQr(next);
      if (decoded.complete && decoded.value) {
        const rawJson = JSON.stringify(decoded.value, null, 2);
        setProposalJson(rawJson);
        setProposal(decoded.value);
        setScannerOpen(false);
        setError('');
      } else {
        setError(`Scanning proposal frame ${decoded.got}/${decoded.total || '?'}...`);
      }
      return next;
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Review deposit</Text>
        <Text style={styles.meta}>Wallet {customerPubkey.slice(0, 28)}...</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScannerOpen(true)}>
          <Text style={styles.secondaryBtnText}>Scan proposal QR</Text>
        </TouchableOpacity>
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
          <Text style={styles.primaryBtnText}>Review and approve</Text>
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
        {responsePackets.length ? (
          <ChunkedQrPanel title="Customer response QR" packets={responsePackets} />
        ) : null}
      </ScrollView>
      <QrScanSheet
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={addFrame}
      />
      <Modal visible={reviewOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm details</Text>
            <Text style={styles.modalLine}>Credits: {proposal?.credits}</Text>
            <Text style={styles.modalLine}>Weight: {proposal?.weightKg} kg</Text>
            <Text style={styles.modalLine}>Class: {proposal?.plasticClass}</Text>
            <Text style={styles.modalLine}>Plant: {proposal?.plantId}</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={reject}>
                <Text style={styles.rejectTxt}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={() => void approve()}>
                <Text style={styles.approveTxt}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 10 },
  modalLine: { color: '#333', marginBottom: 4, fontSize: 15 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: { flex: 1, backgroundColor: '#EEE', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  approveBtn: { flex: 1, backgroundColor: '#0A7AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectTxt: { color: '#333', fontWeight: '800' },
  approveTxt: { color: '#FFF', fontWeight: '800' },
});
