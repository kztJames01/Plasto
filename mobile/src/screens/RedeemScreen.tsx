import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

import { ChunkedQrPanel } from '../components/ChunkedQrPanel';
import { QrScanSheet } from '../components/QrScanSheet';
import { BalanceService } from '../services/BalanceService';
import { CryptoService } from '../services/CryptoService';
import { RedeemProposalService } from '../services/RedeemProposalService';
import { RedeemProposal } from '../types/events';
import { Identity } from '../types/identity';

type Props = {
  identity: Identity;
  onBack: () => void;
};

type Step = 'pad' | 'intent' | 'scan_shop' | 'response';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export const RedeemScreen: React.FC<Props> = ({ identity, onBack }) => {
  const pubkey = useMemo(
    () => CryptoService.encodePublicKeyBase58(identity.publicKey),
    [identity.publicKey],
  );
  const [balance, setBalance] = useState(0);
  const [digits, setDigits] = useState('');
  const [step, setStep] = useState<Step>('pad');
  const [intentPackets, setIntentPackets] = useState<string[]>([]);
  const [responsePackets, setResponsePackets] = useState<string[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFrames, setScanFrames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = Number(digits) || 0;

  useEffect(() => {
    BalanceService.recalculate(pubkey)
      .then(setBalance)
      .catch(() => setBalance(0));
  }, [pubkey]);

  const tapKey = (k: string) => {
    setError('');
    if (k === 'C') {
      setDigits('');
      return;
    }
    if (k === '⌫') {
      setDigits(d => d.slice(0, -1));
      return;
    }
    if (digits.length >= 7) {
      return;
    }
    setDigits(d => (d === '0' ? k : d + k));
  };

  const makeIntent = async () => {
    setError('');
    setBusy(true);
    try {
      const intent = await RedeemProposalService.createIntent(identity, amount);
      setIntentPackets(RedeemProposalService.encodeIntent(intent));
      setStep('intent');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onShopFrame = (raw: string) => {
    if (!raw) {
      return;
    }
    setScanFrames(curr => {
      if (curr.includes(raw)) {
        return curr;
      }
      const next = [...curr, raw];
      const decoded = RedeemProposalService.decodeProposal(next);
      if (decoded.complete && decoded.value) {
        setScanOpen(false);
        void approveShop(decoded.value);
      } else {
        setError(`Shop QR ${decoded.got}/${decoded.total || '?'}`);
      }
      return next;
    });
  };

  const approveShop = async (proposal: RedeemProposal) => {
    setError('');
    try {
      if (proposal.credits !== amount && amount > 0) {
        // shop can only spend what we asked
        if (proposal.credits !== (Number(digits) || 0)) {
          throw new Error('Shop amount does not match your redeem');
        }
      }
      const response = RedeemProposalService.signProposal(proposal, identity);
      await RedeemProposalService.appendCustomerCopy(proposal, response);
      setResponsePackets(RedeemProposalService.encodeResponse(response));
      setStep('response');
      Vibration.vibrate(220);
      const nextBal = await BalanceService.recalculate(pubkey);
      setBalance(nextBal);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Redeem</Text>
      <Text style={styles.avail}>Available {balance} credits</Text>

      {step === 'pad' ? (
        <>
          <View style={styles.amtBox}>
            <Text style={styles.amt}>{digits || '0'}</Text>
            <Text style={styles.amtLbl}>credits to spend</Text>
          </View>
          <View style={styles.pad}>
            {KEYS.map(k => (
              <TouchableOpacity key={k} style={styles.key} onPress={() => tapKey(k)}>
                <Text style={styles.keyTxt}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.dim]}
            disabled={busy}
            onPress={() => void makeIntent()}
          >
            <Text style={styles.primaryBtnText}>Make redeem QR</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'intent' ? (
        <>
          <Text style={styles.hint}>Show this to the shopkeeper</Text>
          <ChunkedQrPanel title={`Spend ${amount} credits`} packets={intentPackets} />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setScanFrames([]);
              setStep('scan_shop');
              setScanOpen(true);
            }}
          >
            <Text style={styles.primaryBtnText}>Scan shop confirmation</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'scan_shop' ? (
        <Text style={styles.hint}>Scan the shopkeeper proposal QR</Text>
      ) : null}

      {step === 'response' ? (
        <>
          <Text style={styles.ok}>Redeem signed. Show this QR back to the shop.</Text>
          <ChunkedQrPanel title="Customer response" packets={responsePackets} />
        </>
      ) : null}

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => {
          if (step === 'pad') {
            onBack();
          } else {
            setStep('pad');
            setIntentPackets([]);
            setResponsePackets([]);
            setScanFrames([]);
          }
        }}
      >
        <Text style={styles.secondaryBtnText}>{step === 'pad' ? 'Back' : 'Start over'}</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <QrScanSheet
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={onShopFrame}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111' },
  avail: { color: '#555', marginTop: 6, marginBottom: 12 },
  amtBox: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  amt: { color: '#FFF', fontSize: 48, fontWeight: '900' },
  amtLbl: { color: '#AAA', marginTop: 4 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: {
    width: '31%',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  keyTxt: { fontSize: 22, fontWeight: '800', color: '#111' },
  hint: { color: '#333', marginVertical: 8, fontWeight: '600' },
  ok: { color: '#2E7D32', fontWeight: '700', marginVertical: 8 },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  dim: { opacity: 0.6 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  error: { color: '#B00020', marginTop: 8 },
});
