
import { LottoResult, Pattern } from '../types';
import {
  ngramPattern,
  hotNumbersFormula,
  master2DigitFormula,
  quantumFluxFormula,
  staticCoreFormula,
  markovChainFormula,
  neuralPatternFormula,
  deepLearning4DFormula,
  advancedClusterFormula
} from './formulas';

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

/**
 * วิเคราะห์โอกาสออกซ้ำ (Repeat Analysis)
 * @param results ข้อมูลหวยย้อนหลัง
 * @param targetNumber เลขที่ต้องการวิเคราะห์ (เช่น "10")
 * @param lookbackRounds จำนวนงวดที่จะตรวจสอบย้อนหลัง (default: 100)
 * @returns ผลการวิเคราะห์โอกาสออกซ้ำ
 */
export function analyzeRepeatProbability(
  results: LottoResult[],
  targetNumber: string,
  lookbackRounds: number = 100
): {
  totalOccurrences: number;           // จำนวนครั้งที่ออกทั้งหมด
  repeatAfterOne: number;              // ออกซ้ำในงวดถัดไป
  repeatAfterTwo: number;              // ออกซ้ำใน 2 งวดถัดไป
  repeatAfterThree: number;            // ออกซ้ำใน 3 งวดถัดไป
  repeatPercentage: number;            // % การออกซ้ำในงวดถัดไป
  averageGap: number;                  // ค่าเฉลี่ยช่องว่างระหว่างการออก
  lastSeenDate: string;                // วันที่ออกครั้งล่าสุด
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';  // ระดับความเชื่อมั่น
  recommendation: string;              // คำแนะนำ
} {
  if (!results || results.length === 0) {
    return {
      totalOccurrences: 0,
      repeatAfterOne: 0,
      repeatAfterTwo: 0,
      repeatAfterThree: 0,
      repeatPercentage: 0,
      averageGap: 0,
      lastSeenDate: 'ไม่พบข้อมูล',
      confidenceLevel: 'LOW',
      recommendation: 'ข้อมูลไม่เพียงพอ'
    };
  }

  const target = targetNumber.padStart(2, '0');
  const checkRounds = Math.min(lookbackRounds, results.length);
  
  let totalOccurrences = 0;
  let repeatAfterOne = 0;
  let repeatAfterTwo = 0;
  let repeatAfterThree = 0;
  const gaps: number[] = [];
  let lastSeenIdx = -1;

  // ตรวจสอบย้อนหลัง
  for (let i = 0; i < checkRounds; i++) {
    const r2 = results[i].r2.padStart(2, '0');
    
    if (r2 === target) {
      totalOccurrences++;
      
      // หากระยะห่างจากการออกครั้งก่อน
      if (lastSeenIdx !== -1) {
        gaps.push(lastSeenIdx - i);
      }
      lastSeenIdx = i;

      // ตรวจสอบว่าออกซ้ำในงวดถัดไปหรือไม่
      if (i > 0) {
        const nextR2 = results[i - 1].r2.padStart(2, '0');
        if (nextR2 === target) {
          repeatAfterOne++;
        }
        
        // ตรวจสอบ 2 งวดถัดไป
        if (i > 1) {
          const afterNextR2 = results[i - 2].r2.padStart(2, '0');
          if (afterNextR2 === target) {
            repeatAfterTwo++;
          }
        }
        
        // ตรวจสอบ 3 งวดถัดไป
        if (i > 2) {
          const thirdR2 = results[i - 3].r2.padStart(2, '0');
          if (thirdR2 === target) {
            repeatAfterThree++;
          }
        }
      }
    }
  }

  // คำนวณ % การออกซ้ำในงวดถัดไป
  // Avoid division by zero: ถ้า totalOccurrences <= 1 ไม่สามารถคำนวณอัตราได้
  const repeatPercentage = totalOccurrences > 1
    ? (repeatAfterOne / (totalOccurrences - 1)) * 100
    : 0;

  // ค่าเฉลี่ยช่องว่างระหว่างการออก
  const averageGap = gaps.length > 0
    ? gaps.reduce((a, b) => a + b, 0) / gaps.length
    : 0;

  // หาวันที่ออกครั้งล่าสุด
  const lastSeenDate = totalOccurrences > 0 
    ? results.find(r => r.r2.padStart(2, '0') === target)?.date || 'ไม่พบ'
    : 'ไม่เคยออก';

  // กำหนดระดับความเชื่อมั่นและคำแนะนำ
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  let recommendation: string;

  if (repeatPercentage > 20) {
    confidenceLevel = 'HIGH';
    recommendation = `⚠️ เลข ${target} มีแนวโน้มออกซ้ำสูง (${repeatPercentage.toFixed(1)}%)`;
  } else if (repeatPercentage > 10) {
    confidenceLevel = 'MEDIUM';
    recommendation = `🔶 เลข ${target} มีโอกาสออกซ้ำปานกลาง (${repeatPercentage.toFixed(1)}%)`;
  } else {
    confidenceLevel = 'LOW';
    recommendation = `✅ เลข ${target} มีโอกาสออกซ้ำต่ำ (${repeatPercentage.toFixed(1)}%) ควรเลี่ยง`;
  }

  // ถ้าไม่เคยออกเลย
  if (totalOccurrences === 0) {
    confidenceLevel = 'LOW';
    recommendation = `❓ เลข ${target} ไม่เคยออกในข้อมูลที่ตรวจสอบ`;
  }

  return {
    totalOccurrences,
    repeatAfterOne,
    repeatAfterTwo,
    repeatAfterThree,
    repeatPercentage,
    averageGap,
    lastSeenDate,
    confidenceLevel,
    recommendation
  };
}


