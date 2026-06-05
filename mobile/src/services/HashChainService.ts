import { sha256 } from 'js-sha256';
import { getDatabase } from '../database/Database';

type ChainRow = {
  event_id: string;
  event_hash: string;
  previous_hash: string | null;
  event_type: string;
  payload_json: string;
  created_at_local: number;
};

type ChainValidationResult = {
  valid: boolean;
  brokenEventId?: string;
  reason?: string;
};

export class HashChainService {
  static computeHash(
    eventType: string,
    payloadJson: string,
    previousHash: string | null,
    createdAtLocal: number,
  ): string {
    const prev = previousHash ?? '';
    // Hash payload + linkage fields so any tampering breaks all following events.
    const s = `${eventType}${payloadJson}${prev}${createdAtLocal}`;
    return sha256(s);
  }

  static async validateChain(pubkey: string): Promise<ChainValidationResult> {
    const db = await getDatabase();
    const rows = db.execute(
      `SELECT event_id, event_hash, previous_hash, event_type, payload_json, created_at_local
       FROM events
       WHERE customer_pubkey = ?
       ORDER BY created_at_local ASC, event_id ASC`,
      [pubkey],
    ).rows?._array as ChainRow[] | undefined;

    return this.validateRows(rows ?? []);
  }

  private static validateRows(rows: ChainRow[]): ChainValidationResult {
    for (let i = 0; i < rows.length; i++) {
      const ev = rows[i];
      const recomputed = this.computeHash(
        ev.event_type,
        ev.payload_json,
        ev.previous_hash,
        ev.created_at_local,
      );
      if (recomputed !== ev.event_hash) {
        return {
          valid: false,
          brokenEventId: ev.event_id,
          reason: 'Event hash does not match payload chain data',
        };
      }
      if (i > 0) {
        const prevEv = rows[i - 1];
        if (ev.previous_hash !== prevEv.event_hash) {
          return {
            valid: false,
            brokenEventId: ev.event_id,
            reason: 'Previous hash link is broken',
          };
        }
      }
    }
    return { valid: true };
  }
}
