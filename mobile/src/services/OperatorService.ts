import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { EventStore } from './EventStore';
import { OperatorCertificate } from '../types/events';
import { CryptoService } from './CryptoService';
import { KeychainService } from './KeychainService';

const API_BASE = 'http://localhost:8080/api/v1';

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export class OperatorService {
  static async registerOperator(
    plantId: string,
    floatCap: number,
    adminPubkey: string,
  ): Promise<OperatorCertificate> {
    const kp = CryptoService.generateDeviceKeypair();

    await KeychainService.storeOperatorKeys({
      publicKey: Buffer.from(kp.publicKey).toString('base64'),
      secretKey: Buffer.from(kp.secretKey).toString('base64'),
    });

    const operatorPubkeyBase58 = CryptoService.encodePublicKeyBase58(
      kp.publicKey,
    );

    const certPayload = `${operatorPubkeyBase58}:${floatCap}:${plantId}`;
    const opSig = CryptoService.sign(enc(certPayload), kp.secretKey);

    // demo path: admin sig same bytes as operator proof (real plant: admin master key signs)
    const adminSig = Buffer.from(opSig).toString('base64');

    const cert: OperatorCertificate = {
      certificateId: uuidv4(),
      operatorPubkey: operatorPubkeyBase58,
      plantId,
      floatCap,
      adminPubkey,
      adminSig,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      isActive: true,
    };

    await EventStore.storeOperatorCertificate(cert);
    await EventStore.setAppRole('operator');

    return cert;
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
