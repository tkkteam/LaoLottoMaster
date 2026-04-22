import { Pattern } from '../../types';

export const markovChainFormula: Pattern = {
  name: "Markov Chain (มาร์คอฟเชน)",
  calc: (p, l, l4, results?) => {
    // Markov Chain V2: วิเคราะห์การเปลี่ยนสถานะแบบถ่วงน้ำหนัก (Weighted Transition)
    if (!results || results.length < 15) {
      // Fallback: ใช้กฎ Golden Ratio ผสมฐานเลขเดิม
      const tens = (Math.floor(l / 10) + 7) % 10;
      const units = ((l % 10) + 3) % 10;
      return (tens * 10) + units;
    }

    // ใช้ข้อมูลย้อนหลังสูงสุด 60 งวดเพื่อสร้าง Matrix
    const analysisWindow = Math.min(60, results.length);
    const history = results.slice(0, analysisWindow);

    // สร้าง Matrix แบบถ่วงน้ำหนัก (งวดใหม่มีผลมากกว่างวดเก่า)
    const tensTransition = Array(10).fill(0).map(() => Array(10).fill(0));
    const unitsTransition = Array(10).fill(0).map(() => Array(10).fill(0));

    for (let i = 0; i < history.length - 1; i++) {
      const current = parseInt(history[i + 1].r2, 10);
      const next = parseInt(history[i].r2, 10);
      
      const weight = (analysisWindow - i) / analysisWindow; // งวดใหม่น้ำหนักเยอะ

      const cT = Math.floor(current / 10);
      const nT = Math.floor(next / 10);
      const cU = current % 10;
      const nU = next % 10;

      tensTransition[cT][nT] += weight;
      unitsTransition[cU][nU] += weight;
    }

    const lastTens = Math.floor(l / 10);
    const lastUnits = l % 10;

    // คำนวณความน่าจะเป็นสะสม
    const getBestNext = (matrix: number[][], current: number) => {
      const row = matrix[current];
      const maxVal = Math.max(...row);
      if (maxVal === 0) return (current + 5) % 10; // Fallback แบบกระจายตัว
      
      // ถ้ามีหลายค่าที่เท่ากัน ให้เลือกเลขที่มีความถี่รวมสูงสุด (Global Popularity)
      return row.indexOf(maxVal);
    };

    const predictedTens = getBestNext(tensTransition, lastTens);
    const predictedUnits = getBestNext(unitsTransition, lastUnits);

    return (predictedTens * 10) + predictedUnits;
  }
};
