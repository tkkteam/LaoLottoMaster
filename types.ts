
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
  calc: (p: number, l: number, l4?: string) => number;
  getMirrorPair?: (result: number) => number;
}

export interface BacktestResult {
  totalRounds: number;
  directHits: number;
  runningHits: number;
  directAccuracy: number;
  runningAccuracy: number;
  hits: Array<{ date: string; predicted: number; actual: number; isDirect: boolean; isRunning: boolean }>;
}
