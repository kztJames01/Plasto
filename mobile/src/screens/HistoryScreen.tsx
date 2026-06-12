import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CryptoService } from '../services/CryptoService';
import { EventStore } from '../services/EventStore';
import { EventPayload } from '../types/events';
import { Identity } from '../types/identity';

type Props = {
  identity: Identity;
  onBack: () => void;
};

export const HistoryScreen: React.FC<Props> = ({ identity, onBack }) => {
  const pubkey = useMemo(
    () => CryptoService.encodePublicKeyBase58(identity.publicKey),
    [identity.publicKey],
  );
  const [events, setEvents] = useState<EventPayload[]>([]);

  const load = useCallback(async () => {
    setEvents(await EventStore.getEventsForCustomer(pubkey));
  }, [pubkey]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>History</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>No signed events on this phone yet.</Text>
      ) : (
        events.map(event => (
          <View key={event.eventId} style={styles.card}>
            <Text style={styles.type}>{event.eventType}</Text>
            <Text style={styles.amount}>{event.payload.credits} credits</Text>
            <Text style={styles.meta}>
              {new Date(event.createdAtLocal).toLocaleString()} •{' '}
              {event.synced ? 'synced' : 'pending sync'}
            </Text>
            <Text style={styles.hash}>Hash {event.eventHash.slice(0, 24)}...</Text>
          </View>
        ))
      )}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 48, backgroundColor: '#F7F7F7' },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 16 },
  empty: { color: '#555', backgroundColor: '#FFF', borderRadius: 10, padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 10 },
  type: { color: '#555', fontWeight: '700' },
  amount: { color: '#111', fontWeight: '900', fontSize: 24, marginTop: 4 },
  meta: { color: '#555', marginTop: 4 },
  hash: { color: '#777', marginTop: 6, fontSize: 12 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
});
