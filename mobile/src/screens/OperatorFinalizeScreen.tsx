import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
} from 'react-native';

import { QrScanSheet } from '../components/QrScanSheet';
import { DepositProposalService } from '../services/DepositProposalService';
import { CustomerSignedResponse, DepositProposal } from '../types/events';

type Props = {
  onBack: () => void;
};

export const OperatorFinalizeScreen: React.FC<Props> = ({ onBack }) => {
  const [pending, setPending] = useState<DepositProposal[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [proposalJson, setProposalJson] = useState('');
  const [responseJson, setResponseJson] = useState('');
  const [status, setStatus] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const loadPending = async () => {
    const rows = await DepositProposalService.getPendingProposals();
    setPending(rows);
    if (!selectedEventId && rows.length) {
      const first = rows[0];
      setSelectedEventId(first.eventId);
      setProposalJson(JSON.stringify(first, null, 2));
    }
  };

  useEffect(() => {
    void loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalize = async () => {
    setStatus('');
    try {
      const proposal = JSON.parse(proposalJson) as DepositProposal;
      const response = JSON.parse(responseJson) as CustomerSignedResponse;
      await DepositProposalService.finalizeSignedDeposit(proposal, response);
      setStatus('Deposit finalized locally. Transaction completed. 🎉 အောင်မြင်ပါသည်');
      Vibration.vibrate(300);
      await loadPending();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const onScanFrame = (raw: string) => {
    try {
      const packet = DepositProposalService.decodeResponseQr([raw]);
      if (packet.complete && packet.value) {
        setResponseJson(JSON.stringify(packet.value, null, 2));
        setScannerOpen(false);
        setStatus('');
        return;
      }
    } catch {
      // fall through
    }

    setResponseJson(current => {
      const merged = current ? `${current}\n${raw}` : raw;
      try {
        const frames = merged.split('\n').map(s => s.trim()).filter(Boolean);
        const decoded = DepositProposalService.decodeResponseQr(frames);
        if (decoded.complete && decoded.value) {
          setScannerOpen(false);
          return JSON.stringify(decoded.value, null, 2);
        }
        setStatus(`Scanning response frame ${decoded.got}/${decoded.total || '?'}`);
      } catch {
        setStatus('Scanned frame not recognized yet');
      }
      return merged;
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Finalize deposit</Text>
        <Text style={styles.label}>Pending proposals</Text>
        <FlatList
          data={pending}
          keyExtractor={item => item.eventId}
          horizontal
          contentContainerStyle={styles.pendingList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.pendingCard,
                selectedEventId === item.eventId && styles.pendingCardActive,
              ]}
              onPress={() => {
                setSelectedEventId(item.eventId);
                setProposalJson(JSON.stringify(item, null, 2));
              }}
            >
              <Text style={styles.pendingTitle}>{item.eventId.slice(0, 8)}...</Text>
              <Text style={styles.pendingText}>{item.weightKg} kg / {item.credits} credits</Text>
            </TouchableOpacity>
          )}
        />
        <Text style={styles.label}>Original proposal JSON</Text>
        <TextInput
          style={styles.textArea}
          value={proposalJson}
          onChangeText={setProposalJson}
          multiline
          autoCapitalize="none"
        />
        <Text style={styles.label}>Customer response JSON</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
          <Text style={styles.scanBtnText}>Scan customer response QR</Text>
        </TouchableOpacity>
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
      <QrScanSheet
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={onScanFrame}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  label: { color: '#333', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  pendingList: { paddingBottom: 8, gap: 8 },
  pendingCard: {
    width: 190,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    padding: 10,
    marginRight: 8,
  },
  pendingCardActive: { borderColor: '#0A7AFF', backgroundColor: '#EAF3FF' },
  pendingTitle: { color: '#111', fontWeight: '800' },
  pendingText: { marginTop: 4, color: '#555' },
  scanBtn: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0A7AFF',
    marginBottom: 6,
  },
  scanBtnText: { color: '#0A7AFF', fontWeight: '800' },
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
