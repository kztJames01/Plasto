import { v4 as uuidv4 } from 'uuid';

import {
  CustomerSignedResponse,
  EventPayload,
  RedeemIntent,
  RedeemProposal,
} from '../types/events';
import { Identity } from '../types/identity';
import { BalanceService } from './BalanceService';
import { CryptoService } from './CryptoService';
import { EventSigningService } from './EventSigningService';
import { EventStore } from './EventStore';
import { HashChainService } from './HashChainService';
import { KeychainService } from './KeychainService';
import { OperatorService } from './OperatorService';
import { QRHandshakeService } from './QRHandshakeService';

function intentMessage(intent: {
  eventId: string;
  credits: number;
  customerPubkey: string;
  createdAtLocal: number;
}): string {
  return `PLASTO_REDEEM_INTENT|${intent.eventId}|${intent.credits}|${intent.customerPubkey}|${intent.createdAtLocal}`;
}

export class RedeemProposalService {
  static async createIntent(
    identity: Identity,
    credits: number,
  ): Promise<RedeemIntent> {
    const amt = Math.floor(Number(credits));
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Enter a credit amount greater than zero');
    }
    const customerPubkey = CryptoService.encodePublicKeyBase58(identity.publicKey);
    const snap = await BalanceService.getSnapshot(customerPubkey);
    let balance = snap.balance;
    if (snap.updatedAt == null) {
      balance = await BalanceService.recalculate(customerPubkey);
    }
    if (amt > balance) {
      throw new Error(`Not enough credits (have ${balance})`);
    }

    const eventId = uuidv4();
    const createdAtLocal = Date.now();
    const customerIntentSig = EventSigningService.signWithSecretKey(
      intentMessage({ eventId, credits: amt, customerPubkey, createdAtLocal }),
      identity.secretKey,
    );

