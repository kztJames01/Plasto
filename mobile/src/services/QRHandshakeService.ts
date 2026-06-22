import { Buffer } from 'buffer';

import { CustomerSignedResponse, DepositProposal, QRPacket, QRPacketKind } from '../types/events';

const PREFIX = 'PLASTO:QR:';
const VERSION = 1 as const;
const MAX_CHUNK = 700;

function encodePacket(packet: QRPacket): string {
  return `${PREFIX}${JSON.stringify(packet)}`;
}

function decodePacket(raw: string): QRPacket {
  if (!raw.startsWith(PREFIX)) {
    throw new Error('Not a Plasto QR packet');
  }
  const parsed = JSON.parse(raw.slice(PREFIX.length)) as QRPacket;
  if (parsed.v !== VERSION) {
    throw new Error('Unsupported QR packet version');
  }
  if (!parsed.kind || !parsed.eventId || !parsed.total || parsed.index == null || !parsed.data) {
    throw new Error('Invalid QR packet payload');
  }
  return parsed;
}

function packObject(kind: QRPacketKind, eventId: string, value: object): string[] {
  const json = JSON.stringify(value);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  const total = Math.ceil(b64.length / MAX_CHUNK) || 1;
  const chunks: string[] = [];
  for (let i = 0; i < total; i++) {
    const data = b64.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
    chunks.push(
      encodePacket({
        v: VERSION,
        kind,
        eventId,
        total,
        index: i,
        data,
      }),
    );
  }
  return chunks;
}

function unpackObject<T>(
  kind: QRPacketKind,
  rawPackets: string[],
): { complete: boolean; value: T | null; got: number; total: number } {
  const packets = rawPackets.map(decodePacket).filter(p => p.kind === kind);
  if (packets.length === 0) {
    return { complete: false, value: null, got: 0, total: 0 };
  }
  const first = packets[0];
  const total = first.total;
  const byIdx = new Map<number, string>();
  for (const p of packets) {
    if (p.eventId !== first.eventId || p.total !== total) {
      continue;
    }
    byIdx.set(p.index, p.data);
  }
  if (byIdx.size < total) {
    return { complete: false, value: null, got: byIdx.size, total };
  }
  let merged = '';
  for (let i = 0; i < total; i++) {
    const part = byIdx.get(i);
    if (!part) {
      return { complete: false, value: null, got: byIdx.size, total };
    }
    merged += part;
  }
  const json = Buffer.from(merged, 'base64').toString('utf8');
  return { complete: true, value: JSON.parse(json) as T, got: total, total };
}

export class QRHandshakeService {
  static proposalToPackets(proposal: DepositProposal): string[] {
    return packObject('proposal', proposal.eventId, proposal);
  }

  static responseToPackets(response: CustomerSignedResponse): string[] {
    return packObject('response', response.eventId, response);
  }

  static parseOne(raw: string): QRPacket {
    return decodePacket(raw);
  }

  static decodeProposal(rawPackets: string[]) {
    return unpackObject<DepositProposal>('proposal', rawPackets);
  }

  static decodeResponse(rawPackets: string[]) {
    return unpackObject<CustomerSignedResponse>('response', rawPackets);
  }
}
