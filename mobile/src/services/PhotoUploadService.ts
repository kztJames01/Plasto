import RNFS from 'react-native-fs';

import { API_BASE } from '../config/api';
import { PhotoEvidenceService, PendingPhoto } from './PhotoEvidenceService';

type PresignResponse = {
  hash: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
};

function normalizeUri(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  return uri;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class PhotoUploadService {
  static async uploadPending(limit: number = 20): Promise<{ uploaded: number; failed: number }> {
    const pending = await PhotoEvidenceService.getPendingUploads(limit);
    let uploaded = 0;
    let failed = 0;
    for (const photo of pending) {
      try {
        await PhotoUploadService.uploadOne(photo);
        uploaded += 1;
      } catch (err) {
        failed += 1;
        if (__DEV__) {
          console.warn('photo upload failed', photo.photoHash, err);
        }
      }
    }
    return { uploaded, failed };
  }

  static async uploadOne(photo: PendingPhoto): Promise<void> {
    const eventId = photo.eventId ?? undefined;
    const presign = await fetch(`${API_BASE}/photos/presigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: photo.photoHash,
        contentType: 'image/jpeg',
        eventId,
      }),
    });
    if (!presign.ok) {
      throw new Error(`Presign failed (${presign.status})`);
    }
    const body = (await presign.json()) as PresignResponse;

    const path = normalizeUri(photo.localUri);
    const exists = await RNFS.exists(path);
    if (!exists) {
      throw new Error('Local photo file missing');
    }
    const fileB64 = await RNFS.readFile(path, 'base64');

    let uploadOk = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const upload = await fetch(body.uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: fileB64,
      });
      if (upload.ok) {
        uploadOk = true;
        break;
      }
      await sleep(500 * 2 ** attempt);
    }
    if (!uploadOk) {
      throw new Error('Upload PUT failed');
    }

    const complete = await fetch(`${API_BASE}/photos/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: photo.photoHash,
        bytes: fileB64.length,
      }),
    });
    if (!complete.ok) {
      throw new Error(`Complete failed (${complete.status})`);
    }

    await PhotoEvidenceService.markUploaded(photo.photoHash);
  }
}
