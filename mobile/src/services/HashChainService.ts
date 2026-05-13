import { sha256 } from 'js-sha256';

export class HashChainService {
  static computeHash(
    eventType: string,
    payloadJson: string,
    previousHash: string | null,
    createdAtLocal: number,
  ): string {
    const prev = previousHash ?? '';
    const s = `${eventType}${payloadJson}${prev}${createdAtLocal}`;
    return sha256(s);
  }

  static validateChain(
    events: Array<{
      eventHash: string;
      previousHash: string | null;
      eventType: string;
      payload_json: string;
      created_at_local: number;
    }>,
  ): boolean {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const recomputed = this.computeHash(
        ev.eventType,
        ev.payload_json,
        ev.previousHash,
        ev.created_at_local,
      );
      if (recomputed !== ev.eventHash) {
        return false;
      }
      if (i > 0) {
        const prevEv = events[i - 1];
        if (ev.previousHash !== prevEv.eventHash) {
          return false;
        }
      }
    }
    return true;
  }
}
