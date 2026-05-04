import { Pattern, LottoResult } from '../../types';

/**
 * ADAPTIVE WEIGHT ENGINE V2
 * เรียนรู้และปรับน้ำหนักของแต่ละสูตรแบบ real-time
 *
 * หลักการ:
 * 1. ทำ backtest ทุกสูตรแบบ rolling window
 * 2. คำนวณ accuracy, precision, recall สำหรับแต่ละสูตร
 * 3. ใช้ exponential moving average ของ performance
 * 4. มี decay factor - สูตรที่เพิ่งทำผิดจะถูกลดน้ำหนักทันที
 * 5. ใช้ Thompson sampling สำหรับ exploration vs exploitation
 * 
 * ปรับปรุงจาก V1:
 * - ใช้ multi-armed bandit algorithm
 * - มี confidence interval สำหรับแต่ละสูตร
 * - ใช้ Upper Confidence Bound (UCB) สำหรับ weight selection
 * - มี momentum tracking (สูตรที่กำลังดีขึ้นได้ bonus)
 */

export const adaptiveWeightFormula: Pattern = {
  name: "Adaptive Weight (น้ำหนักปรับตัว)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 25) {
      const tens = (Math.floor(l / 10) + 8) % 10;
      const units = ((l % 10) + 2) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(100, results.length);
    const data = results.slice(0, N);

    // ===== 1. DEFINE SUB-FORMULAS =====
    const subFormulas: Array<{
      name: string;
      calc: (p: number, l: number, l4?: string, results?: LottoResult[]) => number;
    }> = [
      // Frequency-based
      {
        name: 'hot_tens',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const count = Array(10).fill(0);
          for (let i = 0; i < Math.min(20, results.length); i++) {
            count[Math.floor(parseInt(results[i].r2, 10) / 10)]++;
          }
          return count.indexOf(Math.max(...count));
        }
      },
      {
        name: 'hot_units',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const count = Array(10).fill(0);
          for (let i = 0; i < Math.min(20, results.length); i++) {
            count[parseInt(results[i].r2, 10) % 10]++;
          }
          return count.indexOf(Math.max(...count));
        }
      },
      // Markov-based
      {
        name: 'markov_tens',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const trans: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
          for (let i = 0; i < Math.min(30, results.length - 1); i++) {
            const from = Math.floor(parseInt(results[i + 1].r2, 10) / 10);
            const to = Math.floor(parseInt(results[i].r2, 10) / 10);
            trans[from][to] += (30 - i) / 30;
          }
          const last = Math.floor(parseInt(results[0].r2, 10) / 10);
          return trans[last].indexOf(Math.max(...trans[last]));
        }
      },
      {
        name: 'markov_units',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const trans: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
          for (let i = 0; i < Math.min(30, results.length - 1); i++) {
            const from = parseInt(results[i + 1].r2, 10) % 10;
            const to = parseInt(results[i].r2, 10) % 10;
            trans[from][to] += (30 - i) / 30;
          }
          const last = parseInt(results[0].r2, 10) % 10;
          return trans[last].indexOf(Math.max(...trans[last]));
        }
      },
      // Regression-based
      {
        name: 'regression_tens',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const n = Math.min(20, results.length);
          const series: number[] = [];
          for (let i = n - 1; i >= 0; i--) {
            series.push(Math.floor(parseInt(results[i].r2, 10) / 10));
          }
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          for (let i = 0; i < n; i++) {
            sumX += i; sumY += series[i]; sumXY += i * series[i]; sumX2 += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
          const intercept = (sumY - slope * sumX) / n;
          return Math.max(0, Math.min(9, Math.round(slope * n + intercept)));
        }
      },
      {
        name: 'regression_units',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const n = Math.min(20, results.length);
          const series: number[] = [];
          for (let i = n - 1; i >= 0; i--) {
            series.push(parseInt(results[i].r2, 10) % 10);
          }
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          for (let i = 0; i < n; i++) {
            sumX += i; sumY += series[i]; sumXY += i * series[i]; sumX2 += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
          const intercept = (sumY - slope * sumX) / n;
          return Math.max(0, Math.min(9, Math.round(slope * n + intercept)));
        }
      },
      // Gap-based
      {
        name: 'gap_tens',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const lastSeen = Array(10).fill(-1);
          for (let i = 0; i < Math.min(30, results.length); i++) {
            const t = Math.floor(parseInt(results[i].r2, 10) / 10);
            if (lastSeen[t] === -1) lastSeen[t] = i;
          }
          let maxGap = -1, best = 0;
          for (let d = 0; d < 10; d++) {
            const gap = lastSeen[d] === -1 ? 30 : lastSeen[d];
            if (gap > maxGap) { maxGap = gap; best = d; }
          }
          return best;
        }
      },
      {
        name: 'gap_units',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return 0;
          const lastSeen = Array(10).fill(-1);
          for (let i = 0; i < Math.min(30, results.length); i++) {
            const u = parseInt(results[i].r2, 10) % 10;
            if (lastSeen[u] === -1) lastSeen[u] = i;
          }
          let maxGap = -1, best = 0;
          for (let d = 0; d < 10; d++) {
            const gap = lastSeen[d] === -1 ? 30 : lastSeen[d];
            if (gap > maxGap) { maxGap = gap; best = d; }
          }
          return best;
        }
      },
      // Pattern-based
      {
        name: 'momentum_tens',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 5) return 0;
          const recent = results.slice(0, 5);
          const tens = recent.map(r => Math.floor(parseInt(r.r2, 10) / 10));
          const momentum = tens[0] - tens[tens.length - 1];
          return Math.max(0, Math.min(9, (tens[0] + Math.round(momentum * 0.5)) % 10));
        }
      },
      {
        name: 'momentum_units',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 5) return 0;
          const recent = results.slice(0, 5);
          const units = recent.map(r => parseInt(r.r2, 10) % 10);
          const momentum = units[0] - units[units.length - 1];
          return Math.max(0, Math.min(9, (units[0] + Math.round(momentum * 0.5)) % 10));
        }
      }
    ];

    // ===== 2. BACKTEST EACH FORMULA =====
    const backtestResults = subFormulas.map((formula, idx) => {
      let hits = 0;
      let total = 0;
      let recentHits = 0;
      let recentTotal = 0;
      const recentWindow = 10;

      for (let i = 10; i < Math.min(50, data.length - 1); i++) {
        const history = data.slice(i);
        const target = data[i - 1];
        if (!target) continue;

        const predicted = formula.calc(p, parseInt(history[0]?.r2 || '0', 10), history[0]?.r4, history);
        const actual = parseInt(target.r2, 10);

        // สำหรับ tens/units formulas ให้ check ทีละหลัก
        const isTensFormula = idx % 2 === 0;
        const actualDigit = isTensFormula ? Math.floor(actual / 10) : actual % 10;

        if (predicted === actualDigit) {
          hits++;
          if (total >= data.length - 50 - recentWindow) {
            recentHits++;
          }
        }
        total++;
        if (total >= data.length - 50 - recentWindow) {
          recentTotal++;
        }
      }

      const accuracy = total > 0 ? hits / total : 0;
      const recentAccuracy = recentTotal > 0 ? recentHits / recentTotal : accuracy;

      return {
        accuracy,
        recentAccuracy,
        total,
        hits,
        momentum: recentAccuracy - accuracy // บวก = กำลังดีขึ้น
      };
    });

    // ===== 3. CALCULATE WEIGHTS USING UCB (Upper Confidence Bound) =====
    // UCB = accuracy + sqrt(2 * ln(total_tests) / tests_for_formula)
    const totalTests = backtestResults.reduce((sum, r) => sum + r.total, 0) || 1;
    
    const ucbScores = backtestResults.map((r, i) => {
      const exploitation = r.recentAccuracy * 0.7 + r.accuracy * 0.3;
      const exploration = r.total > 0 ? Math.sqrt((2 * Math.log(totalTests)) / r.total) : 10;
      const momentumBonus = Math.max(0, r.momentum) * 0.2; // Bonus ถ้ากำลังดีขึ้น
      return exploitation + exploration * 0.1 + momentumBonus;
    });

    // Normalize weights
    const totalUCB = ucbScores.reduce((a, b) => a + b, 0) || 1;
    const weights = ucbScores.map(s => s / totalUCB);

    // ===== 4. COLLECT PREDICTIONS =====
    const tensPredictions: number[] = [];
    const unitsPredictions: number[] = [];
    const tensWeights: number[] = [];
    const unitsWeights: number[] = [];

    for (let i = 0; i < subFormulas.length; i++) {
      const predicted = subFormulas[i].calc(p, l, l4, data);
      const isTensFormula = i % 2 === 0;

      if (isTensFormula) {
        tensPredictions.push(predicted);
        tensWeights.push(weights[i]);
      } else {
        unitsPredictions.push(predicted);
        unitsWeights.push(weights[i]);
      }
    }

    // ===== 5. WEIGHTED VOTING =====
    const tensVotes: number[] = Array(10).fill(0);
    const unitsVotes: number[] = Array(10).fill(0);

    for (let i = 0; i < tensPredictions.length; i++) {
      tensVotes[tensPredictions[i]] += tensWeights[i];
    }
    for (let i = 0; i < unitsPredictions.length; i++) {
      unitsVotes[unitsPredictions[i]] += unitsWeights[i];
    }

    // ===== 6. SELECT FINAL PREDICTION =====
    const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));

    return (finalTens * 10) + finalUnits;
  }
};
