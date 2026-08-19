import { API_BASE } from '../config/api';
import { getDatabase } from '../database/Database';
import { PlasticClass } from '../types/events';

type PriceRow = {
  class: PlasticClass;
  ratePerKg: number;
  effectiveFrom: number;
  effectiveTo?: number | null;
};

export class PriceSyncService {
  static async syncLatest(): Promise<number> {
    const db = await getDatabase();
    let updated = 0;
    try {
      const res = await fetch(`${API_BASE}/prices`);
      if (!res.ok) {
        return 0;
      }
      const rows = (await res.json()) as PriceRow[];
      for (const row of rows) {
        db.execute(
          `INSERT OR REPLACE INTO price_schedule(class, rate_per_kg, effective_from, effective_to)
           VALUES (?, ?, ?, ?)`,
          [row.class, row.ratePerKg, row.effectiveFrom, row.effectiveTo ?? null],
        );
        updated += 1;
      }
    } catch {
      return 0;
    }
    return updated;
  }
}
