export interface EventPayload {
  eventId: string;
  eventType: 'DEPOSIT' | 'REDEEM' | 'ADJUST';
  payload: {
    weightKg?: number;
    plasticClass?: 'A' | 'B' | 'C';
    credits: number;
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
