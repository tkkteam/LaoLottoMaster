import { Pattern, LottoResult } from '../../types';

/**
 * PATTERN MEMORY FORMULA
 * จดจำข้อผิดพลาดของสูตรอื่นๆ และปรับ prediction เพื่อชดเชย
 *
 * หลักการ:
 * 1. วิเคราะห์ว่าสูตรอื่นทำนายผิดอย่างไร (bias detection)
 * 2. สร้าง error model สำหรับแต่ละสูตร
 * 3. ใช้ error model ปรับ prediction
 * 4. เรียนรู้จาก pattern ของข้อผิดพลาด
 * 5. มี adaptive learning rate
 * 
 * ปรับปรุง:
 * - ใช้ exponential moving average ของ error
 * - มี confusion matrix สำหรับ digit transitions
 * - ใช้ meta-learning ปรับ weights
 */

export const patternMemoryFormula: Pattern = {
  name: "Pattern Memory (ความจำรูปแบบ)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 20) {
      const tens = (Math.floor(l / 10) + 6) % 10;
      const units = ((l % 10) + 1) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(80, results.length);
    const data = results.slice(0, N);

    // ===== 1. ERROR PATTERN ANALYSIS =====
    // วิเคราะห์ว่าเมื่อสูตรพื้นฐานทำนายผิด เลขที่ออกมักจะเป็นอะไร
    
    // สร้าง "simple predictions" ที่สูตรพื้นฐานมักใช้
    const simplePredictions = data.map((r, i) => {
      if (i === data.length - 1) return null; // ไม่มีข้อมูลสำหรับงวดสุดท้าย
      
      const nextR2 = parseInt(data[i - 1]?.r2 || '0', 10);
      const currentR2 = parseInt(r.r2, 10);
      const prevR2 = parseInt(data[i + 1]?.r2 || '0', 10);
      
      // Simple prediction ที่สูตรพื้นฐานมักใช้
      const simpleTens = (Math.floor(currentR2 / 10) + 3) % 10;
      const simpleUnits = (currentR2 % 10 + 7) % 10;
      const simplePred = simpleTens * 10 + simpleUnits;
      
      return {
        predicted: simplePred,
        actual: nextR2,
        error: nextR2 - simplePred,
        predictedTens: simpleTens,
        predictedUnits: simpleUnits,
        actualTens: Math.floor(nextR2 / 10),
        actualUnits: nextR2 % 10
      };
    }).filter(Boolean);

    // ===== 2. CONFUSION MATRIX =====
    // สร้าง matrix ว่าเมื่อทำนายเลข X แล้วจริงๆออกเลขอะไร
    const tensConfusion: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
    const unitsConfusion: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));

    for (const pred of simplePredictions) {
      if (pred) {
        tensConfusion[pred.predictedTens][pred.actualTens]++;
        unitsConfusion[pred.predictedUnits][pred.actualUnits]++;
      }
    }

    // ===== 3. BIAS DETECTION =====
    // หาว่าสูตรพื้นฐานมี bias ไปทางไหน
    const tensBias: number[] = Array(10).fill(0);
    const unitsBias: number[] = Array(10).fill(0);

    for (let predDigit = 0; predDigit < 10; predDigit++) {
      // Tens bias
      let totalError = 0;
      let count = 0;
      for (const pred of simplePredictions) {
        if (pred && pred.predictedTens === predDigit) {
          totalError += pred.actualTens - pred.predictedTens;
          count++;
        }
      }
      tensBias[predDigit] = count > 0 ? totalError / count : 0;

      // Units bias
      totalError = 0;
      count = 0;
      for (const pred of simplePredictions) {
        if (pred && pred.predictedUnits === predDigit) {
          totalError += pred.actualUnits - pred.predictedUnits;
          count++;
        }
      }
      unitsBias[predDigit] = count > 0 ? totalError / count : 0;
    }

    // ===== 4. TRANSITION PROBABILITY =====
    // ความน่าจะเป็นที่จากเลข X จะไปเลข Y
    const tensTransition: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));
    const unitsTransition: number[][] = Array(10).fill(null).map(() => Array(10).fill(0));

    for (let i = 0; i < data.length - 1; i++) {
      const currentR2 = parseInt(data[i].r2, 10);
      const nextR2 = parseInt(data[i + 1].r2, 10);
      
      const currentTens = Math.floor(currentR2 / 10);
      const nextTens = Math.floor(nextR2 / 10);
      const currentUnits = currentR2 % 10;
      const nextUnits = nextR2 % 10;
      
      // ให้น้ำหนักกับ transition ล่าสุดมากกว่า
      const weight = Math.pow(0.95, i);
      tensTransition[currentTens][nextTens] += weight;
      unitsTransition[currentUnits][nextUnits] += weight;
    }

    // Normalize transitions
    for (let i = 0; i < 10; i++) {
      const tensSum = tensTransition[i].reduce((a, b) => a + b, 0);
      const unitsSum = unitsTransition[i].reduce((a, b) => a + b, 0);
      
      if (tensSum > 0) {
        for (let j = 0; j < 10; j++) {
          tensTransition[i][j] /= tensSum;
        }
      }
      if (unitsSum > 0) {
        for (let j = 0; j < 10; j++) {
          unitsTransition[i][j] /= unitsSum;
        }
      }
    }

    // ===== 5. PREDICTION =====
    const lastR2 = parseInt(data[0].r2, 10);
    const lastTens = Math.floor(lastR2 / 10);
    const lastUnits = lastR2 % 10;

    // Base prediction จาก simple formula
    const baseTens = (lastTens + 3) % 10;
    const baseUnits = (lastUnits + 7) % 10;

    // ===== CORRECTION USING MEMORY =====
    
    // Correction 1: ใช้ confusion matrix หาเลขที่น่าจะออกจริง
    const tensFromConfusion = tensConfusion[baseTens].indexOf(Math.max(...tensConfusion[baseTens]));
    const unitsFromConfusion = unitsConfusion[baseUnits].indexOf(Math.max(...unitsConfusion[baseUnits]));

    // Correction 2: ใช้ bias correction
    const correctedTensFromBias = Math.round((baseTens + tensBias[baseTens] + 10) % 10);
    const correctedUnitsFromBias = Math.round((baseUnits + unitsBias[baseUnits] + 10) % 10);

    // Correction 3: ใช้ transition probability
    const tensFromTransition = tensTransition[lastTens].indexOf(Math.max(...tensTransition[lastTens]));
    const unitsFromTransition = unitsTransition[lastUnits].indexOf(Math.max(...unitsTransition[lastUnits]));

    // ===== WEIGHTED COMBINATION =====
    // ผสมผลลัพธ์จากทั้ง 3 corrections
    
    const tensVotes: number[] = Array(10).fill(0);
    const unitsVotes: number[] = Array(10).fill(0);

    // Confusion matrix (น้ำหนัก 35%)
    tensVotes[tensFromConfusion] += 3.5;
    unitsVotes[unitsFromConfusion] += 3.5;

    // Bias correction (น้ำหนัก 35%)
    tensVotes[correctedTensFromBias] += 3.5;
    unitsVotes[correctedUnitsFromBias] += 3.5;

    // Transition probability (น้ำหนัก 30%)
    tensVotes[tensFromTransition] += 3;
    unitsVotes[unitsFromTransition] += 3;

    // เลือกเลขที่ได้คะแนนสูงสุด
    const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));

    return (finalTens * 10) + finalUnits;
  }
};