export const fetchLottoData = async (): Promise<LottoResult[]> => {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("Network response was not ok");
    const text = await res.text();
    const rows = text.trim().split('\n').slice(1);
    
    console.log(`\n📊 CSV Data Analysis:`);
    console.log(`   Total rows in CSV: ${rows.length}`);
    console.log(`   First 3 rows:`, rows.slice(0, 3));
    
    const parsedData = rows.map(r => {
      const c = r.split(',');
      if (c.length < 4) return null;
      const r2Value = c[3]?.trim();
      const r2 = r2Value && r2Value !== "--" ? r2Value : "00";
      
      return { 
        date: c[0]?.trim(), 
        r4: c[1]?.trim().slice(-4) || "0000", 
        r3: c[2]?.trim() || "000", 
        r2: r2,
        year: c[0]?.trim().split('/').pop() || ""
      };
    }).filter((i): i is LottoResult => !!(i && i.date && i.r2));

    console.log(`   Successfully parsed: ${parsedData.length} results`);
    console.log(`   Date range: ${parsedData[0]?.date} to ${parsedData[parsedData.length - 1]?.date}`);
    console.log(`   First 5 results:`, parsedData.slice(0, 5));
    console.log(`   Last 5 results:`, parsedData.slice(-5));
    
    // Reverse to have oldest first for processing
    return parsedData.reverse();
  } catch (e) {
    console.error("Data Sync Error", e);
    return [];
  }
};

/**
 * MASTER SELECTION - หลักการคำนวณแบบผสมผสาน (Ensemble Method)
 *
 * ใช้หลักการ 5 ประการร่วมกัน:
 * 1. Hot Number Analysis - ตัวเลขที่ออกบ่อยในช่วง 20-30 งวด
 * 2. Cold Number Due - ตัวเลขที่ไม่ค่อยออก มีโอกาสออกสูง
 * 3. Position Analysis - วิเคราะห์ตำแหน่งหลักสิบและหลักหน่วยแยกกัน
 * 4. Pattern Recognition - หารูปแบบที่ซ้ำซาก (cycles, sequences)
 * 5. Trend Momentum - แนวโน้มการเปลี่ยนแปลงล่าสุด
 *
 * การให้คะแนน:
 * - แต่ละหลักการให้คะแนน 0-100 กับเลขแต่ละตัว
 * - รวมคะแนนทั้งหมด (weighted sum)
 * - เลือกเลขที่ได้คะแนนสูงสุดเป็น MASTER
 */

export const PATTERNS: Pattern[] = [
  ngramPattern,
  hotNumbersFormula,
  master2DigitFormula,
  quantumFluxFormula,
  staticCoreFormula,
  markovChainFormula,
  neuralPatternFormula,
  deepLearning4DFormula,
  advancedClusterFormula
];

export const MASTER_PATTERN = PATTERNS[0];

// Export individual formulas for direct use
export {
  ngramPattern,
  hotNumbersFormula,
  master2DigitFormula,
  quantumFluxFormula,
  staticCoreFormula,
  markovChainFormula,
  neuralPatternFormula,
  deepLearning4DFormula,
  advancedClusterFormula
};

export { MIRRORS };

/**
 * สูตรที่ 2: Multiplicative Scalar (x5 + 5) - จาก new.txt
 * สำหรับแสดงเลขเด่น (Running Digits) แยกต่างหาก
 */
