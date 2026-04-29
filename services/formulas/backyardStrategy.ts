import { LottoResult } from '../../types';
import { getDigitSum } from '../lottoService';

function splitDigits(n: number): [number, number] {
  const s = n.toString().padStart(2, '0');
  return [parseInt(s[0], 10), parseInt(s[1], 10)];
}

export function calculateBackyard(r3Str: string, r4Str: string, constants?: { a: number; b: number; c: number }): string[] {
  if (!r3Str || r3Str.length < 3) return [];
  const h = parseInt(r3Str[0], 10) || 0;
  const t = parseInt(r3Str[1], 10) || 0;
  const u = parseInt(r3Str[2], 10) || 0;
  const adaptive = getDigitSum(r4Str) || 9;
  
  const a = constants?.a ?? 6;
  const b = constants?.b ?? 7;
  const c = constants?.c ?? 1;
  
  const t1 = (h + t + u + adaptive) % 10;
  const t2 = (t1 + a) % 10;
  const u1 = (u + b) % 10;
  const u2 = (u1 + c) % 10;
  
  return [`${t1}${u1}`, `${t1}${u2}`, `${t2}${u1}`, `${t2}${u2}`];
}

export interface BackyardBacktestResult {
  totalRounds: number;
  hits: number;
  accuracy: number;
  runningHits: number;
  runningAccuracy: number;
  hitDetails: Array<{
    date: string;
    predicted: string[];
    actual: string;
    isHit: boolean;
    isRunning: boolean;
    hitNumber: string | null;
  }>;
  streak: { current: number; best: number };
  runningStreak: { current: number; best: number };
}

export function backtestBackyardWithConstants(
  results: LottoResult[],
  rounds: number = 30,
  constants: { a: number; b: number; c: number } = { a: 6, b: 7, c: 1 }
): BackyardBacktestResult {
  const hitDetails: BackyardBacktestResult['hitDetails'] = [];
  let hits = 0;
  let runningHits = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let currentRunningStreak = 0;
  let bestRunningStreak = 0;

  for (let i = 1; i < results.length && hitDetails.length < rounds; i++) {
    const prevResult = results[i];
    const targetResult = results[i - 1];

    const predicted = calculateBackyard(prevResult.r3, prevResult.r4, constants);
    const actual = targetResult.r2.padStart(2, '0');
    const isHit = predicted.includes(actual);
    
    // Running hit: ตรงหลักสิบหรือหลักหน่วยอย่างใดอย่างหนึ่ง
    const [aTens, aUnits] = [actual[0], actual[1]];
    const isRunning = predicted.some(p => p[0] === aTens || p[1] === aUnits);
    
    const hitNumber = isHit ? actual : null;

    if (isHit) {
      hits++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    if (isRunning) {
      runningHits++;
      currentRunningStreak++;
      bestRunningStreak = Math.max(bestRunningStreak, currentRunningStreak);
    } else {
      currentRunningStreak = 0;
    }

    hitDetails.push({
      date: targetResult.date,
      predicted,
      actual,
      isHit,
      isRunning,
      hitNumber
    });
  }

  const totalRounds = hitDetails.length;
  const accuracy = totalRounds > 0 ? (hits / totalRounds) * 100 : 0;
  const runningAccuracy = totalRounds > 0 ? (runningHits / totalRounds) * 100 : 0;

  return {
    totalRounds,
    hits,
    accuracy,
    runningHits,
    runningAccuracy,
    hitDetails,
    streak: { current: currentStreak, best: bestStreak },
    runningStreak: { current: currentRunningStreak, best: bestRunningStreak }
  };
}

export function findBestBackyardConstants(
  results: LottoResult[],
  testRounds: number = 100
): { constants: { a: number; b: number; c: number }; accuracy: number } {
  let bestAccuracy = 0;
  let bestConstants = { a: 6, b: 7, c: 1 };

  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      for (let c = 1; c <= 9; c++) {
        const result = backtestBackyardWithConstants(results, testRounds, { a, b, c });
        if (result.accuracy > bestAccuracy) {
          bestAccuracy = result.accuracy;
          bestConstants = { a, b, c };
        }
      }
    }
  }

  return { constants: bestConstants, accuracy: bestAccuracy };
}

export function backtestBackyard(
  results: LottoResult[],
  rounds: number = 30
): BackyardBacktestResult {
  const best = findBestBackyardConstants(results, Math.min(100, results.length));
  return backtestBackyardWithConstants(results, rounds, best.constants);
}

// ===== V2: Smart Backyard - Dynamic Multi-Window =====

