import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ChunkedQrPanel } from '../components/ChunkedQrPanel';
import { PhotoReviewStrip } from '../components/PhotoReviewStrip';
import { DepositProposalService } from '../services/DepositProposalService';
import { LocalAiClassifierService } from '../services/LocalAiClassifierService';
import { CapturedPhoto, PhotoCaptureService } from '../services/PhotoCaptureService';
import { PriceService } from '../services/PriceService';
import { PriceSyncService } from '../services/PriceSyncService';
import { DepositProposal, PlasticClass } from '../types/events';

type Props = {
  onBack: () => void;
};

export const DepositFlowScreen: React.FC<Props> = ({ onBack }) => {
  const [customerPubkey, setCustomerPubkey] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [plasticClass, setPlasticClass] = useState<PlasticClass>('A');
  const [material, setMaterial] = useState('plastic bottle');
  const [photos, setPhotos] = useState<Array<CapturedPhoto | null>>([null, null, null]);
  const [proposal, setProposal] = useState<DepositProposal | null>(null);
  const [proposalPackets, setProposalPackets] = useState<string[]>([]);
  const [creditsPreview, setCreditsPreview] = useState<number>(0);
  const [ratePreview, setRatePreview] = useState<number>(0);
  const [aiStatus, setAiStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void PriceSyncService.syncLatest();
    void reloadPricingPreview(weightKg, plasticClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadPricingPreview = async (nextWeight: string, nextClass: PlasticClass) => {
    const w = Number(nextWeight);
    if (!w || w <= 0) {
      setCreditsPreview(0);
      setRatePreview(await PriceService.getRate(nextClass));
      return;
    }
    const [credits, rate] = await Promise.all([
      PriceService.computeCredits(w, nextClass),
      PriceService.getRate(nextClass),
    ]);
    setCreditsPreview(credits);
    setRatePreview(rate);
  };

  const capturePhoto = async (index: number) => {
    setError('');
    try {
      const photo = await PhotoCaptureService.capture(
        `deposit-photo-${index + 1}`,
        `${customerPubkey}:${weightKg}:${material}`,
      );
      setPhotos(current => current.map((p, i) => (i === index ? photo : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runAiSuggest = () => {
    setError('');
    const hashes = photos.filter(Boolean).map(p => p!.evidenceHash);
    if (hashes.length < 3) {
      setError('Capture 3 photos first so AI can estimate class');
      return;
    }
    const ai = LocalAiClassifierService.suggest({
      material,
      weightKg: Number(weightKg) || 0,
      photoHashes: hashes,
    });
    setPlasticClass(ai.suggestedClass);
    setAiStatus(`AI suggests class ${ai.suggestedClass} (${ai.confidence}%) - ${ai.reason}`);
    void reloadPricingPreview(weightKg, ai.suggestedClass);
  };

  const createProposal = async () => {
    setError('');
    setProposal(null);
    setProposalPackets([]);
    setBusy(true);
    try {
      const cleanHashes = photos.filter(Boolean).map(p => p!.evidenceHash);
      const next = await DepositProposalService.createProposal({
        customerPubkey,
        weightKg: Number(weightKg),
        plasticClass,
        material,
        photoHashes: cleanHashes,
        aiSuggestion: plasticClass,
        aiConfidence: Number(aiStatus.match(/\((\d+)%\)/)?.[1] ?? 0),
      });
      setProposal(next);
      setProposalPackets(DepositProposalService.encodeForQr('proposal', next));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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
          onChangeText={next => {
            setWeightKg(next);
            void reloadPricingPreview(next, plasticClass);
          }}
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
        <ClassSelector
          value={plasticClass}
          onChange={next => {
            setPlasticClass(next);
            void reloadPricingPreview(weightKg, next);
          }}
        />

        <View style={styles.rateCard}>
          <Text style={styles.rateText}>Rate {ratePreview} /kg</Text>
          <Text style={styles.creditText}>Credits {creditsPreview}</Text>
        </View>

        <Text style={styles.label}>Photo evidence (3 required)</Text>
        <PhotoReviewStrip photos={photos} onCapture={i => void capturePhoto(i)} />
        <Text style={styles.small}>
          {photos.filter(Boolean).length}/3 captured
        </Text>

        <TouchableOpacity style={styles.secondaryBtn} onPress={runAiSuggest}>
          <Text style={styles.secondaryBtnText}>Run AI class suggestion</Text>
        </TouchableOpacity>
        {aiStatus ? <Text style={styles.small}>{aiStatus}</Text> : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => void createProposal()}>
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Create signed proposal</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {proposal ? (
          <View style={styles.output}>
            <Text style={styles.outputTitle}>Proposal JSON (fallback)</Text>
            <TextInput
              style={styles.outputText}
              value={proposalJson}
              multiline
              editable={false}
              selectTextOnFocus
            />
          </View>
        ) : null}
        {proposalPackets.length ? (
          <ChunkedQrPanel title="Proposal QR frames" packets={proposalPackets} />
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
  small: { color: '#666', marginTop: 6, fontSize: 12 },
  input: {
    backgroundColor: '#FFF',
    borderColor: '#D6D6D6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111',
  },
  rateCard: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rateText: { color: '#555', fontWeight: '700' },
  creditText: { color: '#111', fontWeight: '900', fontSize: 18 },
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
