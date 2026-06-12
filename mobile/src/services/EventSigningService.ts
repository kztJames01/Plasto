import { Buffer } from 'buffer';

import { CryptoService } from './CryptoService';

type SigningPayloadInput = {
  eventId: string;
  eventType: string;
  payloadJson: string;
  customerPubkey: string | null;
  operatorPubkey: string;
  photoHashesJson: string | null;
  previousHash: string | null;
  eventHash: string;
  createdAtLocal: number;
};

export class EventSigningService {
  static signingPayload(event: SigningPayloadInput): string {
    return [
      event.eventId,
      event.eventType,
      event.payloadJson,
      event.customerPubkey ?? '',
      event.operatorPubkey,
      event.photoHashesJson ?? '',
      event.previousHash ?? '',
      event.eventHash,
      String(event.createdAtLocal),
    ].join('|');
  }

  static sign(payload: string, secretKeyBase64: string): string {
    const sig = CryptoService.sign(
      Buffer.from(payload, 'utf8'),
      Buffer.from(secretKeyBase64, 'base64'),
    );
    return Buffer.from(sig).toString('base64');
  }

  static signWithSecretKey(payload: string, secretKey: Uint8Array): string {
    const sig = CryptoService.sign(Buffer.from(payload, 'utf8'), secretKey);
    return Buffer.from(sig).toString('base64');
  }

  static verify(
    payload: string,
    signatureBase64: string,
    publicKeyBase58: string,
  ): boolean {
    return CryptoService.verify(
      Buffer.from(payload, 'utf8'),
      Buffer.from(signatureBase64, 'base64'),
      CryptoService.decodePublicKeyBase58(publicKeyBase58),
    );
  }
}