export function calculateRunningDigits(l4?: string, l?: number): number[] {
  const top3Str = l4 || (l ? l.toString().padStart(4, '0').slice(1) : '000');
  const topValue = parseInt(top3Str.slice(0, 3), 10) || 0;

  const product = (topValue * 5).toString();
  const runningDigits = product.split('').map(char => {
    return (parseInt(char, 10) + 5) % 10;
  });

  return Array.from(new Set(runningDigits)).sort((a, b) => a - b);
}

export interface BacktestResult {
  totalRounds: number;
  directHits: number;
  runningHits: number;
  directAccuracy: number;
  runningAccuracy: number;
  maxConsecutiveHits: number; // Maximum consecutive correct predictions
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
  let maxConsecutiveHits = 0;
  let currentConsecutiveHits = 0;

  console.log(`\n🔍 Backtesting: ${pattern.name}`);
  console.log(`   Total results available: ${results.length}`);
  console.log(`   Rounds to test: ${rounds}`);
  console.log(`   results[0] (newest):`, results[0]?.date, results[0]?.r2);
  console.log(`   results[1]:`, results[1]?.date, results[1]?.r2);
  console.log(`   results[2]:`, results[2]?.date, results[2]?.r2);

  if (results.length < 3) {
    console.log(`   ⚠️ Not enough data (need at least 3 results)`);
    return {
      totalRounds: 0,
      directHits: 0,
      runningHits: 0,
      directAccuracy: 0,
      runningAccuracy: 0,
      maxConsecutiveHits: 0,
      hits: []
    };
  }

  // ✅ CORRECT LOGIC: ใช้ข้อมูลใหม่ทำนายใหม่ (Test newest data first!)
  // results เรียง: [0]=ใหม่สุด (2569), [1]=ใหม่รอง, [2]=ใหม่รองลงมา, ..., [last]=เก่าสุด (2564)
  // ใช้ results[i+1] (เก่ากว่าใน recent context) + results[i] (ใหม่กว่า) ทำนาย results[i-1] (ใหม่สุด)
  let debugCount = 0;
  
  // Start from i=1 to test NEWEST data first (2569), not oldest (2564)
  for (let i = 1; i < results.length - 1 && hits.length < rounds; i++) {
    const prev = results[i + 1];   // งวดเก่ากว่า (ใช้ทำนาย)
    const current = results[i];    // งวดใหม่กว่า (ใช้ทำนาย)
    const next = results[i - 1];   // งวดใหม่สุด (สิ่งที่ต้องการทำนาย)

    if (!prev || !current || !next) continue;

    const prevR2 = parseInt(prev.r2, 10);
    const currentR2 = parseInt(current.r2, 10);
    const nextR2 = parseInt(next.r2, 10);

    // Debug first 3 iterations
    if (debugCount < 3) {
      console.log(`   Iteration ${debugCount + 1}:`);
      console.log(`     prev=${prev.date} r2=${prev.r2}`);
      console.log(`     current=${current.date} r2=${current.r2}`);
      console.log(`     next=${next.date} r2=${next.r2} (target)`);
    }

    // Pass historical data (Ensuring NO data leakage: target result must NOT be in history)
    // results sorted [0]=newest, [1], [2]...
    // To predict next=results[i-1], we must only use results[i] and older.
    const historicalResults = results.slice(i); 
    const predicted = pattern.calc(prevR2, currentR2, current.r4, historicalResults);
    const isDirect = predicted === nextR2;

    if (debugCount < 3) {
      console.log(`     predicted=${predicted}, actual=${nextR2}, isDirect=${isDirect}`);
    }

    const runningNumbers = [
      Math.floor(predicted / 10),
      predicted % 10
    ];
    const nextTens = Math.floor(nextR2 / 10);
    const nextUnits = nextR2 % 10;
    const isRunning = runningNumbers.includes(nextTens) || runningNumbers.includes(nextUnits);

    if (debugCount < 3) {
      console.log(`     runningNumbers=[${runningNumbers}], actual=[${nextTens},${nextUnits}], isRunning=${isRunning}`);
      console.log(`     ---`);
    }

    // Track consecutive hits
    if (isDirect || isRunning) {
      currentConsecutiveHits++;
      maxConsecutiveHits = Math.max(maxConsecutiveHits, currentConsecutiveHits);
    } else {
      currentConsecutiveHits = 0;
    }

    if (isDirect) directHits++;
    if (isRunning && !isDirect) runningHits++;

    hits.push({
      date: next.date,
      predicted,
      actual: nextR2,
      isDirect,
      isRunning
    });

    debugCount++;
  }

