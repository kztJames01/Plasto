import { sha256 } from 'js-sha256';

import { getDatabase } from '../database/Database';

export type PhotoEvidenceInput = {
  label: string;
  localUri?: string;
  note?: string;
};

export class PhotoEvidenceService {
  static hashEvidence(input: PhotoEvidenceInput): string {
    const seed = [
      input.label.trim(),
      input.localUri?.trim() ?? '',
      input.note?.trim() ?? '',
      Date.now().toString(),
    ].join('|');
    return sha256(seed);
  }

  static async storeEvidence(
    eventId: string | null,
    hash: string,
    label: string,
    localUri?: string,
  ): Promise<void> {
    const db = await getDatabase();
    db.execute(
      `INSERT OR IGNORE INTO photo_evidence (
        photo_hash, event_id, label, local_uri, created_at, uploaded
      ) VALUES (?, ?, ?, ?, ?, 0)`,
      [hash, eventId, label, localUri ?? null, Date.now()],
    );
  }

  static async attachToEvent(eventId: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }
    const db = await getDatabase();
    for (const hash of hashes) {
      db.execute(`UPDATE photo_evidence SET event_id = ? WHERE photo_hash = ?`, [
        eventId,
        hash,
      ]);
    }
  }
}
