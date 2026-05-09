/* LaoLotteryAnalyzer.ts
 * วิเคราะห์สถิติหวยลาว
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
  private csvUrl: string;

  constructor(csvUrl: string) {
    this.csvUrl = csvUrl;
  }

  async load(): Promise<void> {
    try {
      const resp = await fetch(this.csvUrl);
      const text = await resp.text();
      const lines = text.split('\n').filter(l => l.trim() !== '');
      
      // Assume CSV format: date,digit5,digit3,top2,bottom2
      // Skip header if needed
      const startIdx = lines[0].includes('date') ? 1 : 0;
      
      this.rows = lines.slice(startIdx).map(line => {
        const [date, d5, d3, t2, b2] = line.split(',');
        return {
          date: date.trim(),
          digit5: d5.trim(),
          digit3: d3.trim(),
          top2: parseInt(t2, 10),
          bottom2: parseInt(b2, 10)
        };
      });
      // Sort by date descending (assuming original is ascending)
      // If original is already newest first, we keep it. 
      // But typically we want newest first for analysis.
    } catch (e) {
      console.error('Failed to load lottery data:', e);
    }
  }

  /* ===============================
   * Utility
   * =============================== */
  last(): LaoLotteryRow {
    return this.rows[this.rows.length - 1];
  }
}
