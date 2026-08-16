import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CryptoService } from '../services/CryptoService';
import { EventStore } from '../services/EventStore';
import { EventPayload } from '../types/events';
import { Identity } from '../types/identity';

type Props = {
  identity: Identity;
  onBack: () => void;
  onOpenEvent: (event: EventPayload) => void;
};

export const HistoryScreen: React.FC<Props> = ({ identity, onBack, onOpenEvent }) => {
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
        events.map(event => {
          const redeem = event.eventType === 'REDEEM';
          const color = redeem ? '#C62828' : '#2E7D32';
          return (
            <TouchableOpacity
              key={event.eventId}
              style={styles.card}
              onPress={() => onOpenEvent(event)}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.type, { color }]}>{event.eventType}</Text>
              <Text style={[styles.amount, { color }]}>
                {redeem ? '-' : '+'}
                {event.payload.credits} credits
              </Text>
              <Text style={styles.meta}>
                {new Date(event.createdAtLocal).toLocaleString()}
                {event.payload.plantId ? ` • ${event.payload.plantId}` : ''}
              </Text>
              <Text style={styles.hash}>
                {event.synced ? 'synced' : 'pending sync'} · {event.eventHash.slice(0, 18)}...
              </Text>
            </TouchableOpacity>
          );
        })
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
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  type: { fontWeight: '800' },
  amount: { fontWeight: '900', fontSize: 24, marginTop: 4 },
  meta: { color: '#555', marginTop: 4 },
  hash: { color: '#777', marginTop: 6, fontSize: 12 },
  secondaryBtn: { paddingVertical: 15, alignItems: 'center' },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
});
