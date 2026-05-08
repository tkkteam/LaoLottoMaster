/* LaoLotteryAnalyzer.ts
 * วิเคราะห์สถิติหวยลาว + สูตรผสมอัตโนมัติ
 */

export interface LaoLotteryRow {
  date: string;
  digit5: string;
  digit3: string;
  top2: number;
  bottom2: number;
}

export class LaoLotteryAnalyzer {
  private rows: LaoLotteryRow[] = [];

  constructor(private csvUrl: string) {}

  /* ===============================
   * โหลดข้อมูล CSV
   * =============================== */
  async load(): Promise<void> {
    const res = await fetch(this.csvUrl);
    const text = await res.text();

    const lines = text.trim().split("\n");
    this.rows = [];

    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      this.rows.push({
        date: c[0],
        digit5: c[1],
        digit3: c[2],
        top2: Number(c[3]),
        bottom2: Number(c[4]),
      });
    }
  }

  /* ===============================
   * สูตรพื้นฐาน
   * =============================== */

  // ความถี่เลข 0–9 (จาก 2 ตัวบน/3 ตัว/5 ตัว)
  frequencyFromString(field: "digit3" | "digit5"): Record<number, number> {
    const freq: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) freq[i] = 0;

    this.rows.forEach(r => {
      for (const ch of r[field]) {
        freq[Number(ch)]++;
      }
    });
    return freq;
  }

  // แยกหลักสิบ/หน่วย
  split2Digit(n: number) {
    return { ten: Math.floor(n / 10), unit: n % 10 };
  }

  // เลขกลับ
  mirror(n: number): number {
    return (n % 10) * 10 + Math.floor(n / 10);
  }

  // ไม่ออกใน N งวดล่าสุด
  notAppeared(n: number, lastN: number, field: "top2" | "bottom2"): boolean {
    return this.rows.slice(-lastN).every(r => r[field] !== n);
  }

  /* ===============================
   * ✅ สูตรผสมอัตโนมัติ
   * คัดเลขเด่น + ตัดเลขอั้น
   * =============================== */

  /**
   * แนวคิด:
   * 1) หาเลขเด่น (Digit Frequency สูงสุด)
   * 2) สร้างชุด 2 ตัวจากเลขเด่น
   * 3) ตัดเลขที่ออกใน N งวดล่าสุด
   * 4) เพิ่มเลขกลับเป็นชุดเสริม
   */
  /**
   * ✅ คำนวณเลขเด่นแบบถ่วงน้ำหนัก (Weighted Frequency)
   * ให้ความสำคัญกับงวดล่าสุดมากกว่างวดเก่า
   */
  private getWeightedHotDigits(data: LaoLotteryRow[], take: number = 5): number[] {
    const freq: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) freq[i] = 0;

    data.forEach((r, idx) => {
      // ค่าน้ำหนัก: งวดล่าสุด (idx สูงสุด) จะมีน้ำหนักมากที่สุด
      const weight = 1 + (idx / data.length) * 2; // น้ำหนัก 1.0 ถึง 3.0
      for (const ch of r.digit3) {
        const d = Number(ch);
        if (!isNaN(d)) freq[d] += weight;
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, take)
      .map(([d]) => Number(d));
  }

  /**
   * ✅ วิเคราะห์ตำแหน่งหลักสิบและหลักหน่วยแยกกัน
   */
  private getPositionalStats(data: LaoLotteryRow[]) {
    const tens: Record<number, number> = {};
    const units: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) { tens[i] = 0; units[i] = 0; }

    data.forEach((r, idx) => {
      const weight = 1 + (idx / data.length);
      const t = Math.floor(r.top2 / 10);
      const u = r.top2 % 10;
      tens[t] += weight;
      units[u] += weight;
    });

    return { tens, units };
  }

  /**
   * ✅ ปรับปรุงการสร้างชุดตัวเลข (Auto Hybrid V2.1 - Smart Filtering)
   */
  generateAutoSet(config?: {
    recentCut?: number;
    topDigitCount?: number;
    dataOverride?: LaoLotteryRow[];
  }) {
    const data = config?.dataOverride ?? this.rows;
    const recentCut = config?.recentCut ?? 24;
    const topDigitCount = config?.topDigitCount ?? 5;

    // 1) หาเลขเด่นถ่วงน้ำหนัก
    const hotDigits = this.getWeightedHotDigits(data, topDigitCount);

    // 2) สร้างเลข 2 ตัวจากเลขเด่น (Ensemble Logic)
    let candidates: number[] = [];
    for (const a of hotDigits) {
      for (const b of hotDigits) {
        candidates.push(a * 10 + b);
      }
    }

    // 3) คัดกรองเบื้องต้น (เลขที่เพิ่งออกใน 10 งวดล่าสุดมีโอกาสซ้ำน้อย)
    const veryRecent = data.slice(-10).map(r => r.top2);
    candidates = candidates.filter(n => !veryRecent.includes(n));

    // 4) ให้คะแนนและคัดเลือกตัวท็อป (3-6 คู่) สำหรับ "Main Candidates"
    const rankedCandidates = candidates
      .map(n => ({
        number: n,
        score: this.scoreNumber(n, hotDigits, recentCut, data)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // เอาตัวท็อปสุดไม่เกิน 6 ตัว

    const topCandidates = rankedCandidates.map(c => c.number);

    // 5) เพิ่มเลขกลับ (Mirror) เฉพาะจากตัวท็อป
    const mirrorSet = topCandidates.map(n => this.mirror(n));
    const finalSet = Array.from(new Set([...topCandidates, ...mirrorSet]));

    return {
      hotDigits,
      candidate2Digits: topCandidates, // ส่งเฉพาะ 3-6 ตัวที่กรองแล้ว
      mirrorCandidates: mirrorSet,
      finalSet,
    };
  }

  /**
   * ✅ ฟังก์ชันให้คะแนนขั้นสูง (Scoring Engine V2)
   */
  private scoreNumber(
    n: number,
    hotDigits: number[],
    recentCut: number,
    dataContext: LaoLotteryRow[]
  ): number {
    let score = 0;
    const ten = Math.floor(n / 10);
    const unit = n % 10;

    // 1. คะแนนความถี่ (Hot Digits)
    if (hotDigits.includes(ten)) score += 3;
    if (hotDigits.includes(unit)) score += 3;

    // 2. คะแนนตำแหน่ง (Positional Prob)
    const pos = this.getPositionalStats(dataContext);
    const maxTen = Math.max(...Object.values(pos.tens));
    const maxUnit = Math.max(...Object.values(pos.units));
    
    score += (pos.tens[ten] / maxTen) * 4;
    score += (pos.units[unit] / maxUnit) * 4;

    // 3. คะแนนเลข "เย็น" (Cold Number Due) - เลขที่ไม่ออกนานๆ มีโอกาสกลับมา
    const gap = [...dataContext].reverse().findIndex(r => r.top2 === n);
    const finalGap = gap === -1 ? 100 : gap;
    if (finalGap > 40) score += 5; // Super Cold
    else if (finalGap > 20) score += 3;

    // 4. คะแนนสมดุล คู่/คี่
    const isEven = n % 2 === 0;
    const recentEvenCount = dataContext.slice(-10).filter(r => r.top2 % 2 === 0).length;
    if (isEven && recentEvenCount <= 4) score += 2; // ถ้าช่วงนี้คู่ออกน้อย ให้คะแนนคู่เพิ่ม
    if (!isEven && recentEvenCount >= 6) score += 2; // ถ้าช่วงนี้คี่ออกน้อย ให้คะแนนคี่เพิ่ม

    // 5. คะแนนความใกล้เคียงค่าเฉลี่ย
    const avg = dataContext.slice(-15).reduce((a, b) => a + b.top2, 0) / 15;
    const diff = Math.abs(n - avg);
    if (diff <= 10) score += 2;
    else if (diff <= 20) score += 1;

    return Number(score.toFixed(2));
  }

  /**
   * ✅ ฟังก์ชันเลือกชุดสุดท้าย (Smart Selector V2)
   */
  selectFinalSet(config?: {
    recentCut?: number;
    hotDigitCount?: number;
    min?: number;
    max?: number;
    dataOverride?: LaoLotteryRow[];
  }) {
    const data = config?.dataOverride ?? this.rows;
    const recentCut = config?.recentCut ?? 24;
    const hotDigitCount = config?.hotDigitCount ?? 5;
    const min = config?.min ?? 3;
    const max = config?.max ?? 6;

    // 1) ดึงชุดพื้นฐาน
    const base = this.generateAutoSet({
      recentCut,
      topDigitCount: hotDigitCount,
      dataOverride: data
    });

    // 2) ให้คะแนนด้วย Scoring Engine V2
    const ranked = base.finalSet
      .map(n => ({
        number: n,
        score: this.scoreNumber(n, base.hotDigits, recentCut, data),
      }))
      .sort((a, b) => b.score - a.score);

    // 3) เลือกเฉพาะที่มีคุณภาพ (Score > Threshold) หรือเลือกตามจำนวนที่กำหนด
    const count = Math.min(max, Math.max(min, ranked.length));
    return ranked.slice(0, count);
  }

  /**
   * ✅ ฟังก์ชันหาเลขเด่นรอง (Alternative Digits)
   */
  getAlternativeDigits(config?: {
    lookback?: number;     // ดูย้อนหลัง
    skipTop?: number;      // ข้ามเลขเด่นอันดับต้น
    take?: number;         // เอากี่ตัว
  }) {
    const lookback = config?.lookback ?? 30;
    const skipTop = config?.skipTop ?? 2;
    const take = config?.take ?? 3;

    // นับความถี่เลขย้อนหลัง
    const freq: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) freq[i] = 0;

    this.rows.slice(-lookback).forEach(r => {
      for (const ch of r.digit3) {
        freq[Number(ch)]++;
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(skipTop, skipTop + take)
      .map(([d]) => Number(d));
  }

  /* ===============================
   * ✅ ฟังก์ชัน Backtest (สำหรับแสดงผลสถิติในหน้าจอ)
   * =============================== */
  backtest(rounds: number = 30) {
    const logs: any[] = [];
    let hits = 0;
    
    // วนลูปย้อนหลังเพื่อทดสอบความแม่นยำ
    for (let i = 0; i < rounds && i < this.rows.length - 1; i++) {
      const idx = this.rows.length - 1 - i;
      const actualRow = this.rows[idx];
      const historicalData = this.rows.slice(0, idx);
      
      const autoSet = this.generateAutoSet({ dataOverride: historicalData });
      // ตรวจสอบว่าเลขที่ออก (top2) อยู่ในชุดที่ทำนายหรือไม่
      const isHit = autoSet.finalSet.includes(actualRow.top2);
      
      if (isHit) hits++;
      
      logs.push({
        date: actualRow.date,
        hotDigits: autoSet.hotDigits,
        predicted: autoSet.finalSet,
        actual: actualRow.top2.toString().padStart(2, '0'),
        isHit
      });
    }
    
    return {
      total: logs.length,
      hits,
      accuracy: logs.length > 0 ? (hits / logs.length) * 100 : 0,
      logs
    };
  }

  /* ===============================
   * Utility
   * =============================== */
  last(): LaoLotteryRow {
    return this.rows[this.rows.length - 1];
  }
}