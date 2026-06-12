import { getDatabase } from '../database/Database';
import {
  EventAppendInput,
  EventPayload,
  OperatorCertificate,
} from '../types/events';
import { HashChainService } from './HashChainService';
import { BalanceService } from './BalanceService';

export class EventStore {
  static async setAppRole(role: 'customer' | 'operator'): Promise<void> {
    const db = await getDatabase();
    db.execute(
      `INSERT OR REPLACE INTO user_metadata (key, value) VALUES ('app_role', ?)`,
      [role],
    );
  }

  static async getAppRole(): Promise<'customer' | 'operator' | null> {
    const db = await getDatabase();
    const r = db.execute(
      `SELECT value FROM user_metadata WHERE key = 'app_role' LIMIT 1`,
    );
    const v = r.rows?._array?.[0]?.value as string | undefined;
    if (v === 'customer' || v === 'operator') {
      return v;
    }
    return null;
  }

  static async append(event: EventAppendInput): Promise<void> {
    const db = await getDatabase();

    const prevResult = event.customerPubkey
      ? db.execute(
          `SELECT event_hash
           FROM events
           WHERE customer_pubkey = ?
           ORDER BY created_at_local DESC
           LIMIT 1`,
          [event.customerPubkey],
        )
      : db.execute(
          `SELECT event_hash
           FROM events
           ORDER BY created_at_local DESC
           LIMIT 1`,
        );
    const previousHash = prevResult.rows?._array?.[0]?.event_hash ?? null;

    const payloadJson = JSON.stringify(event.payload);
    const eventHash = HashChainService.computeHash(
      event.eventType,
      payloadJson,
      previousHash,
      event.createdAtLocal,
    );

    const syncedFlag = event.synced === true ? 1 : 0;

    db.execute(
      `INSERT INTO events (
        event_id, event_type, payload_json, customer_pubkey,
        operator_pubkey, customer_sig, operator_sig, photo_hashes,
        previous_hash, event_hash, created_at_local, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.eventType,
        payloadJson,
        event.customerPubkey,
        event.operatorPubkey,
        event.customerSig,
        event.operatorSig,
        JSON.stringify(event.photoHashes),
        previousHash,
        eventHash,
        event.createdAtLocal,
        syncedFlag,
      ],
    );

    // We recompute from events to avoid drift from partial writes.
    if (event.customerPubkey) {
      await BalanceService.recalculate(event.customerPubkey);
    }
  }

  static async getLatestEventHashForOperator(
    operatorPubkey: string,
  ): Promise<string | null> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT event_hash
       FROM events
       WHERE operator_pubkey = ?
       ORDER BY created_at_local DESC, event_id DESC
       LIMIT 1`,
      [operatorPubkey],
    );

    return result.rows?._array?.[0]?.event_hash ?? null;
  }

  static async appendPrepared(
    event: EventPayload,
    payloadJson: string = JSON.stringify(event.payload),
  ): Promise<void> {
    const db = await getDatabase();
    const syncedFlag = event.synced === true ? 1 : 0;

    db.execute(
      `INSERT OR IGNORE INTO events (
        event_id, event_type, payload_json, customer_pubkey,
        operator_pubkey, customer_sig, operator_sig, photo_hashes,
        previous_hash, event_hash, created_at_local, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.eventType,
        payloadJson,
        event.customerPubkey,
        event.operatorPubkey,
        event.customerSig,
        event.operatorSig,
        JSON.stringify(event.photoHashes),
        event.previousHash,
        event.eventHash,
        event.createdAtLocal,
        syncedFlag,
      ],
    );

    if (event.customerPubkey) {
      await BalanceService.recalculate(event.customerPubkey);
    }
  }

  static async getUnsynced(limit: number = 1000): Promise<EventPayload[]> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT * FROM events WHERE synced = 0 ORDER BY created_at_local ASC LIMIT ?`,
      [limit],
    );

    return (result.rows?._array ?? []).map(EventStore.rowToEvent);
  }

