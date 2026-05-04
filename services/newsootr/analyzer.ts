import { DrawResult, Prediction } from "./types";
import { normalize } from "./utils";
import { MarkovChain } from "./markov";

export class LotteryAnalyzer {
  private history: DrawResult[];
  private markov: MarkovChain;

  constructor(history: DrawResult[]) {
    this.history = history;
    this.markov = new MarkovChain();
    this.markov.train(history.map(h => h.number));
  }

  private frequency() {
    const freq = new Map<string, number>();

    this.history.forEach(d => {
      d.number.split("").forEach(n => {
        freq.set(n, (freq.get(n) || 0) + 1);
      });
    });

    return freq;
  }

  private recency() {
    const lastSeen = new Map<string, number>();

    this.history.forEach((d, i) => {
      d.number.split("").forEach(n => {
        lastSeen.set(n, i);
      });
    });

    return lastSeen;
  }

  private patternScore(num: string) {
    let score = 1;

    // ตัดเลขซ้ำหนัก
    if (/(\d)\1{2}/.test(num)) score *= 0.5;

    // เลขเรียง
    if ("0123456789".includes(num)) score *= 0.7;

    return score;
  }

  private markovScore(num: string) {
    let score = 0;
    const digits = num.split("");

    for (let i = 0; i < digits.length - 1; i++) {
      score += this.markov.getProbability(digits[i], digits[i + 1]);
    }

    return score;
  }

  private monteCarlo(iterations = 5000) {
    const counts = new Map<string, number>();

    for (let i = 0; i < iterations; i++) {
      let num = "";
      for (let j = 0; j < 3; j++) {
        num += Math.floor(Math.random() * 10);
      }
      counts.set(num, (counts.get(num) || 0) + 1);
    }

    return counts;
  }

  predict(): Prediction[] {
    const freq = this.frequency();
    const recency = this.recency();
    const monte = this.monteCarlo();

    const candidates: Prediction[] = [];

    for (let i = 0; i < 1000; i++) {
      const num = i.toString().padStart(3, "0");
      const digits = num.split("");

      let score = 0;

      // Frequency
      digits.forEach(d => {
        score += (freq.get(d) || 0) * 0.35;
      });

      // Recency
      digits.forEach(d => {
        score += normalize((recency.get(d) || 0), this.history.length) * 0.25;
      });

      // Markov
      score += this.markovScore(num) * 0.25;

      // Monte Carlo
      score += (monte.get(num) || 0) * 0.1;

      // Pattern
      score *= this.patternScore(num);

      candidates.push({ number: num, score });
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 30);
  }
}