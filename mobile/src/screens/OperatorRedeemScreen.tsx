import React, { useState } from 'react';
import {
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
import { RedeemProposalService } from '../services/RedeemProposalService';
import { RedeemIntent, RedeemProposal } from '../types/events';

type Props = {
  onBack: () => void;
};

type Step = 'scan' | 'confirm' | 'show' | 'scan_resp' | 'done';

export const OperatorRedeemScreen: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('scan');
  const [intent, setIntent] = useState<RedeemIntent | null>(null);
  const [proposal, setProposal] = useState<RedeemProposal | null>(null);
  const [packets, setPackets] = useState<string[]>([]);
  const [notes, setNotes] = useState('rice / soap');
  const [scanOpen, setScanOpen] = useState(true);
  const [frames, setFrames] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const onFrame = (raw: string) => {
    if (!raw) {
      return;
    }
    setFrames(curr => {
      if (curr.includes(raw)) {
        return curr;
      }
      const next = [...curr, raw];
      if (step === 'scan' || step === 'confirm') {
        const decoded = RedeemProposalService.decodeIntent(next);
        if (decoded.complete && decoded.value) {
          try {
            RedeemProposalService.verifyIntent(decoded.value);
            setIntent(decoded.value);
            setScanOpen(false);
            setStep('confirm');
            setStatus('');
          } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err));
          }
        } else {
          setStatus(`Intent frame ${decoded.got}/${decoded.total || '?'}`);
        }
      } else if (step === 'scan_resp') {
        const decoded = RedeemProposalService.decodeResponse(next);
        if (decoded.complete && decoded.value && proposal) {
          setScanOpen(false);
          void finish(proposal, decoded.value);
        } else {
          setStatus(`Response ${decoded.got}/${decoded.total || '?'}`);
        }
      }
      return next;
    });
  };

  const confirm = async () => {
    if (!intent) {
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const p = await RedeemProposalService.createProposalFromIntent(intent, notes);
      setProposal(p);
      setPackets(RedeemProposalService.encodeProposal(p));
      setStep('show');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (p: RedeemProposal, response: { eventId: string; customerPubkey: string; customerSig: string; acceptedAtLocal: number }) => {
    try {
      await RedeemProposalService.finalizeSignedRedeem(p, response);
      setStep('done');
      setStatus('Redeem saved. အောင်မြင်ပါသည်');
      Vibration.vibrate(300);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setStep('scan_resp');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Shop redeem</Text>
      {intent ? (
        <View style={styles.card}>
          <Text style={styles.big}>{intent.credits}</Text>
          <Text style={styles.meta}>credits requested</Text>
          <Text style={styles.meta}>Wallet {intent.customerPubkey.slice(0, 22)}...</Text>
        </View>
      ) : (
        <Text style={styles.meta}>Scan the customer redeem QR</Text>
      )}

      {step === 'confirm' ? (
        <>
          <Text style={styles.label}>What they get</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes} />
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.dim]}
            disabled={busy}
            onPress={() => void confirm()}
          >
            <Text style={styles.primaryBtnText}>Sign as shop</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'show' ? (
        <>
          <Text style={styles.meta}>Show this to the customer to sign</Text>
          <ChunkedQrPanel title="Shop redeem proposal" packets={packets} />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setFrames([]);
              setStep('scan_resp');
              setScanOpen(true);
            }}
          >
            <Text style={styles.primaryBtnText}>Scan customer response</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'done' ? <Text style={styles.ok}>{status}</Text> : null}

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => {
          setScanOpen(true);
          setFrames([]);
          setStep('scan');
        }}
      >
        <Text style={styles.secondaryBtnText}>Scan again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
      {status && step !== 'done' ? <Text style={styles.status}>{status}</Text> : null}

      <QrScanSheet
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={onFrame}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 16, marginBottom: 12 },
  big: { fontSize: 42, fontWeight: '900', color: '#111' },
  meta: { color: '#555', marginTop: 4 },
  label: { color: '#333', fontWeight: '700', marginTop: 8 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    color: '#111',
  },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  dim: { opacity: 0.6 },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontWeight: '700', fontSize: 16 },
  status: { color: '#333', marginTop: 8 },
  ok: { color: '#2E7D32', fontWeight: '800', marginTop: 12, fontSize: 16 },
});