  static async countUnsynced(): Promise<number> {
    const db = await getDatabase();
    const row = db.execute(
      `SELECT COUNT(*) AS count FROM events WHERE synced = 0`,
    ).rows?._array?.[0];

    return Number(row?.count ?? 0);
  }

  static async markSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
      return;
    }
    const db = await getDatabase();
    const placeholders = eventIds.map(() => '?').join(',');
    db.execute(
      `UPDATE events SET synced = 1 WHERE event_id IN (${placeholders})`,
      eventIds,
    );
  }

  static async getEventsForCustomer(pubkey: string): Promise<EventPayload[]> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT * FROM events WHERE customer_pubkey = ? ORDER BY created_at_local DESC`,
      [pubkey],
    );

    return (result.rows?._array ?? []).map(EventStore.rowToEvent);
  }

  static async getEventsForOperator(pubkey: string): Promise<EventPayload[]> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT * FROM events WHERE operator_pubkey = ? ORDER BY created_at_local DESC`,
      [pubkey],
    );

    return (result.rows?._array ?? []).map(EventStore.rowToEvent);
  }

  static async getBalance(pubkey: string): Promise<number> {
    const snapshot = await BalanceService.getSnapshot(pubkey);
    return snapshot.balance;
  }

  static async recalculateBalance(pubkey: string): Promise<number> {
    return BalanceService.recalculate(pubkey);
  }

  static async storeOperatorCertificate(cert: OperatorCertificate): Promise<void> {
    const db = await getDatabase();
    db.execute(
      `INSERT OR REPLACE INTO operator_certificates (
        certificate_id, operator_pubkey, plant_id, float_cap,
        admin_pubkey, admin_sig, issued_at, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cert.certificateId,
        cert.operatorPubkey,
        cert.plantId,
        cert.floatCap,
        cert.adminPubkey,
        cert.adminSig,
        cert.issuedAt,
        cert.expiresAt,
        cert.isActive ? 1 : 0,
      ],
    );
  }

  static async getOperatorCertificate(
    operatorPubkey: string,
  ): Promise<OperatorCertificate | null> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT * FROM operator_certificates WHERE operator_pubkey = ? AND is_active = 1 LIMIT 1`,
      [operatorPubkey],
    );

    const row = result.rows?._array?.[0];
    if (!row) {
      return null;
    }

    return {
      certificateId: row.certificate_id,
      operatorPubkey: row.operator_pubkey,
      plantId: row.plant_id,
      floatCap: row.float_cap,
      adminPubkey: row.admin_pubkey,
      adminSig: row.admin_sig,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      isActive: row.is_active === 1,
    };
  }

  static async getFloatConsumed(operatorPubkey: string): Promise<number> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT payload_json FROM events WHERE operator_pubkey = ? AND event_type = 'DEPOSIT'`,
      [operatorPubkey],
    );
    const rows = result.rows?._array ?? [];
    let sum = 0;
    for (const row of rows) {
      try {
        const payload = JSON.parse(String(row.payload_json));
        sum += Number(payload.credits) || 0;
      } catch {
        // skip bad row
      }
    }
    return sum;
  }

  static async getRemainingFloat(operatorPubkey: string): Promise<number> {
    const cert = await this.getOperatorCertificate(operatorPubkey);
    if (!cert) {
      return 0;
    }

    const consumed = await this.getFloatConsumed(operatorPubkey);
    return cert.floatCap - consumed;
  }

  private static rowToEvent(row: any): EventPayload {
    return {
      eventId: row.event_id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload_json),
      customerPubkey: row.customer_pubkey,
      operatorPubkey: row.operator_pubkey,
      customerSig: row.customer_sig,
      operatorSig: row.operator_sig,
      photoHashes: JSON.parse(row.photo_hashes ?? '[]'),
      previousHash: row.previous_hash,
      eventHash: row.event_hash,
      createdAtLocal: row.created_at_local,
      synced: row.synced === 1,
    };
  }

}
