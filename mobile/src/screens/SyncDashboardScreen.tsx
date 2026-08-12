import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventStore } from '../services/EventStore';
import { PhotoEvidenceService } from '../services/PhotoEvidenceService';
import { SyncService } from '../services/SyncService';
import { EventPayload } from '../types/events';

type Props = {
  onBack: () => void;
};

export const SyncDashboardScreen: React.FC<Props> = ({ onBack }) => {
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setEvents(await EventStore.getUnsynced(50));
    setPendingPhotos(await PhotoEvidenceService.countPendingUploads());
    setOnline(await SyncService.isOnline());
  }, []);

  useEffect(() => {
    load().catch(err => setStatus(String(err.message ?? err)));
    SyncService.autoSyncIfOnline()
      .then(result => {
        if (result) {
          setStatus(
            `Auto-sync: ${result.accepted} events, ${result.photosUploaded} photos`,
          );
          return load();
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [load]);

  const syncBatch = async () => {
    setStatus('Uploading one batch...');
    try {
      const result = await SyncService.push(50);
      setStatus(`Accepted ${result.acceptedCount}, duplicates ${result.duplicateCount}`);
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const syncAll = async () => {
    setStatus('Uploading everything...');
    try {
      const result = await SyncService.syncAll();
      setStatus(
        `Done: ${result.accepted} new, ${result.duplicates} dupes, ${result.photosUploaded} photos uploaded`,
      );
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sync</Text>
      <View style={styles.panel}>
        <Text style={styles.count}>{events.length}</Text>
        <Text style={styles.label}>pending events</Text>
        <Text style={styles.small}>Pending photos: {pendingPhotos}</Text>
        <Text style={styles.small}>{online ? 'Server reachable' : 'Offline'}</Text>
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => void syncAll()}>
        <Text style={styles.primaryBtnText}>Upload all</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => void syncBatch()}>
        <Text style={styles.secondaryBtnText}>Upload one batch</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {events.map(event => (
        <View key={event.eventId} style={styles.card}>
          <Text style={styles.eventType}>{event.eventType}</Text>
          <Text style={styles.meta}>{event.payload.credits} credits</Text>
          <Text style={styles.meta}>Hash {event.eventHash.slice(0, 24)}...</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  panel: { backgroundColor: '#FFF', borderRadius: 10, padding: 16, alignItems: 'center' },
  count: { color: '#111', fontSize: 48, fontWeight: '900' },
  label: { color: '#555', fontWeight: '700' },
  small: { color: '#666', marginTop: 8, fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  status: { color: '#333', marginVertical: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginTop: 10 },
  eventType: { color: '#111', fontWeight: '800' },
  meta: { color: '#555', marginTop: 4 },
});
