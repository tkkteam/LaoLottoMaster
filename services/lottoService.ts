
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
  const repeatPercentage = totalOccurrences > 0 
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
  },
  {
    name: "Markov Chain (มาร์คอฟเชน)",
    calc: (p, l, l4, results?) => {
      // Markov Chain: วิเคราะห์ความน่าจะเป็นจากการเปลี่ยนสถานะ
      if (!results || results.length < 10) {
        // Fallback to simple calculation if insufficient data
        const tens = (Math.floor(l / 10) + Math.floor(p / 10) + 3) % 10;
        const units = ((l % 10) + (p % 10) + 7) % 10;
        return (tens * 10) + units;
      }

      // Build transition matrix from historical data
      const transitionMatrix: number[][] = Array(100).fill(null).map(() => Array(10).fill(0));
      
      for (let i = 0; i < results.length - 1; i++) {
        const current = parseInt(results[i].r2, 10);
        const next = parseInt(results[i - 1]?.r2 || '0', 10);
        
        // Track tens digit transition
        const currentTens = Math.floor(current / 10);
        const nextTens = Math.floor(next / 10);
        transitionMatrix[currentTens][nextTens]++;
      }

      // Predict next tens digit based on last result
      const lastTens = Math.floor(l / 10);
      const tensTransitions = transitionMatrix[lastTens];
      const maxTensProb = Math.max(...tensTransitions);
      const predictedTens = maxTensProb > 0 ? tensTransitions.indexOf(maxTensProb) : (lastTens + 2) % 10;

      // Build units transition matrix
      const transitionMatrixUnits: number[][] = Array(100).fill(null).map(() => Array(10).fill(0));
      for (let i = 0; i < results.length - 1; i++) {
        const current = parseInt(results[i].r2, 10);
        const next = parseInt(results[i - 1]?.r2 || '0', 10);
        
        const currentUnits = current % 10;
        const nextUnits = next % 10;
        transitionMatrixUnits[currentUnits][nextUnits]++;
      }

      const lastUnits = l % 10;
      const unitsTransitions = transitionMatrixUnits[lastUnits];
      const maxUnitsProb = Math.max(...unitsTransitions);
      const predictedUnits = maxUnitsProb > 0 ? unitsTransitions.indexOf(maxUnitsProb) : (lastUnits + 3) % 10;

      return (predictedTens * 10) + predictedUnits;
    }
  },
  {
    name: "Weighted Frequency (วิเคราะห์ความถี่)",
    calc: (p, l, l4, results?) => {
      // Weighted Frequency Analysis: วิเคราะห์ความถี่พร้อมให้น้ำหนักข้อมูลล่าสุด
      if (!results || results.length < 20) {
        const tens = (Math.floor(l / 10) + 5) % 10;
        const units = ((l % 10) + 8) % 10;
        return (tens * 10) + units;
      }

      const tensCount: number[] = Array(10).fill(0);
      const unitsCount: number[] = Array(10).fill(0);
      const maxHistory = Math.min(50, results.length);

      // Count frequencies with exponential recency weighting
      for (let i = 0; i < maxHistory; i++) {
        const r2 = parseInt(results[i].r2, 10);
        const tens = Math.floor(r2 / 10);
        const units = r2 % 10;
        
        // Exponential weight: newer data has more influence
        const weight = Math.exp(-i / 15); // Decay factor
        
        tensCount[tens] += weight;
        unitsCount[units] += weight;
      }

      // Find most frequent tens and units
      let maxTensIdx = 0, maxUnitsIdx = 0;
      let maxTensVal = -1, maxUnitsVal = -1;

      for (let i = 0; i < 10; i++) {
        if (tensCount[i] > maxTensVal) {
          maxTensVal = tensCount[i];
          maxTensIdx = i;
        }
        if (unitsCount[i] > maxUnitsVal) {
          maxUnitsVal = unitsCount[i];
          maxUnitsIdx = i;
        }
      }

      return (maxTensIdx * 10) + maxUnitsIdx;
    }
  },
  {
    name: "Neural Pattern (รูปแบบประสาท)",
    calc: (p, l, l4, results?) => {
      // Neural-inspired pattern: ใช้หลายปัจจัยร่วมกัน
      if (!results || results.length < 15) {
        const tens = (Math.floor(l / 10) + Math.floor(p / 10) + 6) % 10;
        const units = ((l % 10) + (p % 10) + 4) % 10;
        return (tens * 10) + units;
      }

      // Factor 1: Recent trend (last 5 draws)
      const recentTens: number[] = [];
      const recentUnits: number[] = [];
      for (let i = 0; i < Math.min(5, results.length); i++) {
        const r2 = parseInt(results[i].r2, 10);
        recentTens.push(Math.floor(r2 / 10));
        recentUnits.push(r2 % 10);
      }

      const avgTens = recentTens.reduce((a, b) => a + b, 0) / recentTens.length;
      const avgUnits = recentUnits.reduce((a, b) => a + b, 0) / recentUnits.length;

      // Factor 2: Momentum (direction of change)
      const momentumTens = Math.floor(l / 10) - Math.floor(p / 10);
      const momentumUnits = (l % 10) - (p % 10);

      // Factor 3: Cycle detection (look for repeating patterns)
      const cycleLength = 7; // Weekly cycle assumption
      let cycleTens = 0, cycleUnits = 0;
      if (results.length > cycleLength) {
        const cycleR2 = parseInt(results[Math.min(cycleLength, results.length - 1)].r2, 10);
        cycleTens = Math.floor(cycleR2 / 10);
        cycleUnits = cycleR2 % 10;
      }

      // Combine factors with different weights
      const tens = Math.round(
        (avgTens * 0.35) + 
        ((Math.floor(l / 10) + momentumTens) * 0.35) + 
        (cycleTens * 0.30)
      ) % 10;

      const units = Math.round(
        (avgUnits * 0.35) + 
        ((l % 10) + momentumUnits) * 0.35 + 
        (cycleUnits * 0.30)
      ) % 10;

      return ((tens + 10) % 10 * 10) + ((units + 10) % 10);
    }
  },
  {
    name: "4D Deep Learning (วิเคราะห์ 4 หลักเชิงลึก)",
    calc: (p, l, l4, results?) => {
      /**
       * 4D DEEP LEARNING v2 - ผสม Markov Chain + 4D Analysis
       * ใช้ข้อมูลย้อนหลัง 40-50 งวด
       * 
       * หลักการ:
       * 1. Markov Transition (40%) - ความน่าจะเป็นเปลี่ยนสถานะ
       * 2. 4D Position Pattern (30%) - วิเคราะห์ตำแหน่งใน 4 หลัก
       * 3. Recent Trend (30%) - แนวโน้ม 10 งวดล่าสุด
       */
      
      if (!results || results.length < 20) {
        const tens = (Math.floor(l / 10) + 3) % 10;
        const units = ((l % 10) + 7) % 10;
        return (tens * 10) + units;
      }

      const analysisWindow = Math.min(50, results.length);
      const recentData = results.slice(0, analysisWindow);
      const lastR4 = results[0].r4.padStart(4, '0');
      
      // ===== 1. MARKOV TRANSITION MATRIX (40%) =====
      // สร้าง matrix ความน่าจะเป็นของการเปลี่ยนสถานะ
      const tensTransition: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
      const unitsTransition: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
      
      // นับความถี่ของการเปลี่ยนสถานะ
      for (let i = 1; i < analysisWindow; i++) {
        const currentR2 = parseInt(results[i].r2, 10);
        const nextR2 = parseInt(results[i - 1].r2, 10);
        
        const currentTens = Math.floor(currentR2 / 10);
        const currentUnits = currentR2 % 10;
        const nextTens = Math.floor(nextR2 / 10);
        const nextUnits = nextR2 % 10;
        
        tensTransition[currentTens][nextTens]++;
        unitsTransition[currentUnits][nextUnits]++;
      }
      
      // คำนวณความน่าจะเป็น
      const lastTens = Math.floor(l / 10);
      const lastUnits = l % 10;
      
      const tensProbs = tensTransition[lastTens];
      const unitsProbs = unitsTransition[lastUnits];
      
      // หาค่าสูงสุด
      const maxTensProb = Math.max(...tensProbs);
      const maxUnitsProb = Math.max(...unitsProbs);
      
      const predictedTensMarkov = maxTensProb > 0 ? tensProbs.indexOf(maxTensProb) : lastTens;
      const predictedUnitsMarkov = maxUnitsProb > 0 ? unitsProbs.indexOf(maxUnitsProb) : lastUnits;
      
      // ===== 2. 4D POSITION PATTERN (30%) =====
      // วิเคราะห์ว่าหลักสิบ-หน่วย ใน 4 หลัก มี pattern อย่างไร
      const positionPattern: number[][] = [
        Array(10).fill(0),  // ตำแหน่งที่ 3 (หลักสิบ)
        Array(10).fill(0)   // ตำแหน่งที่ 4 (หลักหน่วย)
      ];
      
      recentData.forEach(r => {
        const r4 = r.r4.padStart(4, '0');
        positionPattern[0][parseInt(r4[2], 10)]++;  // หลักสิบจาก 4 หลัก
        positionPattern[1][parseInt(r4[3], 10)]++;  // หลักหน่วยจาก 4 หลัก
      });
      
      // หาคะแนนความถี่
      const lastTensFrom4D = parseInt(lastR4[2], 10);
      const lastUnitsFrom4D = parseInt(lastR4[3], 10);
      
      const maxPosTens = Math.max(...positionPattern[0]);
      const maxPosUnits = Math.max(...positionPattern[1]);
      
      const tensFreqScore = positionPattern[0][lastTensFrom4D] / maxPosTens;
      const unitsFreqScore = positionPattern[1][lastUnitsFrom4D] / maxPosUnits;
      
      // ถ้ายิ่งออกบ่อย ยิ่งมีโอกาสออกอีก
      const predictedTens4D = tensFreqScore > 0.5 ? lastTensFrom4D : positionPattern[0].indexOf(maxPosTens);
      const predictedUnits4D = unitsFreqScore > 0.5 ? lastUnitsFrom4D : positionPattern[1].indexOf(maxPosUnits);
      
      // ===== 3. RECENT TREND (30%) =====
      // ดู 10 งวดล่าสุด เพื่อจับแนวโน้มระยะสั้น
      const recent10 = results.slice(0, Math.min(10, results.length));
      const recentTensAvg = recent10.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent10.length;
      const recentUnitsAvg = recent10.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / recent10.length;
      
      const predictedTensRecent = Math.round(recentTensAvg) % 10;
      const predictedUnitsRecent = Math.round(recentUnitsAvg) % 10;
      
      // ===== COMBINE ALL PREDICTIONS =====
      // ผสมผลลัพธ์จาก 3 หลักการ
      // ให้น้ำหนัก: Markov 40%, 4D 30%, Recent 30%
      
      // วิธีผสม: นับว่าเลขไหนถูกเลือกบ่อยที่สุด
      const tensVotes: number[] = Array(10).fill(0);
      const unitsVotes: number[] = Array(10).fill(0);
      
      // Markov (น้ำหนัก 40% = 4 โหวต)
      tensVotes[predictedTensMarkov] += 4;
      unitsVotes[predictedUnitsMarkov] += 4;
      
      // 4D Pattern (น้ำหนัก 30% = 3 โหวต)
      tensVotes[predictedTens4D] += 3;
      unitsVotes[predictedUnits4D] += 3;
      
      // Recent Trend (น้ำหนัก 30% = 3 โหวต)
      tensVotes[predictedTensRecent] += 3;
      unitsVotes[predictedUnitsRecent] += 3;
      
      // เลือกเลขที่ได้โหวตสูงสุด
      const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
      const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));
      
      return (finalTens * 10) + finalUnits;
    }
  },
  {
    name: "MASTER ENSEMBLE (สูตรรวมพลัง)",
    calc: (p, l, l4, results?) => {
      /**
       * MASTER ENSEMBLE - ใช้หลักการ 5 อย่างร่วมกัน:
       * 1. Hot Numbers (30%) - เลขที่ออกบ่อยใน 30 งวดล่าสุด
       * 2. Pattern Match (25%) - หารูปแบบที่ซ้ำ
       * 3. Trend Following (20%) - ตามแนวโน้มล่าสุด
       * 4. Gap Analysis (15%) - วิเคราะห์ช่องว่างการออก
       * 5. Mirror Logic (10%) - เลขกระจกที่เกี่ยวข้อง
       */
      
      if (!results || results.length < 20) {
        // ถ้าข้อมูลไม่พอ ใช้สูตรง่าย
        const tens = (Math.floor(l / 10) + 3) % 10;
        const units = ((l % 10) + 7) % 10;
        return (tens * 10) + units;
      }

      const tensScore: number[] = Array(10).fill(0);
      const unitsScore: number[] = Array(10).fill(0);

      // 1. HOT NUMBERS (30%)
      const hotWindow = Math.min(30, results.length);
      const tensCount: number[] = Array(10).fill(0);
      const unitsCount: number[] = Array(10).fill(0);
      
      for (let i = 0; i < hotWindow; i++) {
        const r2 = parseInt(results[i].r2, 10);
        tensCount[Math.floor(r2 / 10)]++;
        unitsCount[r2 % 10]++;
      }
      
      // Normalize and score (hot numbers get higher scores)
      const maxTensCount = Math.max(...tensCount);
      const maxUnitsCount = Math.max(...unitsCount);
      for (let i = 0; i < 10; i++) {
        tensScore[i] += (tensCount[i] / maxTensCount) * 30;
        unitsScore[i] += (unitsCount[i] / maxUnitsCount) * 30;
      }

      // 2. PATTERN MATCH (25%) - หารูปแบบที่ซ้ำ
      const lastTens = Math.floor(l / 10);
      const lastUnits = l % 10;
      
      for (let i = 0; i < results.length - 1; i++) {
        const histR2 = parseInt(results[i].r2, 10);
        const histTens = Math.floor(histR2 / 10);
        const histUnits = histR2 % 10;
        
        // If historical tens matches current tens, check what came next
        if (histTens === lastTens && i > 0) {
          const nextR2 = parseInt(results[i - 1].r2, 10);
          const nextTens = Math.floor(nextR2 / 10);
          const nextUnits = nextR2 % 10;
          tensScore[nextTens] += 3;
          unitsScore[nextUnits] += 3;
        }
      }

      // 3. TREND FOLLOWING (20%) - ดู 5 งวดล่าสุด
      const recentCount = Math.min(5, results.length);
      for (let i = 0; i < recentCount; i++) {
        const r2 = parseInt(results[i].r2, 10);
        const weight = (recentCount - i) / recentCount; // More recent = higher weight
        tensScore[Math.floor(r2 / 10)] += weight * 10;
        unitsScore[r2 % 10] += weight * 10;
      }

      // 4. GAP ANALYSIS (15%) - ตัวที่หายไปนาน มีโอกาสออก
      for (let digit = 0; digit < 10; digit++) {
        let lastSeenTens = -1;
        let lastSeenUnits = -1;
        
        for (let i = 0; i < results.length; i++) {
          const r2 = parseInt(results[i].r2, 10);
          if (Math.floor(r2 / 10) === digit && lastSeenTens === -1) {
            lastSeenTens = i;
          }
          if (r2 % 10 === digit && lastSeenUnits === -1) {
            lastSeenUnits = i;
          }
          if (lastSeenTens !== -1 && lastSeenUnits !== -1) break;
        }
        
        // Longer gap = higher score (due theory)
        if (lastSeenTens > 5) tensScore[digit] += (lastSeenTens / results.length) * 15;
        if (lastSeenUnits > 5) unitsScore[digit] += (lastSeenUnits / results.length) * 15;
      }

      // 5. MIRROR LOGIC (10%)
      const mirrorTens = parseInt(MIRRORS[lastTens.toString()] || '0', 10);
      const mirrorUnits = parseInt(MIRRORS[lastUnits.toString()] || '0', 10);
      tensScore[mirrorTens] += 10;
      unitsScore[mirrorUnits] += 10;

      // Select highest scoring digits
      const predictedTens = tensScore.indexOf(Math.max(...tensScore));
      const predictedUnits = unitsScore.indexOf(Math.max(...unitsScore));

      return (predictedTens * 10) + predictedUnits;
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

    // Pass historical data (newer first for advanced patterns)
    const historicalResults = results.slice(0, i + 2);
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
    const stabilityScore = Math.max(0, Math.min(100, 
      100 - (accuracyDiff * 2) - (consecutiveDiff * 5)
    ));

    hybridResults.push({
      pattern,
      historicalStats,
      currentStats,
      isQualified,
      stabilityScore: Math.round(stabilityScore),
      isActiveMaster: false // จะเซ็ตด้านล่าง
    });
  });

  // เลือก Active Master ด้วยกฎ Hybrid
  let selectedMaster = selectHybridMaster(hybridResults, currentMasterPattern);
  
  // เซ็ต isActiveMaster
  hybridResults.forEach(h => {
    h.isActiveMaster = h.pattern.name === selectedMaster.pattern.name;
  });

  // เรียงตามคะแนนรวม (historical accuracy + stability)
  hybridResults.sort((a, b) => {
    const scoreA = a.historicalStats.directAccuracy + (a.stabilityScore / 10);
    const scoreB = b.historicalStats.directAccuracy + (b.stabilityScore / 10);
    return scoreB - scoreA;
  });

  return hybridResults;
}

/**
 * เลือก Active Master ด้วยกฎ Hybrid Approach
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