  console.log(`   ✅ Tested: ${hits.length} rounds`);
  console.log(`   🎯 Direct Hits: ${directHits} (${hits.length > 0 ? (directHits / hits.length * 100).toFixed(1) : 0}%)`);
  console.log(`   🏃 Running Hits: ${runningHits} (${hits.length > 0 ? (runningHits / hits.length * 100).toFixed(1) : 0}%)`);
  console.log(`   🔥 Max Consecutive: ${maxConsecutiveHits}`);

  return {
    totalRounds: hits.length,
    directHits,
    runningHits,
    directAccuracy: hits.length > 0 ? (directHits / hits.length) * 100 : 0,
    runningAccuracy: hits.length > 0 ? ((directHits + runningHits) / hits.length) * 100 : 0,
    maxConsecutiveHits,
    hits
  };
}

export function calculateCombinedConfidence(
  predictions: Array<{ name: string; value: string }>,
  bestPatternStats: BacktestResult,
  topT: string[],
  topU: string[]
): number {
  // 1. Base Accuracy Score (40%)
  const baseAccuracy = (bestPatternStats.directAccuracy * 0.8) + (bestPatternStats.runningAccuracy * 0.2);
  const scoreFromAccuracy = Math.min(baseAccuracy, 100) * 0.4;

  // 2. Convergence Score (40%) - How many patterns agree on the same number
  const valueCounts: Record<string, number> = {};
  predictions.forEach(p => {
    valueCounts[p.value] = (valueCounts[p.value] || 0) + 1;
  });
  
  const primaryValue = predictions[0].value;
  const agreementCount = valueCounts[primaryValue] || 1;
  const convergenceBonus = (agreementCount / predictions.length) * 100 * 0.4;

  // 3. Frequency Alignment (20%) - Does it match Hot Numbers?
  let frequencyBonus = 0;
  if (topT.includes(primaryValue[0])) frequencyBonus += 10;
  if (topU.includes(primaryValue[1])) frequencyBonus += 10;
  const scoreFromFrequency = frequencyBonus;

  return Math.round(scoreFromAccuracy + convergenceBonus + scoreFromFrequency);
}

export function findBestPattern(results: LottoResult[], rounds: number = 20): { pattern: Pattern, stats: BacktestResult } {
  let bestPattern = PATTERNS[0];
  let bestStats = backtestPattern(results, bestPattern, rounds);

  PATTERNS.forEach(p => {
    const stats = backtestPattern(results, p, rounds);
    // Prioritize direct hits, then running hits, then consecutive hits
    if (stats.directAccuracy > bestStats.directAccuracy || 
       (stats.directAccuracy === bestStats.directAccuracy && stats.runningAccuracy > bestStats.runningAccuracy) ||
       (stats.directAccuracy === bestStats.directAccuracy && stats.runningAccuracy === bestStats.runningAccuracy && 
        stats.maxConsecutiveHits > bestStats.maxConsecutiveHits)) {
      bestPattern = p;
      bestStats = stats;
    }
  });

  return { pattern: bestPattern, stats: bestStats };
}

/**
 * กรองสูตรที่ทำงานไม่ผ่านเกณฑ์: ต้องทายถูกติดต่อกันอย่างน้อย 5-6 งวด
 * @param results ข้อมูลหวยย้อนหลัง
 * @param minConsecutive จำนวนงวดติดต่อกันขั้นต่ำ (default: 6)
 * @param rounds จำนวนรอบที่จะทดสอบ
 * @returns รายการสูตรที่ผ่านเกณฑ์
 */
export function filterPatternsByConsecutive(
  results: LottoResult[],
  minConsecutive: number = 6,
  rounds: number = 30
): Array<{ pattern: Pattern, stats: BacktestResult }> {
  const qualifiedPatterns: Array<{ pattern: Pattern, stats: BacktestResult }> = [];

  PATTERNS.forEach(p => {
    const stats = backtestPattern(results, p, rounds);
    
    // เก็บเฉพาะสูตรที่ maxConsecutiveHits >= minConsecutive
    if (stats.maxConsecutiveHits >= minConsecutive) {
      qualifiedPatterns.push({ pattern: p, stats });
    } else {
      console.log(`❌ สูตร "${p.name}" ถูกคัดออก: ทายถูกติดต่อกันสูงสุด ${stats.maxConsecutiveHits} งวด (ต้องการ ${minConsecutive})`);
    }
  });

  // เรียงตาม directAccuracy จากมากไปน้อย
  qualifiedPatterns.sort((a, b) => b.stats.directAccuracy - a.stats.directAccuracy);
  
  console.log(`\n✅ สูตรที่ผ่านเกณฑ์ (${minConsecutive} งวดติด): ${qualifiedPatterns.length}/${PATTERNS.length} สูตร`);
  qualifiedPatterns.forEach((qp, idx) => {
    console.log(`  ${idx + 1}. ${qp.pattern.name} - Accuracy: ${qp.stats.directAccuracy.toFixed(1)}%, Max Consecutive: ${qp.stats.maxConsecutiveHits}`);
  });

  return qualifiedPatterns;
}

