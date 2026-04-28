import { Pattern } from '../../types';

export const advancedClusterFormula: Pattern = {
  name: "Advanced Cluster Fusion (High-Digit + Cluster)",
  calc: (p, l, l4, results?) => {
    /**
     * ADVANCED CLUSTER FUSION
     * รวมสูตร Advanced High-Digit Sum + Cluster Frequency Matching
     *
     * หลักการผสม:
     * 1. Advanced High-Digit คำนวณ base digit จากหลักสูง
     * 2. Cluster Frequency หา hot cluster จากสถิติ
     * 3. ผสมผลลัพธ์จาก 2 วิธี (Weighted Voting)
     * 4. เลือกเลขที่ได้คะแนนสูงสุด
     *
     * น้ำหนักคะแนน:
     * - High-Digit Method: 40% (เน้นโครงสร้างเลข)
     * - Cluster Method: 40% (เน้นสถิติความถี่)
     * - Recent Trend: 20% (แนวโน้มล่าสุด)
     */
    
    const s = (l4 || l.toString().padStart(4, '0')).padStart(4, '0');
    
    // ===== ส่วนที่ 1: ADVANCED HIGH-DIGIT SUM (40%) =====
    const thousand = parseInt(s[0], 10) || 0;
    const hundred = parseInt(s[1], 10) || 0;
    const baseDigit = (thousand + hundred) % 10;
    const d1 = (baseDigit + 3) % 10;
    const d2 = (baseDigit + 7) % 10;
    
    const highDigitTens = (d1 + parseInt(s[2], 10)) % 10;
    const highDigitUnits = (d2 + parseInt(s[3], 10)) % 10;
    const highDigitNumber = (highDigitTens * 10) + highDigitUnits;
    
    // ===== ส่วนที่ 2: CLUSTER FREQUENCY (40%) =====
    let clusterNumber = highDigitNumber; // Default fallback
    
    if (results && results.length >= 15) {
      const window = Math.min(30, results.length);
      const recentData = results.slice(0, window);
      
      const digitFrequency: number[] = Array(10).fill(0);
      recentData.forEach(r => {
        const r2 = parseInt(r.r2, 10);
        const tens = Math.floor(r2 / 10);
        const units = r2 % 10;
        digitFrequency[tens]++;
        digitFrequency[units]++;
      });
      
      const hotDigits = digitFrequency
        .map((freq, digit) => ({ digit, freq }))
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 3)
        .map(x => x.digit);
      
      const lastDigit = parseInt(results[0].r2, 10) % 10;
      const pairs: Array<{ number: number, score: number }> = [];
      
      hotDigits.forEach(digit => {
        const number = (digit * 10) + lastDigit;
        const score = (digitFrequency[digit] * 2) + digitFrequency[lastDigit];
        pairs.push({ number, score });
      });
      
      pairs.sort((a, b) => b.score - a.score);
      clusterNumber = pairs[0].number;
    }
    
    // ===== ส่วนที่ 3: RECENT TREND (20%) =====
    let recentTrendNumber = highDigitNumber;
    
    if (results && results.length >= 5) {
      const recent5 = results.slice(0, Math.min(10, results.length));
      const avgTens = recent5.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent5.length;
      const avgUnits = recent5.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / recent5.length;
      
      const trendTens = Math.round(avgTens) % 10;
      const trendUnits = Math.round(avgUnits) % 10;
      recentTrendNumber = (trendTens * 10) + trendUnits;
    }
    
    // ===== ผสมผลลัพธ์จาก 3 วิธี (Weighted Voting) =====
    const tensVotes: number[] = Array(10).fill(0);
    const unitsVotes: number[] = Array(10).fill(0);
    
    // High-Digit (น้ำหนัก 40% = 4 โหวต)
    tensVotes[highDigitTens] += 4;
    unitsVotes[highDigitUnits] += 4;
    
    // Cluster (น้ำหนัก 40% = 4 โหวต)
    const clusterTens = Math.floor(clusterNumber / 10);
    const clusterUnits = clusterNumber % 10;
    tensVotes[clusterTens] += 4;
    unitsVotes[clusterUnits] += 4;
    
    // Recent Trend (น้ำหนัก 20% = 2 โหวต)
    const trendTens = Math.floor(recentTrendNumber / 10);
    const trendUnits = recentTrendNumber % 10;
    tensVotes[trendTens] += 2;
    unitsVotes[trendUnits] += 2;
    
    // เลือกเลขที่ได้โหวตสูงสุด
    const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));
    
    return (finalTens * 10) + finalUnits;
  }
};
