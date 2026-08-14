import NetInfo from '@react-native-community/netinfo';
import { Buffer } from 'buffer';

import { API_BASE } from '../config/api';
import { EventPayload } from '../types/events';
import { CryptoService } from './CryptoService';
import { EventStore } from './EventStore';
import { KeychainService } from './KeychainService';
import { PhotoUploadService } from './PhotoUploadService';

const BATCH_SIZE = 50;
const MAX_RETRIES = 4;

type SyncBatchResponse = {
  acknowledgedEventIds: string[];
  duplicateEventIds: string[];
  acceptedCount: number;
  duplicateCount: number;
};

type ServerEvent = {
  eventId: string;
  eventType: string;
  payloadJson: string;
  customerPubkey: string | null;
  operatorPubkey: string;
  customerSig: string | null;
  operatorSig: string;
  photoHashes: string;
  previousHash: string | null;
  eventHash: string;
  createdAtLocal: number;
};

export type SyncAllResult = {
  batches: number;
  accepted: number;
  duplicates: number;
  photosUploaded: number;
  photosFailed: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripWirePrefix(value: string | null): string | null {
  if (!value) {
    return value;
  }
  const lower = value.toLowerCase();
  for (const prefix of ['base58:', 'base64:', 'base64url:', 'hex:']) {
    if (lower.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }
  return value;
}

function toServerEvent(event: EventPayload): ServerEvent {
  // Keep pubkey/sig strings identical to what was signed locally.
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    payloadJson: JSON.stringify(event.payload),
    customerPubkey: event.customerPubkey,
    operatorPubkey: event.operatorPubkey,
    customerSig: event.customerSig,
    operatorSig: event.operatorSig,
    photoHashes: JSON.stringify(event.photoHashes),
    previousHash: event.previousHash,
    eventHash: event.eventHash,
    createdAtLocal: event.createdAtLocal,
  };
}

function fromServerEvent(raw: ServerEvent): EventPayload {
  return {
    eventId: raw.eventId,
    eventType: raw.eventType as EventPayload['eventType'],
    payload: JSON.parse(raw.payloadJson),
    customerPubkey: stripWirePrefix(raw.customerPubkey),
    operatorPubkey: stripWirePrefix(raw.operatorPubkey) ?? raw.operatorPubkey,
    customerSig: stripWirePrefix(raw.customerSig),
    operatorSig: stripWirePrefix(raw.operatorSig) ?? raw.operatorSig,
    photoHashes: JSON.parse(raw.photoHashes ?? '[]'),
    previousHash: raw.previousHash,
    eventHash: raw.eventHash,
    createdAtLocal: raw.createdAtLocal,
    synced: true,
  };
}

function parseSyncError(status: number, body: string): Error {
  const lower = body.toLowerCase();
  if (status === 409 && lower.includes('float')) {
    return new Error('Float exceeded — sync rejected. Contact plant admin to top up float.');
  }
  if (status === 409 && lower.includes('hash chain')) {
    return new Error('Hash chain conflict — local events may be out of order.');
  }
  if (status === 401 || status === 403) {
    return new Error('Sync unauthorized — operator certificate may be missing or expired.');
  }
  return new Error(`Sync failed (${status})`);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal as never });
      clearTimeout(timer);
      if (response.status >= 500 && attempt < retries - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries - 1) {
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

export class SyncService {
  static async isOnline(): Promise<boolean> {
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false || net.isInternetReachable === false) {
        return false;
      }
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  static async isOnWifi(): Promise<boolean> {
    try {
      const net = await NetInfo.fetch();
      return net.type === 'wifi' && net.isConnected === true;
    } catch {
      return false;
    }
  }

  static async push(limit: number = BATCH_SIZE): Promise<SyncBatchResponse> {
    const events = await EventStore.getUnsynced(limit);
    if (events.length === 0) {
      return {
        acknowledgedEventIds: [],
        duplicateEventIds: [],
        acceptedCount: 0,
        duplicateCount: 0,
      };
    }

    const response = await fetchWithRetry(`${API_BASE}/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events.map(toServerEvent) }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (__DEV__) {
        console.warn(`Sync failed (${response.status})`, body);
      }
      throw parseSyncError(response.status, body);
    }

    const body = (await response.json()) as SyncBatchResponse;
    const syncedIds = new Set<string>([
      ...(body.acknowledgedEventIds ?? []),
      ...(body.duplicateEventIds ?? []),
    ]);
    await EventStore.markSynced([...syncedIds]);
    return body;
  }

  static async pushAll(): Promise<{ batches: number; accepted: number; duplicates: number }> {
    let batches = 0;
    let accepted = 0;
    let duplicates = 0;

    while ((await EventStore.countUnsynced()) > 0) {
      const before = await EventStore.countUnsynced();
      const result = await SyncService.push(BATCH_SIZE);
      batches += 1;
      accepted += result.acceptedCount;
      duplicates += result.duplicateCount;
      const after = await EventStore.countUnsynced();
      if (after >= before && result.acceptedCount === 0 && result.duplicateCount === 0) {
        break;
      }
    }

    return { batches, accepted, duplicates };
  }

  static async pull(customerPubkey: string): Promise<number> {
    const cursor = await EventStore.getLatestCustomerEventCursor(customerPubkey);
    const keys = await KeychainService.retrieveCustomerKeys();
    if (!keys) {
      throw new Error('No customer keys for pull proof');
    }
    const proofMessage = `PLASTO_PULL|${customerPubkey}|${cursor.ts}|${cursor.eventId}`;
    const proofSig = Buffer.from(
      CryptoService.sign(Buffer.from(proofMessage, 'utf8'), Buffer.from(keys.secretKey, 'base64')),
    ).toString('base64');

    const response = await fetchWithRetry(
      `${API_BASE}/users/events?pubkey=${encodeURIComponent(customerPubkey)}&after=${cursor.ts}&afterEventId=${encodeURIComponent(cursor.eventId)}`,
      {
        method: 'GET',
        headers: {
          'X-Plasto-Pubkey': customerPubkey,
          'X-Plasto-Proof': proofSig,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Pull failed (${response.status})`);
    }
    const rows = (await response.json()) as ServerEvent[];
    return EventStore.importRemoteEvents(rows.map(fromServerEvent));
  }

  static async syncAll(): Promise<SyncAllResult> {
    // Photos first so evidence exists before/with event settlement.
    const photoResult = await PhotoUploadService.uploadPending(50);
    const pushResult = await SyncService.pushAll();
    return {
      ...pushResult,
      photosUploaded: photoResult.uploaded,
      photosFailed: photoResult.failed,
    };
  }

  static async autoSyncIfOnline(): Promise<SyncAllResult | null> {
    // Roadmap AC: auto-sync on WiFi only (not cellular).
    if (!(await SyncService.isOnWifi())) {
      return null;
    }
    if (!(await SyncService.isOnline())) {
      return null;
    }
    try {
      return await SyncService.syncAll();
    } catch (err) {
      if (__DEV__) {
        console.warn('auto sync failed', err);
      }
      return null;
    }
  }
}
