import { LottoResult } from '../types';
import { getHotDigits } from './formulas/Hotnumber1';

export function backtestHotnumber1(data: LottoResult[], rounds: number = 30) {
  // Ensure we have enough data
  if (data.length < rounds + 10) return null;

  let hits = 0;
  const results = [];

  // Data is sorted newest at index 0
  for (let i = 0; i < rounds; i++) {
    const current = data[i];
    const historical = data.slice(i + 1).map(r => r.r2.padStart(2, '0'));
    
    // Get top 2 digits from Hotnumber1 (usually it returns 5, but for a "Running Digit" we typically use top 2-3)
    // The user asked for it as a "Running Digit" (เลขวิ่ง), so we'll check if any of the top 3 digits match either tens or units.
    const hotScores = getHotDigits(historical);
    const predictedDigits = hotScores.slice(0, 3).map(s => parseInt(s.digit, 10));
    
    const actualR2 = current.r2.padStart(2, '0');
    const actualDigits = [parseInt(actualR2[0], 10), parseInt(actualR2[1], 10)];
    
    const isHit = predictedDigits.some(d => actualDigits.includes(d));
    
    if (isHit) hits++;
    
    results.push({
      date: current.date,
      predicted: predictedDigits,
      actual: actualR2,
      isHit
    });
  }

  return {
    hits,
    total: rounds,
    accuracy: (hits / rounds) * 100,
    results
  };
}
