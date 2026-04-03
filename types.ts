
export interface LottoResult {
  date: string;
  r4: string; // Last 4 digits
  r3: string; // 3-digit prize
  r2: string; // 2-digit prize
  year: string;
}

export interface PredictionResult {
  primary: string;
  mirror: string;
  rhythm: string;
  triple: string; // Added for 3-digit prediction
  confidence: number;
  formulaName: string;
}

export interface Pattern {
  name: string;
  calc: (p: number, l: number, l4?: string, results?: LottoResult[]) => number;
  getMirrorPair?: (result: number) => number;
}

export interface BacktestResult {
  totalRounds: number;
  directHits: number;
  runningHits: number;
  directAccuracy: number;
  runningAccuracy: number;
  maxConsecutiveHits: number; // Maximum consecutive correct predictions
  hits: Array<{ date: string; predicted: number; actual: number; isDirect: boolean; isRunning: boolean }>;
}

export interface PatternPerformance {
  pattern: Pattern;
  stats: BacktestResult;
  isQualified: boolean; // ผ่านเกณฑ์ consecutive hits หรือไม่
}

export interface HybridPatternInfo {
  pattern: Pattern;
  historicalStats: BacktestResult; // ค่าเฉลี่ยย้อนหลังทั้งหมด (30 งวด)
  currentStats: BacktestResult;    // ค่าล่าสุด (10 งวด)
  isQualified: boolean;            // ยังผ่านเกณฑ์หรือไม่
  stabilityScore: number;          // คะแนนความมั่นคง 0-100
  isActiveMaster: boolean;         // เป็น Active Master ปัจจุบัน
}

export interface RepeatAnalysis {
  totalOccurrences: number;           // จำนวนครั้งที่ออกทั้งหมด
  repeatAfterOne: number;              // ออกซ้ำในงวดถัดไป
  repeatAfterTwo: number;              // ออกซ้ำใน 2 งวดถัดไป
  repeatAfterThree: number;            // ออกซ้ำใน 3 งวดถัดไป
  repeatPercentage: number;            // % การออกซ้ำในงวดถัดไป
  averageGap: number;                  // ค่าเฉลี่ยช่องว่างระหว่างการออก
  lastSeenDate: string;                // วันที่ออกครั้งล่าสุด
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';  // ระดับความเชื่อมั่น
  recommendation: string;              // คำแนะนำ
}