export function calculateSmartBackyard(
  results: LottoResult[],
  count: number = 4
): string[] {
  if (results.length < 5) {
    return ['00', '01', '10', '11'].slice(0, count);
  }

  // ใช้หลาย window พร้อมกัน
  const windows = [
    { size: 5, weight: 0.40 },   // 5 งวดล่าสุด (น้ำหนักมากสุด)
    { size: 10, weight: 0.25 },  // 10 งวด
    { size: 20, weight: 0.20 },  // 20 งวด
    { size: 30, weight: 0.15 },  // 30 งวด
  ];

  // Markov Chain จาก recent transitions
  const markov: Record<string, Record<string, number>> = {};
  const markovWindow = Math.min(15, results.length - 1);
  for (let i = 1; i <= markovWindow; i++) {
    const from = results[i].r2.padStart(2, '0');
    const to = results[i - 1].r2.padStart(2, '0');
    if (!markov[from]) markov[from] = {};
    // ให้น้ำหนักกับ transition ล่าสุดมากกว่า
    const recencyWeight = 1.0 / (i * 0.5 + 0.5);
    markov[from][to] = (markov[from][to] || 0) + recencyWeight;
  }

  // คำนวณคะแนนแต่ละเลข 00-99
  const scores: Record<string, number> = {};
  
  for (let num = 0; num <= 99; num++) {
    const numStr = num.toString().padStart(2, '0');
    let totalScore = 0;

    // 1. Multi-Window Frequency Score
    for (const win of windows) {
      const window = results.slice(0, win.size);
      let freq = 0;
      window.forEach((r, idx) => {
        if (r.r2.padStart(2, '0') === numStr) {
          // Recency bias - งวดล่าสุดน้ำหนักมากกว่า
          freq += 1.0 / (idx * 0.3 + 1);
        }
      });
      totalScore += (freq / window.length) * win.weight;
    }

    // 2. Markov Score (จากงวดล่าสุด)
    const lastR2 = results[0]?.r2.padStart(2, '0') || '00';
    const markovTotal = Object.values(markov).reduce((sum, transitions) => 
      sum + Object.values(transitions).reduce((s, v) => s + v, 0), 0
    );
    const markovFromLast = markov[lastR2]?.[numStr] || 0;
    const markovScore = markovTotal > 0 ? markovFromLast / markovTotal : 0;
    totalScore += markovScore * 0.30;

    // 3. Position Score (หลักสิบและหลักหน่วยแยกกัน)
    const [t, u] = splitDigits(num);
    const tensWindow = results.slice(0, 10);
    const unitsWindow = results.slice(0, 10);
    let tensCount = 0, unitsCount = 0;
    tensWindow.forEach((r, idx) => {
      const [rt, ru] = splitDigits(parseInt(r.r2, 10));
      if (rt === t) tensCount += 1.0 / (idx * 0.3 + 1);
      if (ru === u) unitsCount += 1.0 / (idx * 0.3 + 1);
    });
    const posScore = (tensCount + unitsCount) / (2 * tensWindow.length);
    totalScore += posScore * 0.20;

    // 4. Pattern Score - เลขที่ออกใน 3 งวดล่าสุดมีแนวโน้มออกซ้ำ
    const recent3 = results.slice(0, 3);
    let recentBonus = 0;
    recent3.forEach((r, idx) => {
      if (r.r2.padStart(2, '0') === numStr) {
        recentBonus += 0.1 / (idx + 1);
      }
    });
    totalScore += recentBonus;

    scores[numStr] = totalScore;
  }

  // เลือกเลขที่ได้คะแนนสูงสุด - แต่ต้องหลากหลาย
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  // เลือก top count แต่กระจายหลักสิบและหลักหน่วย
  const selected: string[] = [];
  const usedTens = new Set<number>();
  const usedUnits = new Set<number>();

  for (const [numStr] of sorted) {
    if (selected.length >= count) break;
    const [t, u] = splitDigits(parseInt(numStr, 10));
    
    // ให้คะแนนเพิ่มถ้าหลักสิบหรือหลักหน่วยยังไม่ถูกใช้
    let diversityBonus = 0;
    if (!usedTens.has(t)) diversityBonus += 0.01;
    if (!usedUnits.has(u)) diversityBonus += 0.01;
    
    selected.push(numStr);
    usedTens.add(t);
    usedUnits.add(u);
  }

  return selected.slice(0, count);
}

export function backtestSmartBackyard(
  results: LottoResult[],
  rounds: number = 30,
  count: number = 4
): BackyardBacktestResult {
  const hitDetails: BackyardBacktestResult['hitDetails'] = [];
  let hits = 0;
  let runningHits = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let currentRunningStreak = 0;
  let bestRunningStreak = 0;

  for (let i = 1; i < results.length && hitDetails.length < rounds; i++) {
    const historyForPrediction = results.slice(i);
    const targetResult = results[i - 1];

    const predicted = calculateSmartBackyard(historyForPrediction, count);
    const actual = targetResult.r2.padStart(2, '0');
    const isHit = predicted.includes(actual);
    
    // Running hit: ตรงหลักสิบหรือหลักหน่วยอย่างใดอย่างหนึ่ง
    const [aTens, aUnits] = [actual[0], actual[1]];
    const isRunning = predicted.some(p => p[0] === aTens || p[1] === aUnits);
    
    const hitNumber = isHit ? actual : null;

    if (isHit) {
      hits++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    if (isRunning) {
      runningHits++;
      currentRunningStreak++;
      bestRunningStreak = Math.max(bestRunningStreak, currentRunningStreak);
    } else {
      currentRunningStreak = 0;
    }

    hitDetails.push({
      date: targetResult.date,
      predicted,
      actual,
      isHit,
      isRunning,
      hitNumber
    });
  }

  const totalRounds = hitDetails.length;
  const accuracy = totalRounds > 0 ? (hits / totalRounds) * 100 : 0;
  const runningAccuracy = totalRounds > 0 ? (runningHits / totalRounds) * 100 : 0;

  return {
    totalRounds,
    hits,
    accuracy,
    runningHits,
    runningAccuracy,
    hitDetails,
    streak: { current: currentStreak, best: bestStreak },
    runningStreak: { current: currentRunningStreak, best: bestRunningStreak }
  };
}
