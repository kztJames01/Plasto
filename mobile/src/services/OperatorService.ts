import { Buffer } from 'buffer';
import { EventStore } from './EventStore';
import { OperatorCertificate } from '../types/events';
import { CryptoService } from './CryptoService';
import { KeychainService } from './KeychainService';
import { API_BASE } from '../config/api';

export type CloudFloatStatus = {
  operatorPubkey: string;
  plantId: string;
  cap: number;
  consumed: number;
  remaining: number;
};

export class OperatorService {
  /**
   * Provisions a new operator identity locally and stores the public/secret
   * key in secure storage. The operator certificate itself is NOT issued
   * here — the operator must present their pubkey + plantId to a real
   * admin, who signs the canonical payload server-side. The previous
   * version of this method fabricated an admin signature by reusing the
   * operator's own signature bytes; that has been removed because it let
   * any phone self-issue a certificate to any plant.
   */
  static async provisionLocalOperator(
    _plantId: string,
  ): Promise<{ operatorPubkey: string }> {
    const kp = CryptoService.generateDeviceKeypair();

    await KeychainService.storeOperatorKeys({
      publicKey: Buffer.from(kp.publicKey).toString('base64'),
      secretKey: Buffer.from(kp.secretKey).toString('base64'),
    });

    const operatorPubkeyBase58 = CryptoService.encodePublicKeyBase58(
      kp.publicKey,
    );

    await EventStore.setAppRole('operator');
    // Deliberately do NOT write an operator_certificates row yet. That only
    // happens after {@link activateIssuedCertificate} is called with a
    // server-signed cert.
    return { operatorPubkey: operatorPubkeyBase58 };
  }

  /**
   * Persists a server-issued operator certificate locally and switches the
   * app into operator mode. The cert must already be signed by the admin
   * key and verified by the backend.
   */
  static async activateIssuedCertificate(
    cert: OperatorCertificate,
  ): Promise<void> {
    if (!cert.adminSig || cert.adminSig.trim().length === 0) {
      throw new Error('certificate has no admin signature');
    }
    if (cert.expiresAt && cert.expiresAt < Date.now()) {
      throw new Error('certificate is already expired');
    }
    await EventStore.storeOperatorCertificate(cert);
    await EventStore.setAppRole('operator');
  }

  static async getLocalCertificate(): Promise<OperatorCertificate | null> {
    const keys = await KeychainService.retrieveOperatorKeys();
    if (!keys) {
      return null;
    }

    const publicKey = Buffer.from(keys.publicKey, 'base64');
    const pubkeyBase58 = CryptoService.encodePublicKeyBase58(publicKey);

    return EventStore.getOperatorCertificate(pubkeyBase58);
  }

  static async getRemainingFloat(): Promise<number> {
    const cert = await this.getLocalCertificate();
    if (!cert) {
      return 0;
    }

    return EventStore.getRemainingFloat(cert.operatorPubkey);
  }

  static async fetchCloudFloat(): Promise<CloudFloatStatus | null> {
    const cert = await this.getLocalCertificate();
    if (!cert) {
      return null;
    }
    try {
      const response = await fetch(
        `${API_BASE}/operators/float?pubkey=${encodeURIComponent(cert.operatorPubkey)}`,
      );
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as CloudFloatStatus;
    } catch {
      return null;
    }
  }
  /**
   * Re-syncs an already-activated certificate to the cloud. The cert must
   * already have been issued and signed by the admin key — this method is
   * purely a re-upload for offline-first devices and never mints a fresh
   * signature.
   */
  static async syncCertificateToCloud(): Promise<void> {
    const cert = await this.getLocalCertificate();
    if (!cert) {
      throw new Error('No local certificate found');
    }

    try {
      const response = await fetch(`${API_BASE}/admin/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorPubkey: cert.operatorPubkey,
          plantId: cert.plantId,
          floatCap: cert.floatCap,
          adminPubkey: cert.adminPubkey,
          adminSig: cert.adminSig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }
    } catch {
      console.log('Certificate sync deferred (offline)');
    }
  }
}
