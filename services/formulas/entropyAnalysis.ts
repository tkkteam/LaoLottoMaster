import { Pattern, LottoResult } from '../../types';

/**
 * ENTROPY ANALYSIS FORMULA
 * ใช้ Shannon Entropy วัดความไม่แน่นอนและหารูปแบบที่ซ่อนอยู่
 *
 * หลักการ:
 * 1. คำนวณ entropy ของการกระจายตัวเลขแต่ละหลัก
 * 2. วิเคราะห์ conditional entropy (หลักนี้ตามด้วยหลักไหน)
 * 3. ใช้ mutual information หาความสัมพันธ์ระหว่างตำแหน่ง
 * 4. วิเคราะห์ entropy trend ว่ากำลังเพิ่มหรือลด
 * 5. ใช้ entropy minimization เลือกเลขที่น่าจะออก
 */

export const entropyAnalysisFormula: Pattern = {
  name: "Entropy Analysis (เอนโทรปี)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 20) {
      const tens = (Math.floor(l / 10) + 5) % 10;
      const units = ((l % 10) + 2) % 10;
      return (tens * 10) + units;
    }

    const window = Math.min(60, results.length);
    const data = results.slice(0, window);

    // ===== 1. SHANNON ENTROPY ของหลักสิบและหลักหน่วย =====
    const tensCount = Array(10).fill(0);
    const unitsCount = Array(10).fill(0);

    data.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      tensCount[Math.floor(r2 / 10)]++;
      unitsCount[r2 % 10]++;
    });

    const calcEntropy = (counts: number[]): number => {
      const total = counts.reduce((a, b) => a + b, 0);
      if (total === 0) return 0;
      
      let entropy = 0;
      for (const count of counts) {
        if (count > 0) {
          const prob = count / total;
          entropy -= prob * Math.log2(prob);
        }
      }
      return entropy;
    };

    const tensEntropy = calcEntropy(tensCount);
    const unitsEntropy = calcEntropy(unitsCount);
    const maxEntropy = Math.log2(10); // ~3.32 สำหรับ 10 digits

    // ===== 2. CONDITIONAL ENTROPY =====
    // H(Y|X) = entropy ของหลักหน่วย เมื่อกำหนดหลักสิบ
    const conditionalCounts: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
    const tensTotalForConditional = Array(10).fill(0);

    data.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      conditionalCounts[tens][units]++;
      tensTotalForConditional[tens]++;
    });

    let conditionalEntropy = 0;
    for (let t = 0; t < 10; t++) {
      if (tensTotalForConditional[t] > 0) {
        const probT = tensTotalForConditional[t] / data.length;
        let hGivenT = 0;
        for (let u = 0; u < 10; u++) {
          if (conditionalCounts[t][u] > 0) {
            const probUgivenT = conditionalCounts[t][u] / tensTotalForConditional[t];
            hGivenT -= probUgivenT * Math.log2(probUgivenT);
          }
        }
        conditionalEntropy += probT * hGivenT;
      }
    }

    // ===== 3. MUTUAL INFORMATION =====
    // I(X;Y) = H(Y) - H(Y|X)
    const mutualInfo = unitsEntropy - conditionalEntropy;

    // ===== 4. ENTROPY TREND =====
    // เปรียบเทียบ entropy ของ 20 งวดล่าสุด vs 20 งวดก่อนหน้า
    const recent20 = data.slice(0, 20);
    const prev20 = data.slice(20, 40);

    const calcDistribution = (slice: LottoResult[]): [number[], number[]] => {
      const t = Array(10).fill(0);
      const u = Array(10).fill(0);
      slice.forEach(r => {
        const r2 = parseInt(r.r2, 10);
        t[Math.floor(r2 / 10)]++;
        u[r2 % 10]++;
      });
      return [t, u];
    };

    const [recentTens, recentUnits] = calcDistribution(recent20);
    const [prevTens, prevUnits] = calcDistribution(prev20.length > 0 ? prev20 : data.slice(0, 20));

    const recentTensEntropy = calcEntropy(recentTens);
    const prevTensEntropy = calcEntropy(prevTens);
    const entropyTrend = recentTensEntropy - prevTensEntropy;

    // ===== 5. PREDICTION USING ENTROPY MINIMIZATION =====
    // เลือกเลขที่ลด entropy รวมมากที่สุด (ทำให้ distribution มีแนวโน้มชัดเจนขึ้น)

    // คำนวณ probability distribution สำหรับแต่ละ digit
    const tensProb = tensCount.map(c => c / data.length);
    const unitsProb = unitsCount.map(c => c / data.length);

    // ===== ADJUSTMENT FACTORS =====
    
    // Factor 1: ถ้า entropy สูง (สุ่มมาก) ให้ใช้เลขที่ออกบ่อย
    // ถ้า entropy ต่ำ (มี pattern) ให้ใช้ conditional probability
    const entropyRatio = tensEntropy / maxEntropy;

    const tensScore = Array(10).fill(0);
    const unitsScore = Array(10).fill(0);

    for (let d = 0; d < 10; d++) {
      // Base score จาก frequency
      tensScore[d] = tensProb[d];
      unitsScore[d] = unitsProb[d];

      // Adjust ด้วย conditional probability
      if (entropyRatio < 0.7) {
        // ถ้ามี pattern (entropy ต่ำ) ให้ใช้ conditional
        const lastTens = Math.floor(parseInt(data[0].r2, 10) / 10);
        const condProb = conditionalCounts[lastTens][d] / (tensTotalForConditional[lastTens] || 1);
        unitsScore[d] = unitsScore[d] * 0.5 + condProb * 0.5;
      }

      // Adjust ด้วย mutual information
      if (mutualInfo > 0.5) {
        // ถ้ามีความสัมพันธ์ระหว่างหลัก ให้ boost คู่ที่ออกด้วยกันบ่อย
        const lastUnits = parseInt(data[0].r2, 10) % 10;
        const pairCount = conditionalCounts[d][lastUnits];
        if (pairCount > 0) {
          tensScore[d] *= (1 + pairCount * 0.05);
        }
      }

      // Adjust ด้วย entropy trend
      if (entropyTrend < 0) {
        // Entropy กำลังลด = pattern กำลังชัดเจน
        // ให้ boost เลขที่ออกใน 5 งวดล่าสุด
        for (let i = 0; i < Math.min(5, data.length); i++) {
          const r2 = parseInt(data[i].r2, 10);
          if (Math.floor(r2 / 10) === d) {
            tensScore[d] *= (1 + 0.1 / (i + 1));
          }
          if (r2 % 10 === d) {
            unitsScore[d] *= (1 + 0.1 / (i + 1));
          }
        }
      }
    }

    // ===== NORMALIZE =====
    const tensSum = tensScore.reduce((a, b) => a + b, 0);
    const unitsSum = unitsScore.reduce((a, b) => a + b, 0);

    const tensNorm = tensScore.map(s => s / (tensSum || 1));
    const unitsNorm = unitsScore.map(s => s / (unitsSum || 1));

    // ===== SELECT BEST PAIR =====
    let bestTens = 0;
    let bestUnits = 0;
    let bestScore = -1;

    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        let score = tensNorm[t] * 0.5 + unitsNorm[u] * 0.5;

        // Bonus สำหรับคู่ที่ออกด้วยกันบ่อย
        const pairFreq = conditionalCounts[t][u] / (tensTotalForConditional[t] || 1);
        score += pairFreq * 0.2;

        // Penalty สำหรับเลขที่เพิ่งออก
        const lastR2 = parseInt(data[0].r2, 10);
        if (t * 10 + u === lastR2) {
          score *= 0.85;
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
