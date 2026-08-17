import React, { useMemo, useState } from 'react';
import { keysFromMnemonic, signUtf8 } from './crypto.js';
import { loadCache, parseEvent, photoUrl, pullEvents, recoverHint, saveCache, sumBalance } from './api.js';

export default function App() {
  const cached = useMemo(() => loadCache(), []);
  const [phrase, setPhrase] = useState('');
  const [pubkey, setPubkey] = useState(cached?.pubkey || '');
  const [events, setEvents] = useState((cached?.events || []).map(parseEvent));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [openId, setOpenId] = useState(null);

  const balance = sumBalance(events);
  const last = events[0];

  const lookup = async () => {
    setError('');
    setBusy(true);
    let secret = null;
    try {
      const keys = keysFromMnemonic(phrase);
      secret = keys.secretKey;
      const proof = signUtf8(`PLASTO_PULL|${keys.pubkey}|0|00000000-0000-0000-0000-000000000000`, keys.secretKey);
      const rec = await recoverHint(keys.pubkey).catch(() => ({ event_count: 0 }));
      const rows = await pullEvents(keys.pubkey, proof);
      const parsed = rows.map(parseEvent).sort((a, b) => b.createdAtLocal - a.createdAtLocal);
      setPubkey(keys.pubkey);
      setEvents(parsed);
      saveCache(keys.pubkey, rows);
      setHint(rec.event_count != null ? `${rec.event_count} cloud events` : '');
      setPhrase('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      secret = null;
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <h1>Plasto wallet</h1>
      <p className="sub">Read-only. Phrase is never stored.</p>
      <div className="warn">
        This page cannot sign deposits or redeems. Use the phone app to transact.
      </div>

      <textarea
        placeholder="12 word recovery phrase"
        value={phrase}
        onChange={e => setPhrase(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
      />
      <button disabled={busy} onClick={() => void lookup()}>
        {busy ? 'Loading…' : 'View balance'}
      </button>
      {error ? <div className="err">{error}</div> : null}

      {pubkey ? (
        <>
          <div className="bal" style={{ marginTop: 18 }}>
            <span>Balance</span>
            <b>{balance}</b>
            <span>credits</span>
          </div>
          {last?.plantId ? <p>Plant {last.plantId}</p> : null}
          {last ? (
            <p className="meta">Last tx {new Date(last.createdAtLocal).toLocaleString()}</p>
          ) : (
            <p className="meta">No transactions yet</p>
          )}
          <p className="pub">{pubkey}</p>
          {hint ? <p className="meta">{hint}</p> : null}

          {events.map(ev => {
            const redeem = ev.eventType === 'REDEEM';
            const open = openId === ev.eventId;
            return (
              <div className="card" key={ev.eventId} onClick={() => setOpenId(open ? null : ev.eventId)}>
                <div className="row">
                  <span className={redeem ? 'red' : 'dep'}>{ev.eventType}</span>
                  <span className={redeem ? 'red' : 'dep'}>
                    {redeem ? '-' : '+'}
                    {ev.credits}
                  </span>
                </div>
                <div className="meta">{new Date(ev.createdAtLocal).toLocaleString()}</div>
                {open ? (
                  <>
                    {ev.plantId ? <div className="meta">Plant {ev.plantId}</div> : null}
                    {ev.payload.weightKg != null ? (
                      <div className="meta">{ev.payload.weightKg} kg · {ev.payload.plasticClass}</div>
                    ) : null}
                    <div className="meta">{ev.eventHash}</div>
                    <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                      {(ev.photos || []).map(h => (
                        <img
                          key={h}
                          src={photoUrl(h)}
                          alt=""
                          width="80"
                          height="80"
                          style={{ borderRadius: 8, objectFit: 'cover', background: '#ddd' }}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
