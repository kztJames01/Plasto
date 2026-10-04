import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE } from '../config/api';
import { PhotoEvidenceService } from '../services/PhotoEvidenceService';
import { SyncService } from '../services/SyncService';
import { EventPayload } from '../types/events';

type Props = {
  event: EventPayload;
  onBack: () => void;
};

type Thumb = {
  hash: string;
  uri: string;
};

export const TransactionDetailScreen: React.FC<Props> = ({ event, onBack }) => {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [note, setNote] = useState('');
  const isRedeem = event.eventType === 'REDEEM';
  const color = isRedeem ? '#C62828' : '#2E7D32';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const hashes = event.photoHashes ?? [];
      if (hashes.length === 0) {
        setThumbs([]);
        return;
      }
      const online = await SyncService.isOnline().catch(() => false);
      const next: Thumb[] = [];
      for (const hash of hashes) {
        const local = await PhotoEvidenceService.getLocalUri(hash);
        if (local) {
          next.push({ hash, uri: local.startsWith('file:') ? local : `file://${local}` });
        } else if (online) {
          next.push({ hash, uri: `${API_BASE}/photos/${hash}` });
        }
      }
      if (!cancelled) {
        setThumbs(next);
        if (hashes.length && next.length === 0) {
          setNote('Photos not on this phone. Connect to WiFi to fetch from cloud.');
        }
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [event.photoHashes]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Transaction</Text>
      <View style={styles.card}>
        <Text style={[styles.type, { color }]}>{event.eventType}</Text>
        <Text style={[styles.amt, { color }]}>
          {isRedeem ? '-' : '+'}
          {event.payload.credits} credits
        </Text>
        <Text style={styles.meta}>{new Date(event.createdAtLocal).toLocaleString()}</Text>
        {event.payload.plantId ? (
          <Text style={styles.meta}>Plant {event.payload.plantId}</Text>
        ) : null}
        {event.payload.weightKg != null ? (
          <Text style={styles.meta}>
            {event.payload.weightKg} kg · class {event.payload.plasticClass ?? '-'}
          </Text>
        ) : null}
        {event.payload.material ? (
          <Text style={styles.meta}>{event.payload.material}</Text>
        ) : null}
        {event.payload.notes ? <Text style={styles.meta}>{event.payload.notes}</Text> : null}
        <Text style={styles.hash}>Hash {event.eventHash}</Text>
        <Text style={styles.meta}>{event.synced ? 'synced' : 'pending sync'}</Text>
      </View>

      {thumbs.length ? (
        <View style={styles.thumbs}>
          {thumbs.map(t => (
            <Image key={t.hash} source={{ uri: t.uri }} style={styles.img} />
          ))}
        </View>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 16 },
  type: { fontWeight: '800', fontSize: 16 },
  amt: { fontSize: 36, fontWeight: '900', marginTop: 4 },
  meta: { color: '#555', marginTop: 6 },
  hash: { color: '#777', marginTop: 10, fontSize: 11 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  img: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#DDD' },
  note: { color: '#666', marginTop: 10 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
});
