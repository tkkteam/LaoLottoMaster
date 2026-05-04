import { Pattern, LottoResult } from '../../types';

/**
 * MONTE CARLO 3D ANALYZER
 * สูตรวิเคราะห์เลข 3 ตัวด้วยสถิติขั้นสูง
 * 
 * รวมเทคนิค:
 * 1. Frequency Analysis (35%)
 * 2. Recency Analysis (25%)
 * 3. Markov Chain Digit-to-Digit (25%)
 * 4. Monte Carlo Simulation (10%)
 * 5. Pattern Scoring (5% + Penalty)
 */

export const monteCarlo3DFormula: Pattern = {
  name: "Monte Carlo 3D (ซูเปอร์มอนเต)",
  calc: (p, l, l4, results?) => {
    if (!results || results.length < 15) {
      return (p + l) % 100;
    }

    const history = results.slice(0, 100);
    const totalDraws = history.length;

    // 1. Frequency Map
    const freq = new Map<string, number>();
    history.forEach(d => {
      d.r3.split("").forEach(n => {
        freq.set(n, (freq.get(n) || 0) + 1);
      });
    });

    // 2. Recency Map
    const lastSeen = new Map<string, number>();
    history.forEach((d, i) => {
      d.r3.split("").forEach(n => {
        if (!lastSeen.has(n)) lastSeen.set(n, totalDraws - i);
      });
    });

    // 3. Markov Chain (Within-string digit transitions)
    const transitions = new Map<string, Map<string, number>>();
    history.forEach(d => {
      const digits = d.r3.split("");
      for (let i = 0; i < digits.length - 1; i++) {
        const curr = digits[i];
        const next = digits[i + 1];
        if (!transitions.has(curr)) transitions.set(curr, new Map());
        const map = transitions.get(curr)!;
        map.set(next, (map.get(next) || 0) + 1);
      }
    });

    const getMarkovProb = (a: string, b: string): number => {
      const map = transitions.get(a);
      if (!map) return 0;
      const total = Array.from(map.values()).reduce((sum, val) => sum + val, 0);
      return (map.get(b) || 0) / total;
    };

    // 4. Monte Carlo Simulation
    const monte = new Map<string, number>();
    const iterations = 2000;
    for (let i = 0; i < iterations; i++) {
      const num = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      monte.set(num, (monte.get(num) || 0) + 1);
    }

    // Scoring Functions
    const getPatternScore = (num: string): number => {
      let s = 1;
      if (/(\d)\1{2}/.test(num)) s *= 0.5; // Penalty for triples like 111
      if ("0123456789".includes(num) || "9876543210".includes(num)) s *= 0.7; // Penalty for sequences
      return s;
    };

    // Predict Top 30
    const candidates: Array<{ number: string, score: number }> = [];
    for (let i = 0; i < 1000; i++) {
      const num = i.toString().padStart(3, "0");
      const digits = num.split("");
      let score = 0;

      // Freq (35%)
      digits.forEach(d => { score += (freq.get(d) || 0) * 0.35; });
      // Recency (25%)
      digits.forEach(d => { score += ((lastSeen.get(d) || 0) / totalDraws) * 0.25; });
      // Markov (25%)
      for (let j = 0; j < digits.length - 1; j++) { score += getMarkovProb(digits[j], digits[j+1]) * 0.25; }
      // Monte (10%)
      score += (monte.get(num) || 0) * 0.1;
      // Pattern
      score *= getPatternScore(num);

      candidates.push({ number: num, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    
    // Return top 2 digits for the leaderboard (last 2 of the top 3D prediction)
    const best3D = candidates[0].number;
    return parseInt(best3D.slice(1), 10);
  },

  // Custom property to return full 3D prediction
  getTriple: (results: LottoResult[]): string => {
    if (!results || results.length < 10) return "000";

    const history = results.slice(0, 100);
    const totalDraws = history.length;

    // Reuse the same logic as calc
    const freq = new Map<string, number>();
    history.forEach(d => { d.r3.split("").forEach(n => { freq.set(n, (freq.get(n) || 0) + 1); }); });

    const lastSeen = new Map<string, number>();
    history.forEach((d, i) => { d.r3.split("").forEach(n => { if (!lastSeen.has(n)) lastSeen.set(n, totalDraws - i); }); });

    const transitions = new Map<string, Map<string, number>>();
    history.forEach(d => {
      const digits = d.r3.split("");
      for (let i = 0; i < digits.length - 1; i++) {
        const curr = digits[i]; const next = digits[i + 1];
        if (!transitions.has(curr)) transitions.set(curr, new Map());
        const map = transitions.get(curr)!; map.set(next, (map.get(next) || 0) + 1);
      }
    });

    const getMarkovProb = (a: string, b: string): number => {
      const map = transitions.get(a); if (!map) return 0;
      const total = Array.from(map.values()).reduce((sum, val) => sum + val, 0);
      return (map.get(b) || 0) / (total || 1);
    };

    const monte = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const num = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      monte.set(num, (monte.get(num) || 0) + 1);
    }

    const candidates: Array<{ number: string, score: number }> = [];
    for (let i = 0; i < 1000; i++) {
      const num = i.toString().padStart(3, "0");
      const digits = num.split("");
      let score = 0;
      digits.forEach(d => { score += (freq.get(d) || 0) * 0.35; });
      digits.forEach(d => { score += ((lastSeen.get(d) || 0) / totalDraws) * 0.25; });
      for (let j = 0; j < digits.length - 1; j++) { score += getMarkovProb(digits[j], digits[j+1]) * 0.25; }
      score += (monte.get(num) || 0) * 0.1;
      
      // Pattern Score (Penalty)
      if (/(\d)\1{2}/.test(num)) score *= 0.5;
      if ("0123456789".includes(num) || "9876543210".includes(num)) score *= 0.7;

      candidates.push({ number: num, score });
    }

    return candidates.sort((a, b) => b.score - a.score)[0].number;
  }
};
