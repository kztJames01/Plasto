const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const ZERO = '00000000-0000-0000-0000-000000000000';

export async function pullEvents(pubkey, proofSig) {
  const url =
    `${API_BASE}/users/events?pubkey=${encodeURIComponent(pubkey)}&after=0&afterEventId=${ZERO}`;
  const res = await fetch(url, {
    headers: {
      'X-Plasto-Pubkey': pubkey,
      'X-Plasto-Proof': proofSig,
    },
  });
  if (!res.ok) {
    throw new Error(`Could not load history (${res.status})`);
  }
  return res.json();
}

export async function recoverHint(pubkey) {
  const res = await fetch(
    `${API_BASE}/users/recover?pubkey=${encodeURIComponent(pubkey)}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    return { event_count: 0, merkle_root: '' };
  }
  return res.json();
}

export function parseEvent(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payloadJson || '{}');
  } catch {
    payload = {};
  }
  let photos = [];
  try {
    photos = JSON.parse(row.photoHashes || '[]');
  } catch {
    photos = [];
  }
  return {
    eventId: row.eventId,
    eventType: row.eventType,
    payload,
    photos,
    createdAtLocal: row.createdAtLocal,
    eventHash: row.eventHash,
    plantId: payload.plantId || '',
    credits: Number(payload.credits || 0),
  };
}

export function sumBalance(events) {
  let n = 0;
  for (const e of events) {
    if (e.eventType === 'DEPOSIT' || e.eventType === 'ADJUST') {
      n += e.credits;
    } else if (e.eventType === 'REDEEM') {
      n -= e.credits;
    }
  }
  return n;
}

const DB = 'plasto-pwa';

export function saveCache(pubkey, events) {
  try {
    localStorage.setItem(
      'plasto_view',
      JSON.stringify({ pubkey, events, savedAt: Date.now() }),
    );
  } catch {
    // ignore quota
  }
}

export function loadCache() {
  try {
    const raw = localStorage.getItem('plasto_view');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function photoUrl(hash) {
  return `${API_BASE}/photos/${hash}`;
}

export { API_BASE, DB };
