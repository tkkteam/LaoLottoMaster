import { Pattern, LottoResult } from '../../types';

/**
 * QUANTUM ANALYSIS - สูตรวิเคราะห์ควอนตัมใหม่
 * ไม่อิงจาก 10 สูตรเดิม ใช้การวิเคราะห์ทางสถิติล้วนๆ
 * 
 * หลักการ:
 * 1. วิเคราะห์ความถี่ของเลขแต่ละตัวในหลักสิบและหลักหน่วย
 * 2. วิเคราะห์รูปแบบการออกซ้ำ (repeat patterns)
 * 3. วิเคราะห์ช่องว่างระหว่างการออก (gap analysis)
 * 4. วิเคราะห์แนวโน้มล่าสุด (momentum)
 * 5. ผสมผลลัพธ์ด้วย weighted scoring
 */

export const quantumAnalysisFormula: Pattern = {
  name: "Quantum Analysis (วิเคราะห์ควอนตัม)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 30) {
      // Fallback ถ้าข้อมูลไม่พอ
      return (p + l) % 100;
    }

    // ใช้ข้อมูล 50 งวดล่าสุด
    const window = Math.min(50, results.length);
    const recentData = results.slice(0, window);

    // ===== 1. FREQUENCY ANALYSIS =====
    const tensFreq: number[] = Array(10).fill(0);
    const unitsFreq: number[] = Array(10).fill(0);
    
    recentData.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      tensFreq[Math.floor(r2 / 10)]++;
      unitsFreq[r2 % 10]++;
    });

    // ===== 2. RECENCY WEIGHTED FREQUENCY =====
    // ให้น้ำหนักกับงวดล่าสุดมากกว่า
    const tensRecency: number[] = Array(10).fill(0);
    const unitsRecency: number[] = Array(10).fill(0);
    
    recentData.forEach((r, idx) => {
      const r2 = parseInt(r.r2, 10);
      const weight = 1 + (window - idx) / window; // น้ำหนัก 1-2
      tensRecency[Math.floor(r2 / 10)] += weight;
      unitsRecency[r2 % 10] += weight;
    });

    // ===== 3. GAP ANALYSIS =====
    // วิเคราะห์ช่องว่างระหว่างการออกของแต่ละเลข
    const tensLastSeen: number[] = Array(10).fill(-1);
    const unitsLastSeen: number[] = Array(10).fill(-1);
    const tensGaps: number[] = Array(10).fill(0);
    const unitsGaps: number[] = Array(10).fill(0);
    
    recentData.forEach((r, idx) => {
      const r2 = parseInt(r.r2, 10);
      const tens = Math.floor(r2 / 10);
      const units = r2 % 10;
      
      if (tensLastSeen[tens] !== -1) {
        tensGaps[tens] += idx - tensLastSeen[tens];
      }
      if (unitsLastSeen[units] !== -1) {
        unitsGaps[units] += idx - unitsLastSeen[units];
      }
      
      tensLastSeen[tens] = idx;
      unitsLastSeen[units] = idx;
    });

    // คำนวณ average gap
    const tensAvgGap: number[] = Array(10).fill(0);
    const unitsAvgGap: number[] = Array(10).fill(0);
    
    for (let d = 0; d < 10; d++) {
      const count = tensFreq[d];
      if (count > 1) {
        tensAvgGap[d] = tensGaps[d] / (count - 1);
      }
      const uCount = unitsFreq[d];
      if (uCount > 1) {
        unitsAvgGap[d] = unitsGaps[d] / (uCount - 1);
      }
    }

    // ===== 4. MOMENTUM ANALYSIS =====
    // วิเคราะห์แนวโน้ม 10 งวดล่าสุด vs 10 งวดก่อนหน้า
    const recent10 = results.slice(0, 10);
    const prev10 = results.slice(10, 20);
    
    const tensMomentum: number[] = Array(10).fill(0);
    const unitsMomentum: number[] = Array(10).fill(0);
    
    const recentTens: number[] = Array(10).fill(0);
    const recentUnits: number[] = Array(10).fill(0);
    const prevTens: number[] = Array(10).fill(0);
    const prevUnits: number[] = Array(10).fill(0);
    
    recent10.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      recentTens[Math.floor(r2 / 10)]++;
      recentUnits[r2 % 10]++;
    });
    
    prev10.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      prevTens[Math.floor(r2 / 10)]++;
      prevUnits[r2 % 10]++;
    });
    
    for (let d = 0; d < 10; d++) {
      tensMomentum[d] = recentTens[d] - prevTens[d];
      unitsMomentum[d] = recentUnits[d] - prevUnits[d];
    }

    // ===== 5. COMBINED SCORING =====
    const tensScore: number[] = Array(10).fill(0);
    const unitsScore: number[] = Array(10).fill(0);
    
    // Normalize frequencies
    const maxTensFreq = Math.max(...tensFreq, 1);
    const maxUnitsFreq = Math.max(...unitsFreq, 1);
    const maxTensRecency = Math.max(...tensRecency, 1);
    const maxUnitsRecency = Math.max(...unitsRecency, 1);
    const maxTensAvgGap = Math.max(...tensAvgGap, 1);
    const maxUnitsAvgGap = Math.max(...unitsAvgGap, 1);
    const maxTensMomentum = Math.max(...tensMomentum.map(Math.abs), 1);
    const maxUnitsMomentum = Math.max(...unitsMomentum.map(Math.abs), 1);
    
    for (let d = 0; d < 10; d++) {
      // Frequency score (30%)
      const freqScore = (tensFreq[d] / maxTensFreq) * 30;
      const uFreqScore = (unitsFreq[d] / maxUnitsFreq) * 30;
      
      // Recency score (25%)
      const recencyScore = (tensRecency[d] / maxTensRecency) * 25;
      const uRecencyScore = (unitsRecency[d] / maxUnitsRecency) * 25;
      
      // Gap score (20%) - เลขที่ห่างนานมีแนวโน้มจะออก
      const gapScore = (tensAvgGap[d] / maxTensAvgGap) * 20;
      const uGapScore = (unitsAvgGap[d] / maxUnitsAvgGap) * 20;
      
      // Momentum score (25%)
      const momentumScore = ((tensMomentum[d] + maxTensMomentum) / (2 * maxTensMomentum)) * 25;
      const uMomentumScore = ((unitsMomentum[d] + maxUnitsMomentum) / (2 * maxUnitsMomentum)) * 25;
      
      tensScore[d] = freqScore + recencyScore + gapScore + momentumScore;
      unitsScore[d] = uFreqScore + uRecencyScore + uGapScore + uMomentumScore;
    }

    // ===== 6. SELECT BEST PAIR =====
    // เลือกหลักสิบและหลักหน่วยที่ได้คะแนนสูงสุด
    let bestTens = 0;
    let bestUnits = 0;
    let bestScore = 0;
    
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const pairScore = tensScore[t] + unitsScore[u];
        
        // Bonus ถ้าคู่เคยออกด้วยกันบ่อย
        const pairFreq = recentData.filter(r => parseInt(r.r2, 10) === t * 10 + u).length;
        const pairBonus = pairFreq * 5;
        
        if (pairScore + pairBonus > bestScore) {
          bestScore = pairScore + pairBonus;
          bestTens = t;
          bestUnits = u;
        }
      }
    }

    return (bestTens * 10) + bestUnits;
  },
  
  getMirrorPair: (result: number) => {
    const MIRRORS: Record<string, string> = { 
      '0': '5', '1': '6', '2': '7', '3': '8', '4': '9', 
      '5': '0', '6': '1', '7': '2', '8': '3', '9': '4' 
    };
    const s = result.toString().padStart(2, '0');
    const mirrorStr = (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
    return parseInt(mirrorStr, 10);
  }
};