/**
 * HYBRID ANALYSIS - วิเคราะห์ทั้ง Historical + Current + Stability
 * @param results ข้อมูลหวยย้อนหลังทั้งหมด
 * @param currentMasterPattern สูตรที่เป็น Active Master อยู่ (ถ้ามี)
 * @param minConsecutive จำนวนงวดติดต่อกันขั้นต่ำ (default: 4)
 * @returns ข้อมูล Hybrid ของทุกสูตร
 */
export function analyzeHybridPatterns(
  results: LottoResult[],
  currentMasterPattern?: Pattern,
  minConsecutive: number = 4
): Array<import('../types').HybridPatternInfo> {
  const hybridResults: Array<import('../types').HybridPatternInfo> = [];

  PATTERNS.forEach(pattern => {
    // 1. Historical Performance (30 งวด)
    const historicalStats = backtestPattern(results, pattern, 30);
    
    // 2. Current Performance (10 งวดล่าสุด)
    const currentStats = backtestPattern(results, pattern, 10);
    
    // 3. ตรวจสอบว่าผ่านเกณฑ์หรือไม่
    const isQualified = historicalStats.maxConsecutiveHits >= minConsecutive;
    
    // 4. คำนวณ Stability Score (0-100)
    // สูตรที่มี performance คงที่ระหว่าง historical vs current จะได้คะแนนสูง
    const accuracyDiff = Math.abs(historicalStats.directAccuracy - currentStats.directAccuracy);
    const consecutiveDiff = Math.abs(historicalStats.maxConsecutiveHits - currentStats.maxConsecutiveHits);

    // Stability = 100 - (ความแตกต่างของ accuracy + ความแตกต่างของ consecutive)
    let stabilityScore = Math.max(0, Math.min(100,
      100 - (accuracyDiff * 2) - (consecutiveDiff * 5)
    ));

    // ⚠️ IMPORTANT: ถ้า Historical Accuracy ต่ำมาก (< 5%) แสดงว่าสูตรไม่ทำงาน
    // Stability ควรต่ำด้วย แม้ Historical = Current ก็ตาม
    if (historicalStats.directAccuracy < 5 && currentStats.directAccuracy < 5) {
      // ถ้าทั้งสองค่าต่ำมาก ให้ Stability = 0% (ไม่มีความน่าเชื่อถือ)
      stabilityScore = 0;
    } else if (historicalStats.directAccuracy < 10 || currentStats.directAccuracy < 10) {
      // ถ้าค่าใดค่าหนึ่งต่ำ (< 10%) ให้ปรับ Stability ลง 50%
      stabilityScore = stabilityScore * 0.5;
    }

    hybridResults.push({
      pattern,
      historicalStats,
      currentStats,
      isQualified,
      stabilityScore: Math.round(stabilityScore),
      isActiveMaster: false // จะเซ็ตด้านล่าง
    });
  });

  // เลือก Active Master ด้วยกฎ Hybrid แบบใหม่
  // ใช้คะแนนรวม: Current (40%) + Stability (30%) + Historical (20%) + Trend (10%)
  let selectedMaster = selectHybridMasterV2(hybridResults, currentMasterPattern);

  // เซ็ต isActiveMaster
  hybridResults.forEach(h => {
    h.isActiveMaster = h.pattern.name === selectedMaster.pattern.name;
  });

  // เรียงตามคะแนนรวมแบบใหม่
  hybridResults.sort((a, b) => {
    const scoreA = calculateHybridScore(a);
    const scoreB = calculateHybridScore(b);
    return scoreB - scoreA;
  });

  return hybridResults;
}

/**
 * คำนวณคะแนนรวมแบบใหม่
 * Current (40%) + Stability (30%) + Historical (20%) + Trend (10%)
 */
