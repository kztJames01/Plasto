import { EventPayload } from '../types/events';
import { EventStore } from './EventStore';

const API_BASE = 'http://localhost:8080/api/v1';

type SyncBatchResponse = {
  acknowledgedEventIds: string[];
  duplicateEventIds: string[];
  acceptedCount: number;
  duplicateCount: number;
};

function toServerEvent(event: EventPayload) {
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

export class SyncService {
  static async uploadBatch(limit: number = 50): Promise<SyncBatchResponse> {
    const events = await EventStore.getUnsynced(limit);
    if (events.length === 0) {
      return {
        acknowledgedEventIds: [],
        duplicateEventIds: [],
        acceptedCount: 0,
        duplicateCount: 0,
      };
    }

    const response = await fetch(`${API_BASE}/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events.map(toServerEvent) }),
    });

    if (!response.ok) {
      // Do not include the raw response body in the thrown message: it
      // can leak internal server details or HTML error pages to the UI
      // (which renders it). Log the body for diagnostics in dev only
      // and surface only a status-based message to the user.
      const body = await response.text().catch(() => '');
      if (__DEV__) {
        console.warn(`Sync failed (${response.status})`, body);
      }
      throw new Error(`Sync failed (${response.status})`);
    }

    const body = (await response.json()) as SyncBatchResponse;
    await EventStore.markSynced(body.acknowledgedEventIds ?? []);
    return body;
  }
}
