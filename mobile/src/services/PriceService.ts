import { getDatabase } from '../database/Database';
import { PlasticClass } from '../types/events';

const DEFAULT_RATES: Record<PlasticClass, number> = {
  A: 500,
  B: 250,
  C: 100,
};

export class PriceService {
  static async getRate(plasticClass: PlasticClass): Promise<number> {
    const db = await getDatabase();
    const row = db.execute(
      `SELECT rate_per_kg
       FROM price_schedule
       WHERE class = ?
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to > ?)
       LIMIT 1`,
      [plasticClass, Date.now(), Date.now()],
    ).rows?._array?.[0];

    return Number(row?.rate_per_kg ?? DEFAULT_RATES[plasticClass]);
  }

  static async computeCredits(
    weightKg: number,
    plasticClass: PlasticClass,
  ): Promise<number> {
    const rate = await this.getRate(plasticClass);
    return Math.max(0, Math.round(weightKg * rate));
  }

  static classDescription(plasticClass: PlasticClass): string {
    switch (plasticClass) {
      case 'A':
        return 'Clean mono-stream bottles and rigid containers';
      case 'B':
        return 'Mixed or lightly contaminated plastics';
      case 'C':
        return 'Dirty, composite, bulky, or low-value plastics';
    }
  }
}
