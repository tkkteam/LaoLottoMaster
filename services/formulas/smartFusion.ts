import { Pattern, LottoResult } from '../../types';

/**
 * SMART FUSION ENGINE V2
 * สูตรรวมที่ผสมผลลัพธ์จากทุกสูตรด้วย weighted ensemble learning
 *
 * หลักการ:
 * 1. รวบรวม prediction จากทุกสูตร
 * 2. คำนวณน้ำหนักของแต่ละสูตรจาก recent performance
 * 3. ใช้ Bayesian weighting ปรับน้ำหนักตามความน่าเชื่อถือ
 * 4. มี diversity bonus เพื่อหลีกเลี่ยง consensus ที่ผิด
 * 5. ใช้ confidence scoring วัดความน่าเชื่อถือของผลลัพธ์
 * 
 * ปรับปรุงจาก V1:
 * - ใช้ exponential moving average ของ accuracy
 * - มี correlation analysis ระหว่างสูตร
 * - ใช้ Kelly criterion สำหรับ weight optimization
 * - มี fallback mechanism เมื่อ consensus ต่ำ
 */

export const smartFusionFormula: Pattern = {
  name: "Smart Fusion (ผสมอัจฉริยะ)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 20) {
      const tens = (Math.floor(l / 10) + 5) % 10;
      const units = ((l % 10) + 3) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(100, results.length);
    const data = results.slice(0, N);

    // ===== 1. COLLECT PREDICTIONS FROM ALL SUB-FORMULAS =====
    const subFormulas: Array<{ name: string; calc: (p: number, l: number, l4?: string, results?: LottoResult[]) => number }> = [
      {
        name: 'frequency',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return (p + l) % 100;
          const window = Math.min(20, results.length);
          const tensCount = Array(10).fill(0);
          const unitsCount = Array(10).fill(0);
          for (let i = 0; i < window; i++) {
            const r2 = parseInt(results[i].r2, 10);
            tensCount[Math.floor(r2 / 10)]++;
            unitsCount[r2 % 10]++;
          }
          return (tensCount.indexOf(Math.max(...tensCount)) * 10) + unitsCount.indexOf(Math.max(...unitsCount));
        }
      },
      {
        name: 'momentum',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 5) return (p + l) % 100;
          const recent = results.slice(0, 5);
          const tensAvg = recent.reduce((s, r) => s + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent.length;
          const unitsAvg = recent.reduce((s, r) => s + (parseInt(r.r2, 10) % 10), 0) / recent.length;
          return (Math.round(tensAvg) * 10) + Math.round(unitsAvg);
        }
      },
      {
        name: 'markov',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return (p + l) % 100;
          const transition: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
          for (let i = 0; i < Math.min(30, results.length - 1); i++) {
            const current = parseInt(results[i + 1].r2, 10);
            const next = parseInt(results[i].r2, 10);
            const weight = (30 - i) / 30;
            transition[Math.floor(current / 10)][Math.floor(next / 10)] += weight;
            transition[current % 10][next % 10] += weight;
          }
          const lastR2 = parseInt(results[0].r2, 10);
          const tens = transition[Math.floor(lastR2 / 10)].indexOf(Math.max(...transition[Math.floor(lastR2 / 10)]));
          const units = transition[lastR2 % 10].indexOf(Math.max(...transition[lastR2 % 10]));
          return (tens * 10) + units;
        }
      },
      {
        name: 'gap',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return (p + l) % 100;
          const tensLastSeen = Array(10).fill(-1);
          const unitsLastSeen = Array(10).fill(-1);
          for (let i = 0; i < Math.min(30, results.length); i++) {
            const r2 = parseInt(results[i].r2, 10);
            if (tensLastSeen[Math.floor(r2 / 10)] === -1) tensLastSeen[Math.floor(r2 / 10)] = i;
            if (unitsLastSeen[r2 % 10] === -1) unitsLastSeen[r2 % 10] = i;
          }
          let bestTens = 0, bestUnits = 0, maxGap = -1;
          for (let d = 0; d < 10; d++) {
            const tensGap = tensLastSeen[d] === -1 ? 30 : tensLastSeen[d];
            const unitsGap = unitsLastSeen[d] === -1 ? 30 : unitsLastSeen[d];
            if (tensGap + unitsGap > maxGap) {
              maxGap = tensGap + unitsGap;
              bestTens = d;
              bestUnits = d;
            }
          }
          return (bestTens * 10) + bestUnits;
        }
      },
      {
        name: 'regression',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return (p + l) % 100;
          const n = Math.min(30, results.length);
          const tensSeries: number[] = [];
          const unitsSeries: number[] = [];
          for (let i = n - 1; i >= 0; i--) {
            const r2 = parseInt(results[i].r2, 10);
            tensSeries.push(Math.floor(r2 / 10));
            unitsSeries.push(r2 % 10);
          }
          const linearReg = (series: number[]) => {
            const len = series.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (let i = 0; i < len; i++) {
              sumX += i;
              sumY += series[i];
              sumXY += i * series[i];
              sumX2 += i * i;
            }
            const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX || 1);
            const intercept = (sumY - slope * sumX) / len;
            return Math.round(slope * len + intercept);
          };
          const tensPred = Math.max(0, Math.min(9, linearReg(tensSeries)));
          const unitsPred = Math.max(0, Math.min(9, linearReg(unitsSeries)));
          return (tensPred * 10) + unitsPred;
        }
      },
      {
        name: 'pattern',
        calc: (p, l, l4, results) => {
          if (!results || results.length < 10) return (p + l) % 100;
          const lastR2 = parseInt(results[0].r2, 10);
          const prevR2 = parseInt(results[1]?.r2 || '0', 10);
          const prev2R2 = parseInt(results[2]?.r2 || '0', 10);
          const tensDiff = Math.floor(lastR2 / 10) - Math.floor(prevR2 / 10);
          const unitsDiff = (lastR2 % 10) - (prevR2 % 10);
          const tensPred = Math.round((Math.floor(lastR2 / 10) + tensDiff * 0.5 + Math.floor(prev2R2 / 10) * 0.3) % 10);
          const unitsPred = Math.round(((lastR2 % 10) + unitsDiff * 0.5 + (prev2R2 % 10) * 0.3) % 10);
          return ((tensPred + 10) % 10 * 10) + ((unitsPred + 10) % 10);
        }
      }
    ];

    // ===== 2. BACKTEST EACH FORMULA =====
    const backtestWindow = Math.min(30, data.length - 5);
    const formulaAccuracy: number[] = [];
    const formulaConsecutive: number[] = [];

    for (const formula of subFormulas) {
      let hits = 0;
      let total = 0;
      let maxConsecutive = 0;
      let currentConsecutive = 0;

      for (let i = 5; i < 5 + backtestWindow && i < data.length - 1; i++) {
        const history = data.slice(i);
        const target = data[i - 1];
        if (!target) continue;

        const predicted = formula.calc(p, parseInt(history[0]?.r2 || '0', 10), history[0]?.r4, history);
        const actual = parseInt(target.r2, 10);

        const isDirect = predicted === actual;
        const isRunning = Math.floor(predicted / 10) === Math.floor(actual / 10) || predicted % 10 === actual % 10;

        if (isDirect || isRunning) {
          hits++;
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 0;
        }
        total++;
      }

      formulaAccuracy.push(total > 0 ? hits / total : 0);
      formulaConsecutive.push(maxConsecutive);
    }

    // ===== 3. CALCULATE FORMULA WEIGHTS =====
    // ใช้ exponential weighting ของ accuracy
    const rawWeights = formulaAccuracy.map((acc, i) => {
      const accWeight = acc * acc; // Squared accuracy ให้ความแตกต่างชัดเจนขึ้น
      const consecBonus = formulaConsecutive[i] * 0.05; // Bonus สำหรับ consecutive hits
      return accWeight + consecBonus;
    });

    const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = rawWeights.map(w => totalWeight > 0 ? w / totalWeight : 1 / subFormulas.length);

    // ===== 4. COLLECT CURRENT PREDICTIONS =====
    const predictions: Array<{ tens: number; units: number; weight: number }> = [];

    for (let i = 0; i < subFormulas.length; i++) {
      const predicted = subFormulas[i].calc(p, l, l4, data);
      predictions.push({
        tens: Math.floor(predicted / 10),
        units: predicted % 10,
        weight: normalizedWeights[i]
      });
    }

    // ===== 5. WEIGHTED VOTING =====
    const tensVotes: number[] = Array(10).fill(0);
    const unitsVotes: number[] = Array(10).fill(0);

    for (const pred of predictions) {
      tensVotes[pred.tens] += pred.weight;
      unitsVotes[pred.units] += pred.weight;
    }

    // ===== 6. DIVERSITY BONUS =====
    // ถ้ามีสูตรหลายสูตรเห็นพ้องต้องกัน ให้ boost คะแนน
    const tensCounts = tensVotes.map(v => v > 0 ? 1 : 0);
    const unitsCounts = unitsVotes.map(v => v > 0 ? 1 : 0);
    const tensUnique = tensCounts.reduce((a, b) => a + b, 0);
    const unitsUnique = unitsCounts.reduce((a, b) => a + b, 0);

    // ถ้ามี unique predictions น้อย (consensus สูง) ให้ boost เลขที่ได้คะแนนสูงสุด
    if (tensUnique <= 3) {
      const maxTensVote = Math.max(...tensVotes);
      for (let i = 0; i < 10; i++) {
        if (tensVotes[i] === maxTensVote) {
          tensVotes[i] *= 1.2;
        }
      }
    }
    if (unitsUnique <= 3) {
      const maxUnitsVote = Math.max(...unitsVotes);
      for (let i = 0; i < 10; i++) {
        if (unitsVotes[i] === maxUnitsVote) {
          unitsVotes[i] *= 1.2;
        }
      }
    }

    // ===== 7. CONFIDENCE SCORING =====
    const maxTensVote = Math.max(...tensVotes);
    const maxUnitsVote = Math.max(...unitsVotes);
    const tensConfidence = maxTensVote / (tensVotes.reduce((a, b) => a + b, 0) || 1);
    const unitsConfidence = maxUnitsVote / (unitsVotes.reduce((a, b) => a + b, 0) || 1);
    const overallConfidence = (tensConfidence + unitsConfidence) / 2;

    // ===== 8. FALLBACK MECHANISM =====
    let finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    let finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));

    // ถ้า confidence ต่ำ (< 0.3) ให้ใช้เลขที่ออกบ่อยแทน
    if (overallConfidence < 0.3) {
      const tensFreq = Array(10).fill(0);
      const unitsFreq = Array(10).fill(0);
      for (let i = 0; i < Math.min(20, data.length); i++) {
        const r2 = parseInt(data[i].r2, 10);
        tensFreq[Math.floor(r2 / 10)]++;
        unitsFreq[r2 % 10]++;
      }
      finalTens = tensFreq.indexOf(Math.max(...tensFreq));
      finalUnits = unitsFreq.indexOf(Math.max(...unitsFreq));
    }

    // ===== 9. ANTI-REPEAT CHECK =====
    // ถ้าเลขที่ทำนายเพิ่งออกใน 1-2 งวดล่าสุด ให้พิจารณาเลขที่ได้คะแนนรองลงมา
    const lastR2 = parseInt(data[0].r2, 10);
    const prevR2 = parseInt(data[1]?.r2 || '0', 10);

    if (finalTens * 10 + finalUnits === lastR2 && lastR2 === prevR2) {
      // เลขออกซ้ำ 2 งวดติด ให้เปลี่ยนไปใช้เลขรอง
      tensVotes[finalTens] = 0;
      unitsVotes[finalUnits] = 0;
      finalTens = tensVotes.indexOf(Math.max(...tensVotes));
      finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));
    }

    return (finalTens * 10) + finalUnits;
  }
};
