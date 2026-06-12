import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventStore } from '../services/EventStore';
import { SyncService } from '../services/SyncService';
import { EventPayload } from '../types/events';

type Props = {
  onBack: () => void;
};

export const SyncDashboardScreen: React.FC<Props> = ({ onBack }) => {
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setEvents(await EventStore.getUnsynced(50));
  }, []);

  useEffect(() => {
    load().catch(err => setStatus(String(err.message ?? err)));
  }, [load]);

  const sync = async () => {
    setStatus('Uploading...');
    try {
      const result = await SyncService.uploadBatch(50);
      setStatus(
        `Accepted ${result.acceptedCount}, duplicates ${result.duplicateCount}`,
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
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => void sync()}>
        <Text style={styles.primaryBtnText}>Upload batch</Text>
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
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
  status: { color: '#333', marginVertical: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginTop: 10 },
  eventType: { color: '#111', fontWeight: '800' },
  meta: { color: '#555', marginTop: 4 },
});
