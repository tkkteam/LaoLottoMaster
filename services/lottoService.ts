
import { LottoResult, Pattern } from '../types';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKbaNztX47-SnDvWbfYskTxHscwDCRYkEnVuKFmc-R8v7usDwWEjs-QaWk3cDm6yBGI7NImVNYaqFc/pub?gid=709667456&single=true&output=csv';

const MIRRORS: Record<string, string> = { 
  '0': '5', '1': '6', '2': '7', '3': '8', '4': '9', 
  '5': '0', '6': '1', '7': '2', '8': '3', '9': '4' 
};

export function getDigitSum(numStr: string): number {
  if (!numStr || numStr === "--") return 0;
  let val = numStr.toString().replace(/[^0-9]/g, '');
  if (!val) return 0;
  let sum = val.split('').reduce((a, b) => a + parseInt(b, 10), 0);
  while (sum > 9) {
    sum = sum.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
  }
  return sum;
}

export function getMirror(num: string | number): string {
  let s = num.toString().padStart(2, '0');
  return (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
}

export function calculateBackyard(r3Str: string, r4Str: string): string[] {
  if (!r3Str || r3Str.length < 3) return [];
  const h = parseInt(r3Str[0], 10) || 0;
  const t = parseInt(r3Str[1], 10) || 0;
  const u = parseInt(r3Str[2], 10) || 0;
  const adaptive = getDigitSum(r4Str) || 9;
  
  const t1 = (h + t + u + adaptive) % 10;
  const t2 = (t1 + 6) % 10;
  
  const u1 = (u + 7) % 10;
  const u2 = (u1 + 1) % 10;
  
  return [`${t1}${u1}`, `${t1}${u2}`, `${t2}${u1}`, `${t2}${u2}`];
}

export const fetchLottoData = async (): Promise<LottoResult[]> => {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("Network response was not ok");
    const text = await res.text();
    const rows = text.trim().split('\n').slice(1);
    
    return rows.map(r => {
      const c = r.split(',');
      if (c.length < 4) return null;
      return { 
        date: c[0]?.trim(), 
        r4: c[1]?.trim().slice(-4) || "0000", 
        r3: c[2]?.trim() || "000", 
        r2: c[3]?.trim() || "00", 
        year: c[0]?.trim().split('/').pop() || ""
      };
    }).filter((i): i is LottoResult => !!(i && i.date && i.r2)).reverse();
  } catch (e) {
    console.error("Data Sync Error", e);
    return [];
  }
};

export const PATTERNS: Pattern[] = [
  {
    name: "Master 2-Digit (สูตรอมตะ)",
    calc: (p, l, l4) => {
      const s = l4 || l.toString().padStart(4, '0');
      const a = parseInt(s[0], 10) || 0;
      const b = parseInt(s[1], 10) || 0;
      const c = parseInt(s[2], 10) || 0;
      const d = parseInt(s[3], 10) || 0;
      const tens = ((a * 2) + b + 5) % 10;
      const units = (c + d + 3) % 10;
      return (tens * 10) + units;
    },
    getMirrorPair: (result: number) => {
      const s = result.toString().padStart(2, '0');
      const mirrorStr = (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
      return parseInt(mirrorStr, 10);
    }
  },
  {
    name: "Quantum Flux (สูตรไหล)",
    calc: (p, l) => {
      const p1 = Math.floor(p / 10);
      const p2 = p % 10;
      const l1 = Math.floor(l / 10);
      const l2 = l % 10;
      const tens = (p1 + l1 + 7) % 10;
      const units = (p2 + l2 + 1) % 10;
      return (tens * 10) + units;
    }
  },
  {
    name: "Static Core (สูตรนิ่ง)",
    calc: (p, l, l4) => {
      const s = l4 || l.toString().padStart(4, '0');
      const sumAll = s.split('').reduce((acc, curr) => acc + parseInt(curr, 10), 0);
      const tens = (sumAll + 5) % 10;
      const units = (parseInt(s[3], 10) + 9) % 10;
      return (tens * 10) + units;
    }
  },
  {
    name: "Mirror Matrix (สูตรกระจก)",
    calc: (p, l) => {
      const s = l.toString().padStart(2, '0');
      const m1 = parseInt(MIRRORS[s[0]] || '0', 10);
      const m2 = parseInt(MIRRORS[s[1]] || '0', 10);
      const tens = (m1 + 3) % 10;
      const units = (m2 + 5) % 10;
      return (tens * 10) + units;
    }
  },
  {
    name: "Golden Ratio (สูตรรวมโชค)",
    calc: (p, l, l4) => {
      const lastR2 = l;
      const prevR2 = p;
      const tens = (Math.floor(lastR2 / 10) + (prevR2 % 10) + 4) % 10;
      const units = ((lastR2 % 10) + Math.floor(prevR2 / 10) + 8) % 10;
      return (tens * 10) + units;
    }
  }
];

export const MASTER_PATTERN = PATTERNS[0];

export interface BacktestResult {
  totalRounds: number;
  directHits: number;
  runningHits: number;
  directAccuracy: number;
  runningAccuracy: number;
  hits: Array<{ date: string; predicted: number; actual: number; isDirect: boolean; isRunning: boolean }>;
}

export function backtestPattern(
  results: LottoResult[],
  pattern: Pattern,
  rounds: number = 20
): BacktestResult {
  const hits: BacktestResult['hits'] = [];
  let directHits = 0;
  let runningHits = 0;

  for (let i = results.length - 2; i >= 0 && hits.length < rounds; i--) {
    const prev = results[i + 1];
    const current = results[i];
    
    // Find next result to check prediction
    if (i === 0) continue; // Cannot predict current from future

    const next = results[i - 1];
    if (!next) continue;

    const prevR2 = parseInt(prev.r2, 10);
    const currentR2 = parseInt(current.r2, 10);
    const nextR2 = parseInt(next.r2, 10);

    const predicted = pattern.calc(prevR2, currentR2, current.r4);
    const isDirect = predicted === nextR2;

    const runningNumbers = [
      Math.floor(predicted / 10),
      predicted % 10
    ];
    const nextTens = Math.floor(nextR2 / 10);
    const nextUnits = nextR2 % 10;
    const isRunning = runningNumbers.includes(nextTens) || runningNumbers.includes(nextUnits);

    if (isDirect) directHits++;
    if (isRunning && !isDirect) runningHits++;

    hits.push({
      date: next.date,
      predicted,
      actual: nextR2,
      isDirect,
      isRunning
    });
  }

  return {
    totalRounds: hits.length,
    directHits,
    runningHits,
    directAccuracy: hits.length > 0 ? (directHits / hits.length) * 100 : 0,
    runningAccuracy: hits.length > 0 ? ((directHits + runningHits) / hits.length) * 100 : 0,
    hits
  };
}

export function findBestPattern(results: LottoResult[], rounds: number = 20): { pattern: Pattern, stats: BacktestResult } {
  let bestPattern = PATTERNS[0];
  let bestStats = backtestPattern(results, bestPattern, rounds);

  PATTERNS.forEach(p => {
    const stats = backtestPattern(results, p, rounds);
    // Prioritize direct hits, then running hits
    if (stats.directAccuracy > bestStats.directAccuracy || 
       (stats.directAccuracy === bestStats.directAccuracy && stats.runningAccuracy > bestStats.runningAccuracy)) {
      bestPattern = p;
      bestStats = stats;
    }
  });

  return { pattern: bestPattern, stats: bestStats };
}
