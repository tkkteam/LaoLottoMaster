export type DigitScore = {
  digit: number;
  score: number;
};

type Weights = {
  freq: number;
  recency: number;
  markov: number;
};

type PairScore = {
  pair: string;
  score: number;
};

type Options = {
  windowSize?: number;           // จำนวนงวดย้อนหลัง (single window mode)
  trainRatio?: number;           // สัดส่วน train/test สำหรับ backtest
  gridStep?: number;             // ความละเอียดในการไล่ weight (0.1 = 10%)
  ensembleWindows?: number[];    // เปิด ensemble mode ด้วยหลาย windows เช่น [50, 100, 200]
  pairTopN?: number;             // จำนวน top digits สำหรับสร้างคู่ (default 5)
  pairLimit?: number;            // จำนวนคู่สูงสุดที่ return (default 20)
};

function splitDigits(n: number): number[] {
  return n.toString().padStart(2, "0").split("").map(Number);
}

function buildFeatures(data: number[]) {
  const freq: Record<number, number> = {};
  const lastSeen: Record<number, number> = {};
  const transition: Record<string, number> = {}; // "a->b"

  data.forEach((num, idx) => {
    const digits = splitDigits(num);

    digits.forEach(d => {
      freq[d] = (freq[d] || 0) + 1;
      lastSeen[d] = idx;
    });

    // markov pair (หลักสิบ -> หลักหน่วย)
    if (digits.length === 2) {
      const key = `${digits[0]}->${digits[1]}`;
      transition[key] = (transition[key] || 0) + 1;
    }
  });

  return { freq, lastSeen, transition };
}