function calculateHybridScore(h: import('../types').HybridPatternInfo): number {
  // 1. Current Performance (40%) - สำคัญที่สุด
  const currentScore = h.currentStats.directAccuracy * 0.4;

  // 2. Stability (30%) - ความมั่นคง
  const stabilityScore = h.stabilityScore * 0.3;

  // 3. Historical Performance (20%) - ประสิทธิภาพอดีต
  const historicalScore = h.historicalStats.directAccuracy * 0.2;

  // 4. Trend (10%) - แนวโน้ม
  // ปรับน้ำหนัก Trend ให้มีผลมากขึ้น: ±10 คะแนน (ไม่ใช่ ±1)
  const accuracyDiff = h.currentStats.directAccuracy - h.historicalStats.directAccuracy;
  let trendScore = 0;
  if (accuracyDiff > 5) {
    // กำลังดีขึ้น (+10 คะแนน × 10% = 1 คะแนน)
    trendScore = 10 * 0.1;
  } else if (accuracyDiff < -5) {
    // กำลังแย่ลง (-10 คะแนน × 10% = -1 คะแนน)
    trendScore = -10 * 0.1;
  } else {
    // คงที่ (0 คะแนน)
    trendScore = 0;
  }

  return currentScore + stabilityScore + historicalScore + trendScore;
}

/**
 * เลือก Active Master ด้วยกฎ Hybrid Approach V2
 * ใช้คะแนนรวม: Current (40%) + Stability (30%) + Historical (20%) + Trend (10%)
 */
function selectHybridMasterV2(
  hybridResults: Array<import('../types').HybridPatternInfo>,
  currentMasterPattern?: Pattern
): import('../types').HybridPatternInfo {
  // คำนวณคะแนนทุกสูตร
  const scored = hybridResults.map(h => ({
    ...h,
    score: calculateHybridScore(h)
  }));

  // เรียงตามคะแนน
  scored.sort((a, b) => b.score - a.score);

  // ถ้ามี current master
  if (currentMasterPattern) {
    const currentMaster = scored.find(h => h.pattern.name === currentMasterPattern.name);
    const bestAlternative = scored[0];

    if (currentMaster && bestAlternative.pattern.name !== currentMaster.pattern.name) {
      // เปลี่ยนสูตรเฉพาะเมื่อ:
      // 1. สูตรปัจจุบันมีคะแนนต่ำกว่าอันดับ 1 มากกว่า 15 คะแนน หรือ
      // 2. สูตรปัจจุบันมี Stability < 40% (ไม่มั่นคง) หรือ
      // 3. สูตรปัจจุบันมี Current = 0% (ไม่ถูกเลย 10 งวด)
      const scoreDiff = bestAlternative.score - currentMaster.score;
      const shouldSwitch = 
        scoreDiff > 15 || 
        currentMaster.stabilityScore < 40 ||
        currentMaster.currentStats.directAccuracy === 0;

      if (shouldSwitch) {
        return bestAlternative;
      } else {
        // ยังใช้สูตรเดิม
        return currentMaster;
      }
    }

    if (currentMaster) {
      return currentMaster;
    }
  }

  // ไม่มี current master → เลือกสูตรที่ดีที่สุด
  return scored[0];
}

/**
 * เลือก Active Master ด้วยกฎ Hybrid Approach (เดิม - เก็บไว้สำหรับ backward compatibility)
 * - เปลี่ยนสูตรเฉพาะเมื่อ:
 *   1. สูตรปัจจุบัน maxConsecutive < 4 (ล้มเหลว) หรือ
 *   2. สูตรใหม่ดีกว่าอย่างน้อย 10% และ stable
 */
function selectHybridMaster(
  hybridResults: Array<import('../types').HybridPatternInfo>,
  currentMasterPattern?: Pattern
): import('../types').HybridPatternInfo {
  // กรองเฉพาะสูตรที่ qualified
  const qualified = hybridResults.filter(h => h.isQualified);
  
  if (qualified.length === 0) {
    // ถ้าไม่มีสูตรไหน qualified เลย ใช้สูตรที่ดีที่สุด
    return hybridResults[0];
  }

  // ถ้ามี current master และยัง qualified อยู่
  if (currentMasterPattern) {
    const currentMaster = hybridResults.find(h => h.pattern.name === currentMasterPattern.name);
    
    if (currentMaster && currentMaster.isQualified) {
      // ตรวจสอบว่ามีสูตรอื่นที่ดีกว่ามากไหม (ดีกว่า 10% ขึ้นไป)
      const betterAlternative = qualified.find(h => {
        if (h.pattern.name === currentMasterPattern.name) return false;
        const historicalDiff = h.historicalStats.directAccuracy - currentMaster.historicalStats.directAccuracy;
        const stabilityBonus = (h.stabilityScore - currentMaster.stabilityScore) / 10;
        return (historicalDiff + stabilityBonus) >= 10; // ต้องดีกว่า 10%
      });

      if (!betterAlternative) {
        // ยังไม่มีสูตรที่ดีกว่ามาก → ใช้สูตรเดิมต่อไป
        return currentMaster;
      }
      
      // มีสูตรที่ดีกว่ามาก → เปลี่ยนไปใช้สูตรใหม่
      return betterAlternative;
    }
    
    // current master ไม่ qualified แล้ว → เลือกสูตรใหม่ที่ดีที่สุด
    return qualified[0];
  }

  // ไม่มี current master → เลือกสูตรที่ดีที่สุด
  return qualified[0];
}

