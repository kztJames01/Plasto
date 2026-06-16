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

/**
 * Deterministic JSON canonicalization: object keys are sorted, whitespace is
 * stripped, numbers are emitted as plain decimals. The server uses an
 * equivalent implementation (see backend EventHashService.CanonicalJson) so
 * the hashes computed on device match the hashes recomputed server-side.
 */
export function canonicalizePayloadJson(payloadJson: string): string {
  if (!payloadJson) {
    return '';
  }
  try {
    return JSON.stringify(canonicalize(JSON.parse(payloadJson)));
  } catch {
    // Non-JSON payloads fall through; the server's hash check will reject them.
    return payloadJson;
  }
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export class HashChainService {
  static computeHash(
    eventId: string,
    eventType: string,
    payloadJson: string,
    previousHash: string | null,
    createdAtLocal: number,
  ): string {
    const prev = previousHash ?? '';
    // Must match backend EventHashService.computeEventHash byte-for-byte.
    const canonical = canonicalizePayloadJson(payloadJson);
    const s = `${eventId}|${eventType}|${canonical}|${prev}|${createdAtLocal}`;
    return sha256(s);
  }

  /**
   * Validate the per-customer hash chain. Most local UI flows only need
   * this; operator-side validation is exposed via validateOperatorChain.
   */
  static async validateChain(pubkey: string): Promise<ChainValidationResult> {
    return this.validateChainFor('customer_pubkey', pubkey);
  }

  /**
   * Validate the per-operator hash chain. An operator phone should call
   * this before flushing a batch to the server so a tampered local event
   * log surfaces immediately rather than as a sync rejection hours later.
   */
  static async validateOperatorChain(operatorPubkey: string): Promise<ChainValidationResult> {
    return this.validateChainFor('operator_pubkey', operatorPubkey);
  }

  private static async validateChainFor(
    column: 'customer_pubkey' | 'operator_pubkey',
    pubkey: string,
  ): Promise<ChainValidationResult> {
    const db = await getDatabase();
    const rows = db.execute(
      `SELECT event_id, event_hash, previous_hash, event_type, payload_json, created_at_local
       FROM events
       WHERE ${column} = ?
       ORDER BY created_at_local ASC, event_id ASC`,
      [pubkey],
    ).rows?._array as ChainRow[] | undefined;

    return this.validateRows(rows ?? []);
  }

  private static validateRows(rows: ChainRow[]): ChainValidationResult {
    for (let i = 0; i < rows.length; i++) {
      const ev = rows[i];
      const recomputed = this.computeHash(
        ev.event_id,
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
