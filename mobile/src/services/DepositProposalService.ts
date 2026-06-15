import { v4 as uuidv4 } from 'uuid';

import {
  CustomerSignedResponse,
  DepositProposal,
  EventPayload,
  PlasticClass,
} from '../types/events';
import { Identity } from '../types/identity';
import { CryptoService } from './CryptoService';
import { EventSigningService } from './EventSigningService';
import { EventStore } from './EventStore';
import { HashChainService } from './HashChainService';
import { KeychainService } from './KeychainService';
import { OperatorService } from './OperatorService';
import { PhotoEvidenceService } from './PhotoEvidenceService';
import { PriceService } from './PriceService';

type CreateDepositInput = {
  customerPubkey: string;
  weightKg: number;
  plasticClass: PlasticClass;
  material: string;
  photoHashes: string[];
  aiSuggestion?: string;
  aiConfidence?: number;
};

function sortedPayloadJson(payload: EventPayload['payload']): string {
  return JSON.stringify(payload);
}

export class DepositProposalService {
  static async createProposal(input: CreateDepositInput): Promise<DepositProposal> {
    if (input.weightKg <= 0) {
      throw new Error('Weight must be greater than zero');
    }
    if (input.photoHashes.filter(Boolean).length < 3) {
      throw new Error('Deposit requires at least three evidence hashes');
    }

    const operatorKeys = await KeychainService.retrieveOperatorKeys();
    const cert = await OperatorService.getLocalCertificate();
    if (!operatorKeys || !cert) {
      throw new Error('Operator certificate is required');
    }

    const credits = await PriceService.computeCredits(
      input.weightKg,
      input.plasticClass,
    );
    const remaining = await EventStore.getRemainingFloat(cert.operatorPubkey);
    if (credits > remaining) {
      throw new Error(`Deposit exceeds remaining float (${remaining})`);
    }

    const eventId = uuidv4();
    const createdAtLocal = Date.now();
    const previousHash = await EventStore.getLatestEventHashForOperator(
      cert.operatorPubkey,
    );
    const cleanPhotoHashes = input.photoHashes.map(h => h.trim()).filter(Boolean);
    const photoHashesJson = JSON.stringify(cleanPhotoHashes);
    const payload = {
      weightKg: input.weightKg,
      plasticClass: input.plasticClass,
      credits,
      plantId: cert.plantId,
      material: input.material.trim() || 'plastic',
      aiSuggestion: input.aiSuggestion,
      aiConfidence: input.aiConfidence,
    };
    const payloadJson = sortedPayloadJson(payload);
    const eventHash = HashChainService.computeHash(
      eventId,
      'DEPOSIT',
      payloadJson,
      previousHash,
      createdAtLocal,
    );
    const signingPayload = EventSigningService.signingPayload({
      eventId,
      eventType: 'DEPOSIT',
      payloadJson,
      customerPubkey: input.customerPubkey.trim(),
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

    const proposal: DepositProposal = {
      eventId,
      eventType: 'DEPOSIT',
      plantId: cert.plantId,
      customerPubkey: input.customerPubkey.trim(),
      operatorPubkey: cert.operatorPubkey,
      weightKg: input.weightKg,
      plasticClass: input.plasticClass,
      material: payload.material ?? 'plastic',
      credits,
      payloadJson,
      photoHashes: cleanPhotoHashes,
      photoHashesJson,
      previousHash,
      eventHash,
      aiSuggestion: input.aiSuggestion,
      aiConfidence: input.aiConfidence,
      createdAtLocal,
      operatorSig,
    };

    for (const hash of cleanPhotoHashes) {
      await PhotoEvidenceService.storeEvidence(eventId, hash, 'deposit-photo');
    }

    return proposal;
  }

  static signingPayloadForProposal(proposal: DepositProposal): string {
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
    proposal: DepositProposal,
    identity: Identity,
  ): CustomerSignedResponse {
    const customerPubkey = CryptoService.encodePublicKeyBase58(identity.publicKey);
    if (customerPubkey !== proposal.customerPubkey) {
      throw new Error('Proposal is for a different customer wallet');
    }
    if (
      !EventSigningService.verify(
        this.signingPayloadForProposal(proposal),
        proposal.operatorSig,
        proposal.operatorPubkey,
      )
    ) {
      throw new Error('Operator signature is invalid');
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

  static async finalizeSignedDeposit(
    proposal: DepositProposal,
    response: CustomerSignedResponse,
  ): Promise<void> {
    if (proposal.eventId !== response.eventId) {
      throw new Error('Customer response does not match proposal event');
    }
    if (proposal.customerPubkey !== response.customerPubkey) {
      throw new Error('Customer response uses a different wallet');
    }

    const payload = JSON.parse(proposal.payloadJson) as EventPayload['payload'];
    const signingPayload = this.signingPayloadForProposal(proposal);
    if (
      !EventSigningService.verify(
        signingPayload,
        proposal.operatorSig,
        proposal.operatorPubkey,
      )
    ) {
      throw new Error('Operator signature is invalid');
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

    await EventStore.appendPrepared(
      {
        eventId: proposal.eventId,
        eventType: 'DEPOSIT',
        payload,
        customerPubkey: proposal.customerPubkey,
        operatorPubkey: proposal.operatorPubkey,
        customerSig: response.customerSig,
        operatorSig: proposal.operatorSig,
        photoHashes: proposal.photoHashes,
        previousHash: proposal.previousHash,
        eventHash: proposal.eventHash,
        createdAtLocal: proposal.createdAtLocal,
        synced: false,
      },
      proposal.payloadJson,
    );
    await PhotoEvidenceService.attachToEvent(
      proposal.eventId,
      proposal.photoHashes,
    );
  }
}
