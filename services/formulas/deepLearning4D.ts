import { Pattern } from '../../types';

export const deepLearning4DFormula: Pattern = {
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
    const lastResult = results[0]; // งวดล่าสุดที่มีในประวัติ (ใช้เป็นฐานทำนาย)
    const lastR4 = lastResult.r4.padStart(4, '0');

    // ===== 1. WEIGHTED MARKOV TRANSITION (40%) =====
    const tensTransition = Array(10).fill(0).map(() => Array(10).fill(0));
    const unitsTransition = Array(10).fill(0).map(() => Array(10).fill(0));

    for (let i = 0; i < recentData.length - 1; i++) {
      const weight = (recentData.length - i) / recentData.length;
      const currentR2 = parseInt(recentData[i + 1].r2, 10);
      const nextR2 = parseInt(recentData[i].r2, 10);

      tensTransition[Math.floor(currentR2 / 10)][Math.floor(nextR2 / 10)] += weight;
      unitsTransition[currentR2 % 10][nextR2 % 10] += weight;
    }

    const lTens = Math.floor(parseInt(lastResult.r2, 10) / 10);
    const lUnits = parseInt(lastResult.r2, 10) % 10;

    const getBestMarkov = (matrix: number[][], current: number) => {
      const row = matrix[current];
      const max = Math.max(...row);
      return max > 0 ? row.indexOf(max) : (current + 1) % 10;
    };

    const predictedTensMarkov = getBestMarkov(tensTransition, lTens);
    const predictedUnitsMarkov = getBestMarkov(unitsTransition, lUnits);

    // ===== 2. 4D POSITION PATTERN (30%) =====
    // วิเคราะห์ตำแหน่งใน 4 หลัก (ใช้ความถี่ถ่วงน้ำหนัก)
    const positionPattern = [Array(10).fill(0), Array(10).fill(0)];
    recentData.forEach((r, idx) => {
      const weight = (recentData.length - idx) / recentData.length;
      const r4 = r.r4.padStart(4, '0');
      positionPattern[0][parseInt(r4[2], 10)] += weight;
      positionPattern[1][parseInt(r4[3], 10)] += weight;
    });

    const predictedTens4D = positionPattern[0].indexOf(Math.max(...positionPattern[0]));
    const predictedUnits4D = positionPattern[1].indexOf(Math.max(...positionPattern[1]));

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
};