    return {
      type: 'PLASTO_REDEEM_INTENT',
      eventId,
      customerPubkey,
      credits: amt,
      createdAtLocal,
      customerIntentSig,
    };
  }

  static verifyIntent(intent: RedeemIntent): void {
    if (intent.type !== 'PLASTO_REDEEM_INTENT') {
      throw new Error('Not a redeem QR');
    }
    if (!intent.credits || intent.credits <= 0) {
      throw new Error('Redeem amount is missing');
    }
    const ok = EventSigningService.verify(
      intentMessage(intent),
      intent.customerIntentSig,
      intent.customerPubkey,
    );
    if (!ok) {
      throw new Error('Customer redeem signature is invalid');
    }
  }

  static async createProposalFromIntent(
    intent: RedeemIntent,
    notes?: string,
  ): Promise<RedeemProposal> {
    this.verifyIntent(intent);
    const operatorKeys = await KeychainService.retrieveOperatorKeys();
    const cert = await OperatorService.getLocalCertificate();
    if (!operatorKeys || !cert) {
      throw new Error('Operator certificate is required');
    }

    const createdAtLocal = Date.now();
    const previousHash = await EventStore.getLatestEventHashForOperator(
      cert.operatorPubkey,
    );
    const photoHashes: string[] = [];
    const photoHashesJson = '[]';
    const payload = {
      credits: intent.credits,
      plantId: cert.plantId,
      notes: notes?.trim() || 'redeem',
    };
    const payloadJson = JSON.stringify(payload);
    const eventHash = HashChainService.computeHash(
      intent.eventId,
      'REDEEM',
      payloadJson,
      previousHash,
      createdAtLocal,
    );
    const signingPayload = EventSigningService.signingPayload({
      eventId: intent.eventId,
      eventType: 'REDEEM',
      payloadJson,
      customerPubkey: intent.customerPubkey,
      operatorPubkey: cert.operatorPubkey,
      photoHashesJson,
      previousHash,
      eventHash,
      createdAtLocal,
    });
    const operatorSig = EventSigningService.sign(
      signingPayload,
      operatorKeys.secretKey,
    );

    const proposal: RedeemProposal = {
      eventId: intent.eventId,
      eventType: 'REDEEM',
      plantId: cert.plantId,
      customerPubkey: intent.customerPubkey,
      operatorPubkey: cert.operatorPubkey,
      credits: intent.credits,
      notes: payload.notes,
      payloadJson,
      photoHashes,
      photoHashesJson,
      previousHash,
      eventHash,
      createdAtLocal,
      operatorSig,
    };
    await EventStore.savePendingProposal(intent.eventId, JSON.stringify(proposal));
    return proposal;
  }

  static signingPayloadForProposal(proposal: RedeemProposal): string {
    return EventSigningService.signingPayload({
      eventId: proposal.eventId,
      eventType: proposal.eventType,
      payloadJson: proposal.payloadJson,
      customerPubkey: proposal.customerPubkey,
      operatorPubkey: proposal.operatorPubkey,
      photoHashesJson: proposal.photoHashesJson,
      previousHash: proposal.previousHash,
      eventHash: proposal.eventHash,
      createdAtLocal: proposal.createdAtLocal,
    });
  }

  static signProposal(
    proposal: RedeemProposal,
    identity: Identity,
  ): CustomerSignedResponse {
    const customerPubkey = CryptoService.encodePublicKeyBase58(identity.publicKey);
    if (customerPubkey !== proposal.customerPubkey) {
      throw new Error('This redeem is for a different wallet');
    }
    if (proposal.eventType !== 'REDEEM') {
      throw new Error('Not a redeem proposal');
    }
    if (
      !EventSigningService.verify(
        this.signingPayloadForProposal(proposal),
        proposal.operatorSig,
        proposal.operatorPubkey,
      )
    ) {
      throw new Error('Shop signature is invalid');
    }

    return {
      eventId: proposal.eventId,
      customerPubkey,
      customerSig: EventSigningService.signWithSecretKey(
        this.signingPayloadForProposal(proposal),
        identity.secretKey,
      ),
      acceptedAtLocal: Date.now(),
    };
  }

  static async finalizeSignedRedeem(
    proposal: RedeemProposal,
    response: CustomerSignedResponse,
  ): Promise<void> {
    await this.assertDualSigs(proposal, response);
    const payload = JSON.parse(proposal.payloadJson) as EventPayload['payload'];
    await EventStore.appendPrepared(
      {
        eventId: proposal.eventId,
        eventType: 'REDEEM',
        payload,
        customerPubkey: proposal.customerPubkey,
        operatorPubkey: proposal.operatorPubkey,
        customerSig: response.customerSig,
        operatorSig: proposal.operatorSig,
        photoHashes: proposal.photoHashes ?? [],
        previousHash: proposal.previousHash,
        eventHash: proposal.eventHash,
        createdAtLocal: proposal.createdAtLocal,
        synced: false,
      },
      proposal.payloadJson,
    );
    await EventStore.removePendingProposal(proposal.eventId);
  }

  static async appendCustomerCopy(
    proposal: RedeemProposal,
    response: CustomerSignedResponse,
  ): Promise<void> {
    await this.assertDualSigs(proposal, response);
    const payload = JSON.parse(proposal.payloadJson) as EventPayload['payload'];
    await EventStore.appendPrepared(
      {
        eventId: proposal.eventId,
        eventType: 'REDEEM',
        payload,
        customerPubkey: proposal.customerPubkey,
        operatorPubkey: proposal.operatorPubkey,
        customerSig: response.customerSig,
        operatorSig: proposal.operatorSig,
        photoHashes: proposal.photoHashes ?? [],
        previousHash: proposal.previousHash,
        eventHash: proposal.eventHash,
        createdAtLocal: proposal.createdAtLocal,
        synced: false,
      },
      proposal.payloadJson,
    );
  }

  private static async assertDualSigs(
    proposal: RedeemProposal,
    response: CustomerSignedResponse,
  ): Promise<void> {
    if (proposal.eventId !== response.eventId) {
      throw new Error('Customer response does not match redeem');
    }
    if (proposal.customerPubkey !== response.customerPubkey) {
      throw new Error('Customer wallet mismatch');
    }
    const signingPayload = this.signingPayloadForProposal(proposal);
    if (
      !EventSigningService.verify(
        signingPayload,
        proposal.operatorSig,
        proposal.operatorPubkey,
      )
    ) {
      throw new Error('Shop signature is invalid');
    }
    if (
      !EventSigningService.verify(
        signingPayload,
        response.customerSig,
        response.customerPubkey,
      )
    ) {
      throw new Error('Customer signature is invalid');
    }
  }

  static encodeIntent(intent: RedeemIntent): string[] {
    return QRHandshakeService.redeemIntentToPackets(intent);
  }

  static decodeIntent(frames: string[]) {
    return QRHandshakeService.decodeRedeemIntent(frames);
  }

  static encodeProposal(proposal: RedeemProposal): string[] {
    return QRHandshakeService.redeemProposalToPackets(proposal);
  }

  static decodeProposal(frames: string[]) {
    return QRHandshakeService.decodeRedeemProposal(frames);
  }

  static encodeResponse(response: CustomerSignedResponse): string[] {
    return QRHandshakeService.responseToPackets(response);
  }

  static decodeResponse(frames: string[]) {
    return QRHandshakeService.decodeResponse(frames);
  }
}
