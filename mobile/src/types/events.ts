export interface EventPayload {
  eventId: string;
  eventType: 'DEPOSIT' | 'REDEEM' | 'ADJUST';
  payload: {
    weightKg?: number;
    plasticClass?: 'A' | 'B' | 'C';
    credits: number;
    plantId?: string;
    material?: string;
    aiSuggestion?: string;
    aiConfidence?: number;
    notes?: string;
  };
  customerPubkey: string | null;
  operatorPubkey: string;
  customerSig: string | null;
  operatorSig: string;
  photoHashes: string[];
  previousHash: string | null;
  eventHash: string;
  createdAtLocal: number;
  synced: boolean;
}

export type EventAppendInput = Omit<
  EventPayload,
  'eventHash' | 'previousHash' | 'synced'
> & {
  synced?: boolean;
};

export interface OperatorCertificate {
  certificateId: string;
  operatorPubkey: string;
  plantId: string;
  floatCap: number;
  adminPubkey: string;
  adminSig: string;
  issuedAt: number;
  expiresAt: number | null;
  isActive: boolean;
}

export type PlasticClass = 'A' | 'B' | 'C';

export interface DepositProposal {
  eventId: string;
  eventType: 'DEPOSIT';
  plantId: string;
  customerPubkey: string;
  operatorPubkey: string;
  weightKg: number;
  plasticClass: PlasticClass;
  material: string;
  credits: number;
  payloadJson: string;
  photoHashes: string[];
  photoHashesJson: string;
  previousHash: string | null;
  eventHash: string;
  aiSuggestion?: string;
  aiConfidence?: number;
  createdAtLocal: number;
  operatorSig: string;
}

export interface CustomerSignedResponse {
  eventId: string;
  customerPubkey: string;
  customerSig: string;
  acceptedAtLocal: number;
}

export interface RedeemIntent {
  type: 'PLASTO_REDEEM_INTENT';
  eventId: string;
  customerPubkey: string;
  credits: number;
  createdAtLocal: number;
  customerIntentSig: string;
}

export interface RedeemProposal {
  eventId: string;
  eventType: 'REDEEM';
  plantId: string;
  customerPubkey: string;
  operatorPubkey: string;
  credits: number;
  notes?: string;
  payloadJson: string;
  photoHashes: string[];
  photoHashesJson: string;
  previousHash: string | null;
  eventHash: string;
  createdAtLocal: number;
  operatorSig: string;
}

export type QRPacketKind = 'proposal' | 'response' | 'redeem_intent';

export interface QRPacket {
  v: 1;
  kind: QRPacketKind;
  eventId: string;
  total: number;
  index: number;
  data: string;
}
