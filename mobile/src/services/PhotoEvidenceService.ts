import { sha256 } from 'js-sha256';

import { getDatabase } from '../database/Database';

export type PhotoEvidenceInput = {
  label: string;
  /**
   * SHA-256 of the actual photo bytes, hex-encoded. Required: a hash built
   * from just a label and a timestamp (as in the previous implementation)
   * is trivially forgeable.
   */
  contentSha256Hex: string;
  localUri?: string;
  note?: string;
};

export type PendingPhoto = {
  photoHash: string;
  eventId: string | null;
  localUri: string;
  label: string;
};

const SHA256_HEX_RE = /^[A-Fa-f0-9]{64}$/;

export class PhotoEvidenceService {
  /**
   * Combine a verified content hash with metadata into a stable, tamper
   * evident evidence hash. The caller must already have computed the
   * SHA-256 of the photo bytes (e.g. via react-native-quick-crypto or
   * react-native-blob-util). Date.now() is included so two captures of the
   * same photo at different times produce different evidence records, but
   * the photo content itself is the binding factor.
   */
  static hashEvidence(input: PhotoEvidenceInput): string {
    if (!input.contentSha256Hex || !SHA256_HEX_RE.test(input.contentSha256Hex)) {
      throw new Error('hashEvidence: contentSha256Hex must be a 64-char hex SHA-256 of the photo bytes');
    }
    if (!input.label || input.label.trim().length === 0) {
      throw new Error('hashEvidence: label is required');
    }
    const seed = [
      input.contentSha256Hex.toLowerCase(),
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
    if (!SHA256_HEX_RE.test(hash)) {
      throw new Error('storeEvidence: hash must be a 64-char hex SHA-256');
    }
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
    for (const hash of hashes) {
      if (!SHA256_HEX_RE.test(hash)) {
        throw new Error('attachToEvent: every hash must be a 64-char hex SHA-256');
      }
    }
    const db = await getDatabase();
    for (const hash of hashes) {
      db.execute(`UPDATE photo_evidence SET event_id = ? WHERE photo_hash = ?`, [
        eventId,
        hash,
      ]);
    }
  }

  static async getPendingUploads(limit: number): Promise<PendingPhoto[]> {
    const db = await getDatabase();
    const result = db.execute(
      `SELECT photo_hash, event_id, local_uri, label
       FROM photo_evidence
       WHERE uploaded = 0 AND local_uri IS NOT NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      [limit],
    );
    return (result.rows?._array ?? []).map(row => ({
      photoHash: String(row.photo_hash),
      eventId: row.event_id ? String(row.event_id) : null,
      localUri: String(row.local_uri),
      label: String(row.label),
    }));
  }

  static async countPendingUploads(): Promise<number> {
    const db = await getDatabase();
    const row = db.execute(
      `SELECT COUNT(*) AS count FROM photo_evidence WHERE uploaded = 0 AND local_uri IS NOT NULL`,
    ).rows?._array?.[0];
    return Number(row?.count ?? 0);
  }

  static async markUploaded(hash: string): Promise<void> {
    const db = await getDatabase();
    db.execute(`UPDATE photo_evidence SET uploaded = 1 WHERE photo_hash = ?`, [hash]);
  }
}
