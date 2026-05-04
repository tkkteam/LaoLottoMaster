import { Pattern, LottoResult } from '../../types';

/**
 * CROSS-CORRELATION FORMULA
 * วิเคราะห์ความสัมพันธ์ระหว่าง R2, R3, R4 เพื่อทำนาย R2
 *
 * หลักการ:
 * 1. หา correlation ระหว่างหลักของ R2 กับ R3 และ R4
 * 2. ใช้ cross-correlation function (CCF) หา lag ที่เหมาะสม
 * 3. สร้าง predictive model จากความสัมพันธ์ข้ามหลัก
 * 4. ใช้ digit sum และ digit root เป็น features เพิ่มเติม
 */

export const crossCorrelationFormula: Pattern = {
  name: "Cross-Correlation (สหสัมพันธ์ข้าม)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 20) {
      const tens = (Math.floor(l / 10) + 1) % 10;
      const units = ((l % 10) + 4) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(60, results.length);
    const data = results.slice(0, N);

    // ===== สร้าง feature vectors =====
    const r2Tens: number[] = [];
    const r2Units: number[] = [];
    const r3Digits: number[][] = [];
    const r4Digits: number[][] = [];
    const digitSums: number[] = [];

    for (let i = data.length - 1; i >= 0; i--) {
      const r2 = parseInt(data[i].r2, 10);
      r2Tens.push(Math.floor(r2 / 10));
      r2Units.push(r2 % 10);

      const r3 = data[i].r3.padStart(3, '0');
      r3Digits.push([parseInt(r3[0], 10), parseInt(r3[1], 10), parseInt(r3[2], 10)]);

      const r4 = (data[i].r4 || '0000').padStart(4, '0');
      r4Digits.push([parseInt(r4[0], 10), parseInt(r4[1], 10), parseInt(r4[2], 10), parseInt(r4[3], 10)]);

      const sum = r3Digits[r3Digits.length - 1].reduce((a, b) => a + b, 0);
      digitSums.push(sum % 10);
    }

    // ===== 1. CROSS-CORRELATION: R2 Tens กับ R3 digits =====
    const crossCorr = (x: number[], y: number[], maxLag: number = 5): number[][] => {
      const n = Math.min(x.length, y.length);
      const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const stdX = Math.sqrt(x.slice(0, n).reduce((s, v) => s + (v - meanX) ** 2, 0) / n) || 1;
      const stdY = Math.sqrt(y.slice(0, n).reduce((s, v) => s + (v - meanY) ** 2, 0) / n) || 1;

      const correlations: number[][] = [];
      for (let lag = -maxLag; lag <= maxLag; lag++) {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < n; i++) {
          const j = i + lag;
          if (j >= 0 && j < n) {
            sum += ((x[i] - meanX) / stdX) * ((y[j] - meanY) / stdY);
            count++;
          }
        }
        correlations.push([lag, count > 0 ? sum / count : 0]);
      }
      return correlations;
    };

    // ===== 2. หา R3/R4 digits ที่ correlate กับ R2 มากที่สุด =====
    // Flatten: แปลงแต่ละ digit position เป็น time series แยกกัน
    const r3Tens: number[] = r3Digits.map(row => row[0]);
    const r3Mid: number[] = r3Digits.map(row => row[1]);
    const r3Units: number[] = r3Digits.map(row => row[2]);
    const r4Thou: number[] = r4Digits.map(row => row[0]);
    const r4Hund: number[] = r4Digits.map(row => row[1]);
    const r4Tens: number[] = r4Digits.map(row => row[2]);
    const r4Units: number[] = r4Digits.map(row => row[3]);

    const allSourceSeries: number[][] = [
      r3Tens, r3Mid, r3Units,
      r4Thou, r4Hund, r4Tens, r4Units,
      digitSums
    ];

    const findBestPredictor = (target: number[], sources: number[][]): { sourceIdx: number; correlation: number; lag: number } => {
      let bestCorr = 0;
      let bestSource = 0;
      let bestLag = 0;

      for (let s = 0; s < sources.length; s++) {
        const corrs = crossCorr(target, sources[s], 3);
        
        for (const [lag, corr] of corrs) {
          if (Math.abs(corr) > Math.abs(bestCorr)) {
            bestCorr = corr;
            bestSource = s;
            bestLag = lag;
          }
        }
      }

      return { sourceIdx: bestSource, correlation: bestCorr, lag: bestLag };
    };

    const tensPredictor = findBestPredictor(r2Tens, allSourceSeries);
    const unitsPredictor = findBestPredictor(r2Units, allSourceSeries);

    // ===== 3. PREDICTION USING CROSS-CORRELATION =====
    const predictFromCorrelation = (
      target: number[], 
      sources: number[][], 
      predictor: { sourceIdx: number; correlation: number; lag: number }
    ): number => {
      const sourceDigit = sources[predictor.sourceIdx];
      
      // ใช้ linear regression แบบง่าย
      const n = Math.min(target.length, sourceDigit.length);
      const recentTarget = target.slice(0, n);
      const recentSource = sourceDigit.slice(0, n);

      // หาความสัมพันธ์
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += recentSource[i];
        sumY += recentTarget[i];
        sumXY += recentSource[i] * recentTarget[i];
        sumX2 += recentSource[i] * recentSource[i];
      }

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;

      // ทำนายจากค่าล่าสุดของ source
      const latestSource = sourceDigit[0];
      const prediction = slope * latestSource + intercept;

      return Math.round(Math.max(0, Math.min(9, prediction)));
    };
    
    const predictedTens = predictFromCorrelation(r2Tens, allSourceSeries, tensPredictor);
    const predictedUnits = predictFromCorrelation(r2Units, allSourceSeries, unitsPredictor);

    // ===== 4. DIGIT SUM VERIFICATION =====
    // ตรวจสอบว่า prediction สอดคล้องกับ digit sum pattern หรือไม่
    const lastR4 = (data[0].r4 || '0000').padStart(4, '0');
    const lastR4Sum = lastR4.split('').reduce((a, b) => a + parseInt(b, 10), 0) % 10;

    const predictedSum = (predictedTens + predictedUnits) % 10;
    const sumDiff = Math.abs(predictedSum - lastR4Sum);

    // ถ้า sum ต่างมาก ให้ปรับให้ใกล้ขึ้น
    if (sumDiff > 3) {
      const adjustment = (lastR4Sum - predictedSum + 10) % 10;
      if (adjustment <= 5) {
        return ((predictedTens + adjustment) % 10 * 10) + predictedUnits;
      } else {
        return (predictedTens * 10) + ((predictedUnits + adjustment) % 10);
      }
    }

    return (predictedTens * 10) + predictedUnits;
  }
};
