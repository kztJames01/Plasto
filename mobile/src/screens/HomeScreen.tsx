import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { QRDisplay } from '../components/QRDisplay';
import { BalanceService } from '../services/BalanceService';
import { CryptoService } from '../services/CryptoService';
import { Identity } from '../types/identity';

const API_BASE = 'http://localhost:8080/api/v1';

type HomeScreenProps = {
  identity: Identity;
  onReviewProposal: () => void;
  onRedeem: () => void;
  onHistory: () => void;
};

function formatLastUpdated(updatedAt: number | null): string {
  if (!updatedAt) {
    return 'never';
  }
  const diffMs = Date.now() - updatedAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function tryOnlineSync(pubkey: string): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    // This ping doubles as a lightweight online check.
    const response = await fetch(`${API_BASE}/users/${pubkey}/recover`, {
      method: 'POST',
      signal: controller.signal as never,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  identity,
  onReviewProposal,
  onRedeem,
  onHistory,
}) => {
  const pubkey = useMemo(
    () => CryptoService.encodePublicKeyBase58(identity.publicKey),
    [identity.publicKey],
  );
  const [balance, setBalance] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncNote, setSyncNote] = useState('Pull to refresh');

  const loadBalance = useCallback(async () => {
    const snap = await BalanceService.getSnapshot(pubkey);
    if (snap.updatedAt == null) {
      await BalanceService.recalculate(pubkey);
      const refreshed = await BalanceService.getSnapshot(pubkey);
      setBalance(refreshed.balance);
      setLastUpdated(refreshed.updatedAt);
      return;
    }
    setBalance(snap.balance);
    setLastUpdated(snap.updatedAt);
  }, [pubkey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const online = await tryOnlineSync(pubkey);
      await BalanceService.recalculate(pubkey);
      const snap = await BalanceService.getSnapshot(pubkey);
      setBalance(snap.balance);
      setLastUpdated(snap.updatedAt);
      setSyncNote(
        online
          ? 'Synced and refreshed'
          : `Offline. Last updated ${formatLastUpdated(snap.updatedAt)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }, [pubkey]);

  useEffect(() => {
    loadBalance().catch(() => undefined);
  }, [loadBalance]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Your wallet</Text>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
        <Text style={styles.balanceSuffix}>credits</Text>
      </View>
      <Text style={styles.meta}>Last updated: {formatLastUpdated(lastUpdated)}</Text>
      <Text style={styles.meta}>{syncNote}</Text>
      <View style={styles.qrWrap}>
        <QRDisplay publicKeyBase58={pubkey} />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onReviewProposal}>
          <Text style={styles.primaryBtnText}>Sign deposit proposal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRedeem}>
          <Text style={styles.secondaryBtnText}>Redeem credits</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onHistory}>
          <Text style={styles.secondaryBtnText}>History</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 18, color: '#111' },
  balanceCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#111',
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: { color: '#AFAFAF', fontSize: 16, marginBottom: 8 },
  balanceValue: { color: '#FFF', fontSize: 54, fontWeight: '800', lineHeight: 62 },
  balanceSuffix: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  meta: { color: '#666', fontSize: 14, marginBottom: 4 },
  qrWrap: { width: '100%', marginTop: 18 },
  actions: { width: '100%', marginTop: 8, gap: 10 },
  primaryBtn: {
    backgroundColor: '#0A7AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#0A7AFF', fontSize: 16, fontWeight: '700' },
});
