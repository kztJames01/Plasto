import { getDatabase } from '../database/Database';

type BalanceSnapshot = {
  balance: number;
  updatedAt: number | null;
};

export class BalanceService {
  private static balanceKey(pubkey: string): string {
    return `balance_${pubkey}`;
  }

  private static updatedKey(pubkey: string): string {
    return `balance_updated_${pubkey}`;
  }

  static async recalculate(pubkey: string): Promise<number> {
    const db = await getDatabase();
    const rows = db.execute(
      `SELECT event_type, payload_json
       FROM events
       WHERE customer_pubkey = ?
       ORDER BY created_at_local ASC`,
      [pubkey],
    ).rows?._array;

    let balance = 0;
    // Keep this loop explicit so audit logic stays easy to follow.
    for (const row of rows ?? []) {
      let credits = 0;
      try {
        const payload = JSON.parse(String(row.payload_json)) as { credits?: number };
        credits = Number(payload.credits ?? 0);
      } catch {
        credits = 0;
      }

      if (row.event_type === 'DEPOSIT') {
        balance += credits;
      } else if (row.event_type === 'REDEEM') {
        balance -= credits;
      }
    }

    const now = Date.now();
    db.execute(
      `INSERT OR REPLACE INTO user_metadata (key, value) VALUES (?, ?)`,
      [this.balanceKey(pubkey), String(balance)],
    );
    db.execute(
      `INSERT OR REPLACE INTO user_metadata (key, value) VALUES (?, ?)`,
      [this.updatedKey(pubkey), String(now)],
    );

    return balance;
  }

  static async getSnapshot(pubkey: string): Promise<BalanceSnapshot> {
    const db = await getDatabase();
    const balanceRow = db.execute(
      `SELECT value FROM user_metadata WHERE key = ? LIMIT 1`,
      [this.balanceKey(pubkey)],
    ).rows?._array?.[0];
    const updatedRow = db.execute(
      `SELECT value FROM user_metadata WHERE key = ? LIMIT 1`,
      [this.updatedKey(pubkey)],
    ).rows?._array?.[0];

    return {
      balance: Number(balanceRow?.value ?? 0),
      updatedAt: updatedRow?.value ? Number(updatedRow.value) : null,
    };
  }
}
