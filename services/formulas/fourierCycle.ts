import { Pattern, LottoResult } from '../../types';

/**
 * FOURIER CYCLE DETECTION FORMULA
 * ใช้ Discrete Fourier Transform (DFT) หารอบซ้ำที่ซ่อนอยู่ในข้อมูล
 *
 * หลักการ:
 * 1. แปลงข้อมูลหวยเป็น time series
 * 2. ใช้ DFT หาความถี่ที่มีพลังงานสูงสุด
 * 3. ระบุ cycle length ที่โดดเด่น
 * 4. ใช้ cycle ในการทำนายงวดถัดไป
 * 5. ผสมหลาย cycles ด้วย weighted combination
 * 
 * ปรับปรุงจาก naive approach:
 * - ใช้ sliding window DFT แทน fixed window
 * - มี spectral analysis หา dominant frequencies
 * - ใช้ phase information สำหรับ timing
 */

export const fourierCycleFormula: Pattern = {
  name: "Fourier Cycle (รอบเวลา)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 30) {
      const tens = (Math.floor(l / 10) + 4) % 10;
      const units = ((l % 10) + 8) % 10;
      return (tens * 10) + units;
    }

    const N = Math.min(100, results.length);
    const data = results.slice(0, N);

    // ===== สร้าง time series สำหรับหลักสิบและหลักหน่วย =====
    const tensSeries: number[] = [];
    const unitsSeries: number[] = [];
    
    for (let i = data.length - 1; i >= 0; i--) {
      const r2 = parseInt(data[i].r2, 10);
      tensSeries.push(Math.floor(r2 / 10));
      unitsSeries.push(r2 % 10);
    }

    // ===== DISCRETE FOURIER TRANSFORM =====
    const dft = (signal: number[]): { magnitude: number[], phase: number[] } => {
      const n = signal.length;
      const magnitude: number[] = [];
      const phase: number[] = [];

      for (let k = 0; k < Math.floor(n / 2); k++) {
        let real = 0;
        let imag = 0;

        for (let t = 0; t < n; t++) {
          const angle = (2 * Math.PI * k * t) / n;
          real += signal[t] * Math.cos(angle);
          imag -= signal[t] * Math.sin(angle);
        }

        magnitude.push(Math.sqrt(real * real + imag * imag) / n);
        phase.push(Math.atan2(imag, real));
      }

      return { magnitude, phase };
    };

    const tensDFT = dft(tensSeries);
    const unitsDFT = dft(unitsSeries);

    // ===== หา dominant frequencies =====
    const findDominantFreq = (magnitude: number[], phase: number[], topN: number = 3): Array<{ freq: number; magnitude: number; phase: number }> => {
      const indexed = magnitude.map((m, i) => ({ freq: i, magnitude: m, phase: phase[i] }));
      // ข้าม DC component (freq=0) และ sort ตาม magnitude
      return indexed.slice(1).sort((a, b) => b.magnitude - a.magnitude).slice(0, topN);
    };

    const tensFreqs = findDominantFreq(tensDFT.magnitude, tensDFT.phase, 3);
    const unitsFreqs = findDominantFreq(unitsDFT.magnitude, unitsDFT.phase, 3);

    // ===== PREDICTION USING CYCLES =====
    const predictNext = (series: number[], freqs: Array<{ freq: number; magnitude: number; phase: number }>): number => {
      const n = series.length;
      const mean = series.reduce((a, b) => a + b, 0) / n;
      let prediction = mean;

      // รวม contribution จากแต่ละ dominant frequency
      const totalMag = freqs.reduce((sum, f) => sum + f.magnitude, 0);

      for (const freq of freqs) {
        if (totalMag > 0) {
          const weight = freq.magnitude / totalMag;
          // ทำนายค่าที่ time n+1 (งวดถัดไป)
          const angle = (2 * Math.PI * freq.freq * n) / n + freq.phase;
          prediction += weight * Math.cos(angle) * 4.5; // scale กลับมาที่ 0-9
        }
      }

      return Math.round(Math.max(0, Math.min(9, prediction)));
    };

    const predictedTens = predictNext(tensSeries, tensFreqs);
    const predictedUnits = predictNext(unitsSeries, unitsFreqs);

    // ===== CYCLE-BASED REFINEMENT =====
    // ตรวจสอบว่าเลขที่ทำนายสอดคล้องกับ cycle หรือไม่
    
    // หา cycle length ที่โดดเด่นที่สุด
    const dominantCycleTens = tensFreqs[0]?.freq || 1;
    const dominantCycleUnits = unitsFreqs[0]?.freq || 1;

    // แปลง frequency เป็น period (cycle length)
    const periodTens = N / (dominantCycleTens || 1);
    const periodUnits = N / (dominantCycleUnits || 1);

    // ตรวจสอบว่าตอนนี้เราอยู่ใน phase ไหนของ cycle
    const phasePositionTens = (N % Math.round(periodTens)) / Math.round(periodTens);
    const phasePositionUnits = (N % Math.round(periodUnits)) / Math.round(periodUnits);

    // ===== ADJUSTMENT BASED ON PHASE =====
    // ถ้าอยู่ใน phase ที่เลขมีแนวโน้มจะสูงขึ้น/ต่ำลง ให้ปรับ prediction
    
    // ตรวจสอบ trend ใน cycle ปัจจุบัน
    const cycleLenTens = Math.max(2, Math.min(Math.round(periodTens), 20));
    const cycleLenUnits = Math.max(2, Math.min(Math.round(periodUnits), 20));

    const recentTensInCycle = tensSeries.slice(0, cycleLenTens);
    const recentUnitsInCycle = unitsSeries.slice(0, cycleLenUnits);

    const tensTrend = recentTensInCycle.length > 1 
      ? (recentTensInCycle[0] - recentTensInCycle[recentTensInCycle.length - 1]) / recentTensInCycle.length 
      : 0;
    const unitsTrend = recentUnitsInCycle.length > 1 
      ? (recentUnitsInCycle[0] - recentUnitsInCycle[recentUnitsInCycle.length - 1]) / recentUnitsInCycle.length 
      : 0;

    // ปรับ prediction ตาม trend
    let adjustedTens = Math.round(Math.max(0, Math.min(9, predictedTens + tensTrend * 0.5)));
    let adjustedUnits = Math.round(Math.max(0, Math.min(9, predictedUnits + unitsTrend * 0.5)));

    // ===== CROSS-VALIDATION กับข้อมูลจริง =====
    // ตรวจสอบว่า prediction method นี้ทำงานได้ดีในอดีตหรือไม่
    
    let tensAccuracy = 0;
    let unitsAccuracy = 0;
    let testCount = 0;

    for (let testStart = 20; testStart < Math.min(50, N - 5); testStart += 5) {
      const testTensSeries = tensSeries.slice(testStart);
      const testUnitsSeries = unitsSeries.slice(testStart);
      
      // ทำนายและตรวจสอบ
      const testTensDFT = dft(testTensSeries);
      const testUnitsDFT = dft(testUnitsSeries);
      const testTensFreqs = findDominantFreq(testTensDFT.magnitude, testTensDFT.phase, 3);
      const testUnitsFreqs = findDominantFreq(testUnitsDFT.magnitude, testUnitsDFT.phase, 3);

      if (testStart + 1 < tensSeries.length) {
        const predT = predictNext(testTensSeries, testTensFreqs);
        const predU = predictNext(testUnitsSeries, testUnitsFreqs);
        const actualT = tensSeries[testStart - 1] || 0;
        const actualU = unitsSeries[testStart - 1] || 0;

        if (predT === actualT) tensAccuracy++;
        if (predU === actualU) unitsAccuracy++;
        testCount++;
      }
    }

    // ถ้า accuracy ต่ำ (< 15%) ให้ใช้วิธี fallback
    if (testCount > 0 && (tensAccuracy / testCount) < 0.15) {
      // Fallback: ใช้เลขที่ออกบ่อยใน cycle ปัจจุบัน
      const modeTens = Array(10).fill(0);
      const modeUnits = Array(10).fill(0);
      
      for (let i = 0; i < Math.min(cycleLenTens, tensSeries.length); i++) {
        modeTens[tensSeries[i]]++;
        modeUnits[unitsSeries[i]]++;
      }

      adjustedTens = modeTens.indexOf(Math.max(...modeTens));
      adjustedUnits = modeUnits.indexOf(Math.max(...modeUnits));
    }

    return (adjustedTens * 10) + adjustedUnits;
  }
};