/**
 * วิเคราะห์ความน่าเชื่อถือของการทำนาย (Prediction Confidence Analysis)
 * ตรวจสอบว่าเลขที่ทำนายมีความน่าเชื่อถือมากน้อยเพียงใด
 * @param predictedNumber เลขที่ทำนาย
 * @param results ข้อมูลหวยย้อนหลัง
 * @param patternStats สถิติของสูตรที่ใช้
 * @returns ระดับความเชื่อมั่นและคำแนะนำ
 */
export function analyzePredictionConfidence(
  predictedNumber: number,
  results: LottoResult[],
  patternStats: { directAccuracy: number, runningAccuracy: number, maxConsecutiveHits: number }
): {
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  confidenceScore: number;  // 0-100
  frequencyScore: number;   // 0-100
  trendAlignment: number;   // 0-100
  patternStrength: number;  // 0-100
  warning: string | null;
  recommendation: string;
} {
  if (!results || results.length < 10) {
    return {
      confidenceLevel: 'VERY_LOW',
      confidenceScore: 0,
      frequencyScore: 0,
      trendAlignment: 0,
      patternStrength: 0,
      warning: '⚠️ ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์',
      recommendation: 'รอให้มีข้อมูลอย่างน้อย 10 งวด'
    };
  }

  const predicted = predictedNumber.toString().padStart(2, '0');
  const predTens = Math.floor(predictedNumber / 10);
  const predUnits = predictedNumber % 10;

  // ===== 1. FREQUENCY ANALYSIS (30%) =====
  // เลขที่ทำนายออกบ่อยแค่ไหนในอดีต
  let predictedCount = 0;
  const recentWindow = Math.min(30, results.length);
  
  for (let i = 0; i < recentWindow; i++) {
    const r2 = parseInt(results[i].r2, 10);
    if (r2 === predictedNumber) {
      predictedCount++;
    }
  }
  
  // คะแนนความถี่ (ออก 1 ครั้ง = 50 คะแนน, 2 ครั้ง = 70, 3+ ครั้ง = 90)
  const frequencyScore = predictedCount === 0 ? 30 : 
                         predictedCount === 1 ? 50 :
                         predictedCount === 2 ? 70 : 90;

  // ===== 2. TREND ALIGNMENT (25%) =====
  // เลขที่ทำนายสอดคล้องกับแนวโน้มล่าสุดหรือไม่
  const recent10 = results.slice(0, Math.min(10, results.length));
  const recentTensAvg = recent10.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent10.length;
  const recentUnitsAvg = recent10.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / recent10.length;
  
  const tensDiff = Math.abs(predTens - recentTensAvg);
  const unitsDiff = Math.abs(predUnits - recentUnitsAvg);
  
  // ถ้ายิ่งใกล้ค่าเฉลี่ย récent ยิ่งได้คะแนนสูง
  const trendAlignment = Math.max(0, 100 - ((tensDiff + unitsDiff) * 15));

  // ===== 3. PATTERN STRENGTH (25%) =====
  // สูตรที่ใช้มีประสิทธิภาพแค่ไหน
  const patternStrength = Math.min(100, 
    (patternStats.directAccuracy * 0.6) + 
    (patternStats.runningAccuracy * 0.25) + 
    (Math.min(patternStats.maxConsecutiveHits, 10) * 10 * 0.15)
  );

  // ===== 4. RECENCY FACTOR (20%) =====
  // เลขที่ทำนายออกในงวดล่าสุดหรือไม่ (ถ้าออกแล้วอาจไม่ออกอีก)
  const lastR2 = parseInt(results[0].r2, 10);
  const wasJustDrawn = lastR2 === predictedNumber;
  
  // ถ้าออกในงวดล่าสุด ลดคะแนนลง 30%
  const recencyScore = wasJustDrawn ? 40 : 70;

  // ===== COMBINE ALL SCORES =====
  const confidenceScore = Math.round(
    (frequencyScore * 0.30) +
    (trendAlignment * 0.25) +
    (patternStrength * 0.25) +
    (recencyScore * 0.20)
  );

  // ===== DETERMINE CONFIDENCE LEVEL =====
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  let warning: string | null = null;
  let recommendation: string;

  if (confidenceScore >= 70) {
    confidenceLevel = 'HIGH';
    recommendation = `✅ เลข ${predicted} มีความน่าเชื่อถือสูง (${confidenceScore}%)`;
  } else if (confidenceScore >= 50) {
    confidenceLevel = 'MEDIUM';
    recommendation = `🔶 เลข ${predicted} มีความน่าเชื่อถือปานกลาง (${confidenceScore}%) ควรใช้ร่วมกับเลขอื่น`;
  } else if (confidenceScore >= 30) {
    confidenceLevel = 'LOW';
    warning = `⚠️ ความน่าเชื่อถือต่ำ (${confidenceScore}%)`;
    recommendation = `เลข ${predicted} อาจไม่เหมาะสม ควรพิจารณาเลขอื่นหรือรื่องวดถัดไป`;
  } else {
    confidenceLevel = 'VERY_LOW';
    warning = `❌ ความน่าเชื่อถือต่ำมาก (${confidenceScore}%)`;
    recommendation = `ไม่แนะนำให้ใช้เลข ${predicted} ควรเปลี่ยนสูตรหรือรื่องวดถัดไป`;
  }

  // Extra warning if just drawn
  if (wasJustDrawn) {
    warning = warning ? warning + ` | เลข ${predicted} เพิ่งออกในงวดล่าสุด` : 
              `⚠️ เลข ${predicted} เพิ่งออกในงวดล่าสุด อาจไม่ออกอีก`;
  }

  return {
    confidenceLevel,
    confidenceScore,
    frequencyScore,
    trendAlignment,
    patternStrength,
    warning,
    recommendation
  };
}

