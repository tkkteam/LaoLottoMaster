import { LottoResult } from '../../types';

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
  accuracyTrend: 'UP' | 'DOWN' | 'STABLE';
}

/**
 * BACKYARD STRATEGY (ชุดเสริม) - V7 Optimized for 2569
 * สูตรคำนวณแบบ Pure Arithmetic เพื่อความแม่นยำสูงสุด
 */
export function calculateBackyard(
  r3Str: string, 
  r2Str: string, 
  constants: { a: number; b: number; c: number; d: number } = { a: 6, b: 5, c: 2, d: 8 }
): string[] {
  if (!r3Str || r3Str.length < 3 || !r2Str || r2Str.length < 2) return [];

  const d1 = parseInt(r3Str[0], 10) || 0; // r3 digit 1
  const d2 = parseInt(r3Str[1], 10) || 0; // r3 digit 2
  const d3 = parseInt(r3Str[2], 10) || 0; // r3 digit 3
  const d4 = parseInt(r2Str[0], 10) || 0; // r2 digit 1
  const d5 = parseInt(r2Str[1], 10) || 0; // r2 digit 2

  // Tens calculation (หลักสิบ)
  const t1 = (d1 + d2 + constants.a) % 10;
  const t2 = (d2 + d3 + constants.b) % 10;
  
  // Units calculation (หลักหน่วย)
  const u1 = (d4 + constants.c) % 10;
  const u2 = (d5 + constants.d) % 10;

  return [`${t1}${u1}`, `${t1}${u2}`, `${t2}${u1}`, `${t2}${u2}`];
}

export function backtestBackyardWithConstants(
  results: LottoResult[],
  rounds: number = 30,
  constants: { a: number; b: number; c: number; d: number } = { a: 6, b: 5, c: 2, d: 8 }
): BackyardBacktestResult {
  const hitDetails: BackyardBacktestResult['hitDetails'] = [];
  let hits = 0;
  let runningHits = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let currentRunningStreak = 0;
  let bestRunningStreak = 0;

  // วนลูปจากข้อมูลใหม่ไปเก่า (results[0] คือใหม่สุด)
  // เพื่อทำนาย r2 ของ results[i-1] โดยใช้ r3, r2 ของ results[i]
  for (let i = 1; i < results.length && hitDetails.length < rounds; i++) {
    const prevResult = results[i];
    const targetResult = results[i - 1];

    const predicted = calculateBackyard(prevResult.r3, prevResult.r2, constants);
    const actual = targetResult.r2.padStart(2, '0');
    const isHit = predicted.includes(actual);
    
    // Running hit: ตรงหลักสิบหรือหลักหน่วยอย่างใดอย่างหนึ่งในชุดที่ทำนาย
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
    runningStreak: { current: currentRunningStreak, best: bestRunningStreak },
    accuracyTrend: 'STABLE' // Placeholder for trend
  };
}
