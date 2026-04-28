import { Pattern } from '../../types';

export const quantumFluxFormula: Pattern = {
  name: "Quantum Flux (สูตรไหล)",
  calc: (p, l, l4, results?) => {
    /**
     * QUANTUM FLUX V6 - Simplified & Optimized
     * ใช้ Hot Numbers + Last Drawn Pattern
     *
     * หลักการ:
     * 1. Hot Numbers (50%) - เลขที่ออกบ่อยใน 20 งวด
     * 2. Last Drawn (30%) - เลขที่ออกในงวดล่าสุด (มีแนวโน้มออกซ้ำ)
     * 3. Base Flow (20%) - สูตรไหลเดิม
     */

    // ===== ส่วนที่ 1: HOT NUMBERS (50%) =====
    let hotTens = 0;
    let hotUnits = 0;
    let isRepeatDetected = false;

    if (results && results.length >= 10) {
      const window = Math.min(20, results.length);
      const recentData = results.slice(0, window);
      
      // ===== ANTI-REPEAT DETECTION =====
      // ตรวจสอบว่าเลขเดิมออก 2 งวดติดกันหรือไม่
      if (results.length >= 2) {
        const lastR2 = parseInt(results[0].r2, 10);
        const prevR2 = parseInt(results[1].r2, 10);
        if (lastR2 === prevR2) {
          isRepeatDetected = true;
        }
      }
      
      // นับความถี่หลักสิบและหลักหน่วยแยกกัน
      const tensFreq: number[] = Array(10).fill(0);
      const unitsFreq: number[] = Array(10).fill(0);
      
      recentData.forEach((r, idx) => {
        const r2 = parseInt(r.r2, 10);
        let tensWeight = 1;
        let unitsWeight = 1;
        
        // ===== ANTI-REPEAT LOGIC =====
        // ถ้าตรวจพบ Repeat และนี่คืองวดที่ 0 หรือ 1 (2 งวดแรกที่ออกซ้ำ)
        // ให้ลดน้ำหนักของเลขนั้นลง 50%
        if (isRepeatDetected && idx < 2) {
          tensWeight = 0.5;
          unitsWeight = 0.5;
        }
        
        tensFreq[Math.floor(r2 / 10)] += tensWeight;
        unitsFreq[r2 % 10] += unitsWeight;
      });
      
      hotTens = tensFreq.indexOf(Math.max(...tensFreq));
      hotUnits = unitsFreq.indexOf(Math.max(...unitsFreq));
    }

    // ===== ส่วนที่ 2: LAST DRAWN (30%) =====
    const l1 = Math.floor(l / 10);
    const l2 = l % 10;
    
    // เลขที่ออกในงวดล่าสุดมีแนวโน้มออกซ้ำ
    let lastTens = l1;
    let lastUnits = l2;
    
    // ===== ANTI-REPEAT LOGIC =====
    // ถ้าเลขเดิมออก 2 งวดติดกัน ให้เปลี่ยนไปใช้เลขที่ออกในงวดที่ 3 แทน
    // (ใช้ isRepeatDetected จากส่วนที่ 1 แล้ว)
    if (isRepeatDetected && results && results.length >= 3) {
      // ใช้เลขจากงวดที่ 3 แทน (results[2])
      const thirdR2 = parseInt(results[2].r2, 10);
      lastTens = Math.floor(thirdR2 / 10);
      lastUnits = thirdR2 % 10;
    }

    // ===== ส่วนที่ 3: BASE FLOW (20%) =====
    const p1 = Math.floor(p / 10);
    const p2 = p % 10;
    
    const baseTens = (p1 + l1 + 7) % 10;
    const baseUnits = (p2 + l2 + 1) % 10;

    // ===== ผสมผลลัพธ์จาก 3 วิธี (Weighted Voting) =====
    const tensVotes: number[] = Array(10).fill(0);
    const unitsVotes: number[] = Array(10).fill(0);
    
    // Hot Numbers (น้ำหนัก 50% = 5 โหวต)
    tensVotes[hotTens] += 5;
    unitsVotes[hotUnits] += 5;
    
    // Last Drawn (น้ำหนัก 30% = 3 โหวต)
    // ถ้าตรวจพบ Repeat ให้ลดน้ำหนักลงเหลือ 1 โหวต
    const lastDrawnWeight = isRepeatDetected ? 1 : 3;
    tensVotes[lastTens] += lastDrawnWeight;
    unitsVotes[lastUnits] += lastDrawnWeight;
    
    // Base Flow (น้ำหนัก 20% = 2 โหวต)
    tensVotes[baseTens] += 2;
    unitsVotes[baseUnits] += 2;
    
    // เลือกเลขที่ได้โหวตสูงสุด
    const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));
    
    return (finalTens * 10) + finalUnits;
  }
};