function scoreDigits(
  data: number[],
  weights: Weights
): DigitScore[] {
  const { freq, lastSeen, transition } = buildFeatures(data);

  const maxFreq = Math.max(...Object.values(freq), 1);
  const maxGap = data.length || 1;

  const results: DigitScore[] = [];

  for (let d = 0; d <= 9; d++) {
    const f = freq[d] || 0;
    const gap = data.length - (lastSeen[d] ?? -1);

    const normFreq = f / maxFreq;
    const normGap = gap / maxGap;

    // markov score (รวมทุก transition ที่เกี่ยวกับ digit นี้)
    let markovScore = 0;
    Object.entries(transition).forEach(([k, v]) => {
      if (k.startsWith(`${d}->`) || k.endsWith(`->${d}`)) {
        markovScore += v;
      }
    });

    const normMarkov = markovScore / (data.length || 1);

    const score =
      weights.freq * normFreq +
      weights.recency * normGap +
      weights.markov * normMarkov;

    results.push({ digit: d, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

// วัดความแม่น: ถ้า digit จริงอยู่ใน top N ถือว่าถูก
function evaluate(
  train: number[],
  test: number[],
  weights: Weights,
  topN = 3
): number {
  let hit = 0;

  test.forEach(num => {
    const ranked = scoreDigits(train, weights);
    const top = ranked.slice(0, topN).map(r => r.digit);

    const digits = splitDigits(num);
    if (digits.some(d => top.includes(d))) {
      hit++;
    }

    train.push(num); // rolling update
  });

  return hit / test.length;
}

function gridSearch(
  data: number[],
  trainRatio: number,
  step: number
): Weights {
  const splitIndex = Math.floor(data.length * trainRatio);
  const trainBase = data.slice(0, splitIndex);
  const test = data.slice(splitIndex);

  let bestScore = -1;
  let bestWeights: Weights = { freq: 0.33, recency: 0.33, markov: 0.34 };

  for (let f = 0; f <= 1; f += step) {
    for (let r = 0; r <= 1 - f; r += step) {
      const m = 1 - f - r;
      if (m < 0) continue;

      const weights = { freq: f, recency: r, markov: m };
      const score = evaluate([...trainBase], test, weights);

      if (score > bestScore) {
        bestScore = score;
        bestWeights = weights;
      }
    }
  }

  return bestWeights;
}

function ensemble(
  data: number[],
  windows: number[],
  trainRatio: number,
  gridStep: number
): {
  digits: DigitScore[];
  bestWindow: number;
  bestWeights: Weights;
} {
  const combined: Record<number, number> = {};
  let bestWindow = windows[0];
  let bestScore = -1;
  let bestWeights: Weights = { freq: 0.3, recency: 0.3, markov: 0.4 };

  windows.forEach(w => {
    const slice = data.slice(-w);
    const weights = gridSearch(slice, trainRatio, gridStep);
    const ranked = scoreDigits(slice, weights);

    // adaptive pick
    if (ranked[0].score > bestScore) {
      bestScore = ranked[0].score;
      bestWindow = w;
      bestWeights = weights;
    }

    // ensemble combine
    ranked.forEach(r => {
      combined[r.digit] = (combined[r.digit] || 0) + r.score;
    });
  });

  const digits = Object.entries(combined)
    .map(([d, s]) => ({ digit: Number(d), score: s }))
    .sort((a, b) => b.score - a.score);

  return { digits, bestWindow, bestWeights };
}

function generatePairs(
  digits: DigitScore[],
  topN: number,
  limit: number
): PairScore[] {
  const top = digits.slice(0, topN).map(d => d.digit);
  const pairs: PairScore[] = [];

  top.forEach(a => {
    top.forEach(b => {
      const score =
        (digits.find(x => x.digit === a)?.score ?? 0) +
        (digits.find(x => x.digit === b)?.score ?? 0);

      pairs.push({
        pair: `${a}${b}`,
        score
      });
    });
  });

  return pairs
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function quantumMax(
  rawNumbers: number[],
  options: Options = {}
) {
  const {
    windowSize = 200,
    trainRatio = 0.7,
    gridStep = 0.2,
    ensembleWindows,
    pairTopN = 5,
    pairLimit = 20,
  } = options;

  let ranking: DigitScore[];
  let bestWeights: Weights;
  let bestWindow: number | undefined;
  let pairs: PairScore[] | undefined;

  if (ensembleWindows && ensembleWindows.length > 0) {
    // ensemble mode: ใช้หลาย windows รวมกัน
    const result = ensemble(rawNumbers, ensembleWindows, trainRatio, gridStep);
    ranking = result.digits;
    bestWeights = result.bestWeights;
    bestWindow = result.bestWindow;
  } else {
    // single window mode (เดิม)
    const data = rawNumbers.slice(-windowSize);
    bestWeights = gridSearch(data, trainRatio, gridStep);
    ranking = scoreDigits(data, bestWeights);
  }

  // generate pairs ถ้าอยู่ใน ensemble mode หรือมีการระบุ pairTopN
  if (ranking.length > 0) {
    pairs = generatePairs(ranking, pairTopN, pairLimit);
  }

  return {
    weights: bestWeights,
    ranking,
    pairs,
    bestWindow,
  };
}

import { Pattern, LottoResult } from '../../types';

export const quantumMaxPattern: Pattern = {
  name: "Quantum Max (สูตรสูงสุด)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 10) {
      return (p + l) % 100;
    }

    const rawNumbers = results.slice(0, 100).map(r => parseInt(r.r2, 10));

    // ใช้ single window mode เพื่อความเร็ว (เรียกหลายรอบผ่าน backtest)
    const { ranking, pairs } = quantumMax(rawNumbers, {
      windowSize: Math.min(100, rawNumbers.length),
      trainRatio: 0.7,
      gridStep: 0.5,
      pairTopN: 5,
      pairLimit: 20,
    });

    if (pairs && pairs.length > 0) {
      return parseInt(pairs[0].pair, 10);
    }

    const topDigits = ranking.slice(0, 5).map(r => r.digit);

    let bestTens = topDigits[0] ?? 0;
    let bestUnits = topDigits[1] ?? 0;

    const markovCandidates: Array<{ tens: number; units: number; score: number }> = [];

    for (const t of topDigits.slice(0, 3)) {
      for (const u of topDigits.slice(0, 3)) {
        if (t === u) continue;
        const markovScore = (ranking[t]?.score ?? 0) + (ranking[u]?.score ?? 0);
        markovCandidates.push({ tens: t, units: u, score: markovScore });
      }
    }

    markovCandidates.sort((a, b) => b.score - a.score);

    if (markovCandidates.length > 0) {
      bestTens = markovCandidates[0].tens;
      bestUnits = markovCandidates[0].units;
    }

    return (bestTens * 10) + bestUnits;
  }
};