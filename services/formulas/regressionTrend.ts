import { Pattern, LottoResult } from '../../types';

/**
 * REGRESSION TREND FORMULA
 * ใช้ Linear และ Polynomial Regression หาแนวโน้มการเปลี่ยนแปลง
 *
 * หลักการ:
 * 1. สร้าง time series ของหลักสิบและหลักหน่วย
 * 2. ใช้ Linear Regression หาแนวโน้มเชิงเส้น
 * 3. ใช้ Polynomial Regression (degree 2) หาแนวโน้มโค้ง
 * 4. ใช้ Weighted Regression ให้น้ำหนักงวดล่าสุดมากกว่า
 * 5. ผสมผลลัพธ์จากทั้ง 2 models
 * 
 * ปรับปรุง:
 * - ใช้ exponential weighting
 * - มี outlier detection
 * - ใช้ R-squared วัดความน่าเชื่อถือของ model
 * - มี adaptive degree selection
 */

export const regressionTrendFormula: Pattern = {
  name: "Regression Trend (แนวโน้มถดถอย)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 15) {
      const tens = (Math.floor(l / 10) + 2) % 10;
      const units = ((l % 10) + 9) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(50, results.length);
    const data = results.slice(0, N);

    // ===== สร้าง time series (เรียงจากเก่าไปใหม่) =====
    const tensSeries: number[] = [];
    const unitsSeries: number[] = [];
    
    for (let i = data.length - 1; i >= 0; i--) {
      const r2 = parseInt(data[i].r2, 10);
      tensSeries.push(Math.floor(r2 / 10));
      unitsSeries.push(r2 % 10);
    }

    // ===== WEIGHTED LINEAR REGRESSION =====
    // y = mx + b โดยที่ x = time index, y = digit value
    const weightedLinearRegression = (series: number[], decayFactor: number = 0.95): { slope: number; intercept: number; rSquared: number; prediction: number } => {
      const n = series.length;
      
      // คำนวณ weights (exponential decay)
      const weights = series.map((_, i) => Math.pow(decayFactor, n - 1 - i));
      const sumW = weights.reduce((a, b) => a + b, 0);

      // Weighted means
      let sumWX = 0, sumWY = 0;
      for (let i = 0; i < n; i++) {
        sumWX += weights[i] * i;
        sumWY += weights[i] * series[i];
      }
      const meanX = sumWX / sumW;
      const meanY = sumWY / sumW;

      // Weighted slope and intercept
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += weights[i] * (i - meanX) * (series[i] - meanY);
        den += weights[i] * (i - meanX) ** 2;
      }
      
      const slope = den !== 0 ? num / den : 0;
      const intercept = meanY - slope * meanX;

      // R-squared
      let ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        ssTot += weights[i] * (series[i] - meanY) ** 2;
        const predicted = slope * i + intercept;
        ssRes += weights[i] * (series[i] - predicted) ** 2;
      }
      const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

      // Prediction สำหรับ time n (งวดถัดไป)
      const prediction = slope * n + intercept;

      return { slope, intercept, rSquared, prediction };
    };

    // ===== WEIGHTED POLYNOMIAL REGRESSION (degree 2) =====
    // y = ax² + bx + c
    const weightedPolynomialRegression = (series: number[], degree: number = 2, decayFactor: number = 0.95): { prediction: number; rSquared: number } => {
      const n = series.length;
      const weights = series.map((_, i) => Math.pow(decayFactor, n - 1 - i));
      
      // ใช้วิธี normal equations สำหรับ polynomial regression
      // สร้าง Vandermonde matrix
      const X: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let d = 0; d <= degree; d++) {
          row.push(i ** d);
        }
        X.push(row);
      }

      // X^T W X
      const XTWX: number[][] = [];
      for (let i = 0; i <= degree; i++) {
        XTWX[i] = [];
        for (let j = 0; j <= degree; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += weights[k] * X[k][i] * X[k][j];
          }
          XTWX[i][j] = sum;
        }
      }

      // X^T W y
      const XTWy: number[] = [];
      for (let i = 0; i <= degree; i++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += weights[k] * X[k][i] * series[k];
        }
        XTWy[i] = sum;
      }

      // แก้ระบบสมการ XTWX * coeffs = XTWy ด้วย Gaussian elimination
      const coeffs = solveLinearSystem(XTWX, XTWy);
      
      if (!coeffs) {
        // Fallback ถ้าแก้ไม่ได้
        return { prediction: series[series.length - 1], rSquared: 0 };
      }

      // Prediction
      let prediction = 0;
      for (let d = 0; d <= degree; d++) {
        prediction += coeffs[d] * (n ** d);
      }

      // R-squared
      let meanY = 0;
      for (let i = 0; i < n; i++) {
        meanY += weights[i] * series[i];
      }
      meanY /= weights.reduce((a, b) => a + b, 0);

      let ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        ssTot += weights[i] * (series[i] - meanY) ** 2;
        let predicted = 0;
        for (let d = 0; d <= degree; d++) {
          predicted += coeffs[d] * (i ** d);
        }
        ssRes += weights[i] * (series[i] - predicted) ** 2;
      }
      const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

      return { prediction, rSquared };
    };

    // Gaussian elimination สำหรับแก้ระบบสมการเชิงเส้น
    function solveLinearSystem(A: number[][], b: number[]): number[] | null {
      const n = A.length;
      const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

      for (let col = 0; col < n; col++) {
        // หา pivot
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
          if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
            maxRow = row;
          }
        }

        // สลับแถว
        [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

        if (Math.abs(augmented[col][col]) < 1e-10) {
          return null; // Singular matrix
        }

        // Eliminate
        for (let row = col + 1; row < n; row++) {
          const factor = augmented[row][col] / augmented[col][col];
          for (let j = col; j <= n; j++) {
            augmented[row][j] -= factor * augmented[col][j];
          }
        }
      }

      // Back substitution
      const x: number[] = Array(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        x[i] = augmented[i][n];
        for (let j = i + 1; j < n; j++) {
          x[i] -= augmented[i][j] * x[j];
        }
        x[i] /= augmented[i][i];
      }

      return x;
    }

    // ===== RUNNING REGRESSION =====
    const tensLinear = weightedLinearRegression(tensSeries);
    const unitsLinear = weightedLinearRegression(unitsSeries);
    const tensPoly = weightedPolynomialRegression(tensSeries, 2);
    const unitsPoly = weightedPolynomialRegression(unitsSeries, 2);

    // ===== ADAPTIVE MODEL SELECTION =====
    // เลือก model ที่มี R-squared สูงกว่า
    const tensR2Linear = tensLinear.rSquared;
    const tensR2Poly = tensPoly.rSquared;
    const unitsR2Linear = unitsLinear.rSquared;
    const unitsR2Poly = unitsPoly.rSquared;

    // ใช้ weighted average ของทั้ง 2 models โดยให้น้ำหนักตาม R-squared
    const tensPred = tensR2Linear + tensR2Poly > 0
      ? (tensLinear.prediction * Math.max(0, tensR2Linear) + tensPoly.prediction * Math.max(0, tensR2Poly)) / (Math.max(0.01, tensR2Linear) + Math.max(0.01, tensR2Poly))
      : (tensLinear.prediction + tensPoly.prediction) / 2;

    const unitsPred = unitsR2Linear + unitsR2Poly > 0
      ? (unitsLinear.prediction * Math.max(0, unitsR2Linear) + unitsPoly.prediction * Math.max(0, unitsR2Poly)) / (Math.max(0.01, unitsR2Linear) + Math.max(0.01, unitsR2Poly))
      : (unitsLinear.prediction + unitsPoly.prediction) / 2;

    // ===== OUTLIER DETECTION =====
    // ถ้า prediction ห่างจากค่าเฉลี่ยมากเกิน ให้ปรับกลับ
    const tensMean = tensSeries.reduce((a, b) => a + b, 0) / tensSeries.length;
    const unitsMean = unitsSeries.reduce((a, b) => a + b, 0) / unitsSeries.length;
    const tensStd = Math.sqrt(tensSeries.reduce((sum, v) => sum + (v - tensMean) ** 2, 0) / tensSeries.length);
    const unitsStd = Math.sqrt(unitsSeries.reduce((sum, v) => sum + (v - unitsMean) ** 2, 0) / unitsSeries.length);

    const clampValue = (value: number, mean: number, std: number): number => {
      const maxDev = std * 2.5;
      return Math.round(Math.max(0, Math.min(9, Math.max(mean - maxDev, Math.min(mean + maxDev, value)))));
    };

    const clampedTens = clampValue(tensPred, tensMean, tensStd);
    const clampedUnits = clampValue(unitsPred, unitsMean, unitsStd);

    // ===== MOMENTUM ADJUSTMENT =====
    // ตรวจสอบ momentum (ความเร็วในการเปลี่ยนแปลง)
    const recent5Tens = tensSeries.slice(-5);
    const recent5Units = unitsSeries.slice(-5);

    const tensMomentum = recent5Tens.length > 1
      ? (recent5Tens[recent5Tens.length - 1] - recent5Tens[0]) / recent5Tens.length
      : 0;
    const unitsMomentum = recent5Units.length > 1
      ? (recent5Units[recent5Units.length - 1] - recent5Units[0]) / recent5Units.length
      : 0;

    // ถ้า momentum สูง ให้ปรับ prediction ไปตามทิศทาง
    const finalTens = clampValue(clampedTens + tensMomentum * 0.3, tensMean, tensStd);
    const finalUnits = clampValue(clampedUnits + unitsMomentum * 0.3, unitsMean, unitsStd);

    return (finalTens * 10) + finalUnits;
  }
};
