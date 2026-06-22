import { sha256 } from 'js-sha256';
import { Asset, CameraOptions, launchCamera } from 'react-native-image-picker';
import RNFS from 'react-native-fs';

import { PhotoEvidenceService } from './PhotoEvidenceService';

export type CapturedPhoto = {
  uri: string;
  contentHash: string;
  evidenceHash: string;
  label: string;
};

const cameraOpts: CameraOptions = {
  mediaType: 'photo',
  saveToPhotos: false,
  cameraType: 'back',
  quality: 0.8,
  includeBase64: false,
};

function normalizeUri(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  return uri;
}

async function readAssetBase64(asset: Asset): Promise<string> {
  if (!asset.uri) {
    throw new Error('Camera returned no uri');
  }
  const clean = normalizeUri(asset.uri);
  return RNFS.readFile(clean, 'base64');
}

export class PhotoCaptureService {
  static async capture(label: string, note: string): Promise<CapturedPhoto> {
    const res = await launchCamera(cameraOpts);
    if (res.didCancel) {
      throw new Error('Capture cancelled');
    }
    if (res.errorCode) {
      throw new Error(res.errorMessage || res.errorCode);
    }
    const asset = res.assets?.[0];
    if (!asset?.uri) {
      throw new Error('No captured photo found');
    }
    const fileB64 = await readAssetBase64(asset);
    const contentHash = sha256(fileB64);
    const evidenceHash = PhotoEvidenceService.hashEvidence({
      label,
      contentSha256Hex: contentHash,
      localUri: asset.uri,
      note,
    });
    await PhotoEvidenceService.storeEvidence(null, evidenceHash, label, asset.uri);
    return {
      uri: asset.uri,
      contentHash,
      evidenceHash,
      label,
    };
  }
}
