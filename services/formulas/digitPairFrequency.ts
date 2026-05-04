import { Pattern, LottoResult } from '../../types';

/**
 * DIGIT PAIR FREQUENCY FORMULA
 * วิเคราะห์ความถี่ของคู่เลขที่ออกด้วยกัน และหารูปแบบการจับคู่
 *
 * หลักการ:
 * 1. สร้าง pair frequency matrix (tens × units)
 * 2. วิเคราะห์ conditional probability P(units|tens) และ P(tens|units)
 * 3. ใช้ bigram/trigram pattern ของ R2 ที่ออกติดกัน
 * 4. วิเคราะห์ pair transition patterns
 * 5. ใช้ Markov chain บน pair level (ไม่ใช่แค่ digit level)
 */

export const digitPairFrequencyFormula: Pattern = {
  name: "Digit Pair Frequency (คู่ความถี่)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 20) {
      const tens = (Math.floor(l / 10) + 9) % 10;
      const units = ((l % 10) + 3) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(80, results.length);
    const data = results.slice(0, N);

    // ===== 1. PAIR FREQUENCY MATRIX =====
    const pairFreq: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
    const tensFreq = Array(10).fill(0);
    const unitsFreq = Array(10).fill(0);

    for (let i = 0; i < data.length; i++) {
      const r2 = parseInt(data[i].r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      const weight = Math.pow(0.97, i); // Exponential decay

      pairFreq[tens][units] += weight;
      tensFreq[tens] += weight;
      unitsFreq[units] += weight;
    }

    // ===== 2. CONDITIONAL PROBABILITY =====
    // P(units|tens) = freq(tens,units) / freq(tens)
    const condUnitsGivenTens: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
    const condTensGivenUnits: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));

    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        condUnitsGivenTens[t][u] = tensFreq[t] > 0 ? pairFreq[t][u] / tensFreq[t] : 0;
        condTensGivenUnits[u][t] = unitsFreq[u] > 0 ? pairFreq[t][u] / unitsFreq[u] : 0;
      }
    }

    // ===== 3. PAIR TRANSITION MATRIX =====
    // จากคู่ (t1,u1) ไปคู่ (t2,u2) มีความน่าจะเป็นเท่าไร
    const pairTransition: number[][] = Array(100).fill(null).map(() => Array(100).fill(0));
    
    for (let i = 0; i < data.length - 1; i++) {
      const currentR2 = parseInt(data[i + 1].r2, 10);
      const nextR2 = parseInt(data[i].r2, 10);
      const weight = Math.pow(0.95, i);

      const fromIdx = currentR2;
      const toIdx = nextR2;
      pairTransition[fromIdx][toIdx] += weight;
    }

    // Normalize transition matrix
    for (let i = 0; i < 100; i++) {
      const rowSum = pairTransition[i].reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        for (let j = 0; j < 100; j++) {
          pairTransition[i][j] /= rowSum;
        }
      }
    }

    // ===== 4. BIGRAM/TRIGRAM PATTERN =====
    // ตรวจสอบ pattern ของ 2-3 งวดล่าสุด
    const lastR2 = parseInt(data[0].r2, 10);
    const prevR2 = parseInt(data[1]?.r2 || '0', 10);
    const prev2R2 = parseInt(data[2]?.r2 || '0', 10);

    // หาว่าหลังจากรูปแบบนี้ มักออกเลขอะไร
    const bigramMatches: number[] = [];
    const trigramMatches: number[] = [];

    for (let i = 3; i < data.length - 1; i++) {
      // Bigram match: prev -> current -> next
      if (parseInt(data[i].r2, 10) === prevR2 && parseInt(data[i - 1].r2, 10) === lastR2) {
        bigramMatches.push(parseInt(data[i - 2].r2, 10));
      }

      // Trigram match: prev2 -> prev -> current -> next
      if (i >= 4 && 
          parseInt(data[i].r2, 10) === prev2R2 && 
          parseInt(data[i - 1].r2, 10) === prevR2 && 
          parseInt(data[i - 2].r2, 10) === lastR2) {
        trigramMatches.push(parseInt(data[i - 3].r2, 10));
      }
    }

    // ===== 5. COMBINED PREDICTION =====
    const tensScore = Array(10).fill(0);
    const unitsScore = Array(10).fill(0);

    // Component 1: Pair frequency (30%)
    const maxPairFreq = Math.max(...pairFreq.flat());
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const normalizedFreq = maxPairFreq > 0 ? pairFreq[t][u] / maxPairFreq : 0;
        tensScore[t] += normalizedFreq * 0.15;
        unitsScore[u] += normalizedFreq * 0.15;
      }
    }

    // Component 2: Conditional probability (25%)
    const lastTens = Math.floor(lastR2 / 10);
    const lastUnits = lastR2 % 10;

    for (let u = 0; u < 10; u++) {
      unitsScore[u] += condUnitsGivenTens[lastTens][u] * 0.25;
    }
    for (let t = 0; t < 10; t++) {
      tensScore[t] += condTensGivenUnits[lastUnits][t] * 0.25;
    }

    // Component 3: Pair transition (25%)
    const transitionRow = pairTransition[lastR2];
    const maxTransition = Math.max(...transitionRow);
    for (let next = 0; next < 100; next++) {
      if (maxTransition > 0) {
        const prob = transitionRow[next] / maxTransition;
        const nextTens = Math.floor(next / 10);
        const nextUnits = next % 10;
        tensScore[nextTens] += prob * 0.125;
        unitsScore[nextUnits] += prob * 0.125;
      }
    }

    // Component 4: Bigram/Trigram matches (20%)
    const matchCounts = Array(100).fill(0);
    for (const match of [...bigramMatches, ...trigramMatches]) {
      matchCounts[match]++;
    }
    const maxMatch = Math.max(...matchCounts, 1);
    for (let num = 0; num < 100; num++) {
      if (matchCounts[num] > 0) {
        const t = Math.floor(num / 10);
        const u = num % 10;
        const weight = matchCounts[num] / maxMatch;
        tensScore[t] += weight * 0.1;
        unitsScore[u] += weight * 0.1;
      }
    }

    // ===== 6. SELECT BEST PAIR =====
    let bestTens = 0;
    let bestUnits = 0;
    let bestScore = -1;

    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        // Joint score = tensScore + unitsScore + pairBonus
        let score = tensScore[t] + unitsScore[u];

        // Bonus ถ้าคู่นี้มี pair frequency สูง
        const pairBonus = pairFreq[t][u] / (maxPairFreq || 1);
        score += pairBonus * 0.1;

        // Penalty สำหรับเลขที่เพิ่งออก
        if (t * 10 + u === lastR2) {
          score *= 0.9;
        }

        if (score > bestScore) {
          bestScore = score;
          bestTens = t;
          bestUnits = u;
        }
      }
    }

    return (bestTens * 10) + bestUnits;
  }
};
