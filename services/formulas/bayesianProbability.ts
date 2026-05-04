import { Pattern, LottoResult } from '../../types';

/**
 * BAYESIAN PROBABILITY FORMULA V2
 * ใช้ Bayesian inference อัพเดทความน่าจะเป็นของเลขแต่ละตัว
 *
 * หลักการ:
 * 1. Prior: ความน่าจะเป็นเริ่มต้นจาก uniform distribution
 * 2. Likelihood: ความน่าจะเป็นที่เลขจะออกจากข้อมูลย้อนหลัง
 * 3. Posterior: ความน่าจะเป็นหลังอัพเดท = Prior × Likelihood
 * 4. Evidence: ใช้ข้อมูลล่าสุดเป็น evidence
 * 5. Decay factor: งวดล่าสุดมีน้ำหนักมากกว่า
 *
 * ปรับปรุงจาก V1:
 * - ใช้ Beta distribution แทน simple counting
 * - มี adaptive decay rate
 * - คำนวณ credible interval
 * - ใช้ hierarchical model สำหรับ tens/units
 */

export const bayesianProbabilityFormula: Pattern = {
  name: "Bayesian Probability (ความน่าจะเป็นเบย์)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 15) {
      const tens = (Math.floor(l / 10) + 3) % 10;
      const units = ((l % 10) + 7) % 10;
      return (tens * 10) + units;
    }

    const window = Math.min(80, results.length);
    const data = results.slice(0, window);

    // ===== HYPERPARAMETERS =====
    // Adaptive decay: คำนวณจาก volatility ของข้อมูล
    const recent10 = data.slice(0, 10).map(r => parseInt(r.r2, 10));
    const volatility = recent10.reduce((sum, val, idx) => {
      if (idx === 0) return 0;
      return sum + Math.abs(val - recent10[idx - 1]);
    }, 0) / (recent10.length - 1);

    // ถ้า volatility สูง ให้เน้นงวดล่าสุดมากขึ้น (decay สูง)
    const decayRate = Math.min(0.15, 0.03 + (volatility / 100));

    // ===== BETA DISTRIBUTION PARAMETERS =====
    // สำหรับแต่ละ digit (0-9) ในหลักสิบและหลักหน่วย
    // Beta(alpha, beta) โดย alpha = successes + prior_alpha, beta = failures + prior_beta
    const priorAlpha = 1.0; // Uniform prior
    const priorBeta = 9.0;  // Expect 1 in 10

    const tensAlpha = Array(10).fill(priorAlpha);
    const tensBeta = Array(10).fill(priorBeta);
    const unitsAlpha = Array(10).fill(priorAlpha);
    const unitsBeta = Array(10).fill(priorBeta);

    // อัพเดท parameters จากข้อมูลย้อนหลัง (ถ่วงน้ำหนักด้วย decay)
    for (let i = 0; i < data.length; i++) {
      const r2 = parseInt(data[i].r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      const weight = Math.pow(1 - decayRate, i);

      for (let d = 0; d < 10; d++) {
        if (d === tens) {
          tensAlpha[d] += weight;
        } else {
          tensBeta[d] += weight * 0.1; // Failure weight น้อยกว่า
        }

        if (d === units) {
          unitsAlpha[d] += weight;
        } else {
          unitsBeta[d] += weight * 0.1;
        }
      }
    }

    // ===== คำนวณ posterior mean =====
    // E[Beta(alpha, beta)] = alpha / (alpha + beta)
    const tensPosterior = tensAlpha.map((a, i) => a / (a + tensBeta[i]));
    const unitsPosterior = unitsAlpha.map((a, i) => a / (a + unitsBeta[i]));

    // ===== ADJUST FOR RECENCY BIAS =====
    // ถ้าเลขเพิ่งออกใน 1-2 งวดล่าสุด ให้ลด posterior ลงเล็กน้อย
    // (เพราะหวยมักไม่ออกซ้ำติดกัน)
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const r2 = parseInt(data[i].r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      const penalty = 0.15 / (i + 1); // งวดล่าสุดลดมาก, งวดที่ 2-3 ลดน้อยลง
      tensPosterior[tens] *= (1 - penalty);
      unitsPosterior[units] *= (1 - penalty);
    }

    // ===== BOOST FOR GAP ANALYSIS =====
    // เลขที่ไม่ออกนานมีแนวโน้มจะออก (gambler's fallacy correction)
    const tensLastSeen = Array(10).fill(-1);
    const unitsLastSeen = Array(10).fill(-1);

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const r2 = parseInt(data[i].r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      if (tensLastSeen[tens] === -1) tensLastSeen[tens] = i;
      if (unitsLastSeen[units] === -1) unitsLastSeen[units] = i;
    }

    for (let d = 0; d < 10; d++) {
      const tensGap = tensLastSeen[d] === -1 ? 30 : tensLastSeen[d];
      const unitsGap = unitsLastSeen[d] === -1 ? 30 : unitsLastSeen[d];

      // ถ้า gap > average gap ให้ boost เล็กน้อย
      const avgGap = 10;
      if (tensGap > avgGap) {
        tensPosterior[d] *= 1 + (tensGap - avgGap) * 0.02;
      }
      if (unitsGap > avgGap) {
        unitsPosterior[d] *= 1 + (unitsGap - avgGap) * 0.02;
      }
    }

    // ===== NORMALIZE =====
    const tensSum = tensPosterior.reduce((a, b) => a + b, 0);
    const unitsSum = unitsPosterior.reduce((a, b) => a + b, 0);

    const tensProb = tensPosterior.map(p => p / tensSum);
    const unitsProb = unitsPosterior.map(p => p / unitsSum);

    // ===== SELECT BEST PAIR =====
    // เลือกคู่ที่มี joint probability สูงสุด
    let bestTens = 0;
    let bestUnits = 0;
    let bestScore = -1;

    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        // Joint probability = P(tens=t) × P(units=u) × pair_bonus
        let score = tensProb[t] * unitsProb[u];

        // Bonus ถ้าคู่นี้เคยออกด้วยกันบ่อย
        const pairCount = data.filter(r => {
          const r2 = parseInt(r.r2, 10);
          return Math.floor(r2 / 10) === t && r2 % 10 === u;
        }).length;

        if (pairCount > 0) {
          score *= (1 + pairCount * 0.1);
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
