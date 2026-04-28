import { Pattern } from '../../types';

export const hotNumbersFormula: Pattern = {
  name: "สูตรสถิติความถี่ (Hot Numbers)",
  calc: (p, l, l4, results?) => {
    /**
     * สูตรสถิติความถี่ (Hot Numbers) - จาก social media
     * ทดสอบแล้ว: Direct 19.35%, Max Consecutive 3 งวด
     *
     * หลักการ:
     * 1. ดู 20 งวดล่าสุด
     * 2. นับความถี่หลักสิบและหลักหน่วยแยกกัน
     * 3. เลือกเลขที่ออกบ่อยที่สุด 3 ตัว (หลักสิบ)
     * 4. เลือกเลขที่ออกบ่อยที่สุด 3 ตัว (หลักหน่วย)
     * 5. จับคู่และเลือกคู่ที่มีความถี่รวมสูงสุด
     */
    if (!results || results.length < 20) {
      // Fallback ถ้าข้อมูลไม่พอ
      const tens = (Math.floor(l / 10) + 4) % 10;
      const units = ((l % 10) + 6) % 10;
      return (tens * 10) + units;
    }

    const window = Math.min(20, results.length);
    const recentData = results.slice(0, window);

    // ===== 1. นับความถี่หลักสิบและหลักหน่วย =====
    const tensCount: number[] = Array(10).fill(0);
    const unitsCount: number[] = Array(10).fill(0);

    recentData.forEach(r => {
      const r2 = parseInt(r.r2, 10);
      tensCount[Math.floor(r2 / 10)]++;
      unitsCount[r2 % 10]++;
    });

    // ===== 2. เลือกเลขที่ออกบ่อยที่สุด 3 ตัว =====
    const topTens = tensCount
      .map((count, digit) => ({ digit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(x => x.digit);

    const topUnits = unitsCount
      .map((count, digit) => ({ digit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(x => x.digit);

    // ===== 3. จับคู่และเลือกคู่ที่มีความถี่รวมสูงสุด =====
    // คำนวณคะแนนสำหรับแต่ละคู่
    const pairs: Array<{ number: number, score: number }> = [];

    for (const tens of topTens) {
      for (const units of topUnits) {
        const number = (tens * 10) + units;
        // คะแนน = ความถี่หลักสิบ + ความถี่หลักหน่วย
        let score = tensCount[tens] + unitsCount[units];
        
        // ===== ANTI-REPEAT LOGIC =====
        // ถ้าเลขนี้เพิ่งออก 2 งวดติดกัน ให้ลดคะแนนลง 50%
        if (results && results.length >= 2) {
          const lastR2 = parseInt(results[0].r2, 10);
          const prevR2 = parseInt(results[1].r2, 10);
          
          // ถ้าออก 2 งวดติดกัน และเป็นเลขเดียวกัน
          if (lastR2 === prevR2 && number === lastR2) {
            score = score * 0.5; // ลดคะแนนลง 50%
          }
          
          // ถ้าเพิ่งออกในงวดล่าสุด (แต่ไม่ติดกัน) ให้ลดคะแนนลง 20%
          if (number === lastR2 && lastR2 !== prevR2) {
            score = score * 0.8; // ลดคะแนนลง 20%
          }
        }
        
        pairs.push({ number, score });
      }
    }

    // เลือกคู่ที่มีคะแนนสูงสุด
    pairs.sort((a, b) => b.score - a.score);

    return pairs[0].number;
  }
};