/**
 * วิเคราะห์แนวโน้มความแม่นยำ (Accuracy Trend Analysis)
 * ดูว่าสูตรมีความแม่นยำเพิ่มขึ้นหรือลดลงในช่วงหลัง
 * @param results ข้อมูลหวยย้อนหลัง
 * @param pattern สูตรที่จะวิเคราะห์
 * @param windowSize จำนวนงวดที่จะตรวจสอบ (default: 20)
 * @returns ผลการวิเคราะห์แนวโน้ม
 */
export function analyzeAccuracyTrend(
  results: LottoResult[],
  pattern: Pattern,
  windowSize: number = 20
): {
  recentAccuracy: number;      // ความแม่นยำ 10 งวดล่าสุด
  olderAccuracy: number;       // ความแม่นยำ 10 งวดก่อนหน้า
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  trendPercentage: number;     // % การเปลี่ยนแปลง
  recommendation: string;
} {
  if (!results || results.length < windowSize * 2) {
    return {
      recentAccuracy: 0,
      olderAccuracy: 0,
      trend: 'STABLE',
      trendPercentage: 0,
      recommendation: 'ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์แนวโน้ม'
    };
  }

  // ✅ แก้ไข Bug #3: ใช้ข้อมูลที่ถูกต้อง
  // ทดสอบ windowSize งวดล่าสุด (เช่น 10 งวด)
  const recentResults = backtestPattern(results, pattern, Math.min(windowSize, results.length));

  // ทดสอบ windowSize งวดก่อนหน้า (ตัดงวดล่าสุดออก)
  const olderResultsSubset = results.slice(windowSize);
  const olderResults = backtestPattern(olderResultsSubset, pattern, Math.min(windowSize, olderResultsSubset.length));

  const recentAccuracy = recentResults.directAccuracy;
  const olderAccuracy = olderResults.directAccuracy;
  
  const trendPercentage = olderAccuracy > 0 
    ? ((recentAccuracy - olderAccuracy) / olderAccuracy) * 100 
    : 0;

  let trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  let recommendation: string;

  if (trendPercentage > 10) {
    trend = 'IMPROVING';
    recommendation = `📈 สูตร "${pattern.name}" มีแนวโน้มดีขึ้น (+${trendPercentage.toFixed(1)}%)`;
  } else if (trendPercentage < -10) {
    trend = 'DECLINING';
    recommendation = `📉 สูตร "${pattern.name}" มีแนวโน้มลดลง (${trendPercentage.toFixed(1)}%) ควรเปลี่ยนสูตร`;
  } else {
    trend = 'STABLE';
    recommendation = `➡️ สูตร "${pattern.name}" คงที่ (${trendPercentage >= 0 ? '+' : ''}${trendPercentage.toFixed(1)}%)`;
  }

  return {
    recentAccuracy,
    olderAccuracy,
    trend,
    trendPercentage,
    recommendation
  };
}

