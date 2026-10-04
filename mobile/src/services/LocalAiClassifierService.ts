import { PlasticClass } from '../types/events';

type SuggestInput = {
  material: string;
  weightKg: number;
  photoHashes: string[];
};

type SuggestResult = {
  suggestedClass: PlasticClass;
  confidence: number;
  reason: string;
};

function scoreMaterialWord(material: string, words: string[]): number {
  const m = material.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (m.includes(w)) {
      score += 1;
    }
  }
  return score;
}

export class LocalAiClassifierService {
  static suggest(input: SuggestInput): SuggestResult {
    const material = input.material.trim().toLowerCase();
    const hashSeed = input.photoHashes.join('');
    const pseudo = hashSeed
      .slice(0, 20)
      .split('')
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    let a = scoreMaterialWord(material, ['pet', 'bottle', 'clear', 'clean']);
    let b = scoreMaterialWord(material, ['mixed', 'hdpe', 'container', 'cap']);
    let c = scoreMaterialWord(material, ['dirty', 'foam', 'film', 'sachet', 'wet']);

    if (input.weightKg > 12) {
      b += 1;
    }
    if (input.weightKg < 1) {
      a += 1;
    }
    if (pseudo % 3 === 0) {
      a += 1;
    } else if (pseudo % 3 === 1) {
      b += 1;
    } else {
      c += 1;
    }

    const scores = { A: a, B: b, C: c };
    let suggestedClass: PlasticClass = 'A';
    if (scores.B > scores.A && scores.B >= scores.C) {
      suggestedClass = 'B';
    } else if (scores.C > scores.A && scores.C >= scores.B) {
      suggestedClass = 'C';
    }
    const max = Math.max(scores.A, scores.B, scores.C);
    const total = Math.max(1, scores.A + scores.B + scores.C);
    const confidence = Math.min(99, Math.max(55, Math.round((max / total) * 100)));

    return {
      suggestedClass,
      confidence,
      reason: `material words + photo pattern score (${scores.A}/${scores.B}/${scores.C})`,
    };
  }
}
