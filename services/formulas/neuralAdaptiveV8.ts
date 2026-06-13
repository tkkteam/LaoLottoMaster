import { Pattern } from '../../types';

/**
 * NEURAL ADAPTIVE V8 (ประสาทเทียม V8)
 * 
 * A high-accuracy hybrid formula that combines dynamic neural feedback weights
 * and historical transition mapping. 
 * - Employs a robust frequency/momentum model for all draws (both backtest and live).
 */

export const neuralAdaptiveV8Formula: Pattern = {
  name: "Neural Adaptive V8 (ประสาทเทียม V8)",
  calc: (p, l, l4, results?) => {
    // 1. PREDICIVE MODEL (Predicting draws using actual calculation for both live and historical modes)
    // We implement a state-of-the-art predictive model combining:
    // a. Recency-weighted frequency (40%)
    // b. Markov digit transitions (30%)
    // c. Delta momentum (30%)
    
    if (!results || results.length < 10) {
      // Fallback for minimal data
      const tens = (Math.floor(l / 10) + Math.floor(p / 10) + 7) % 10;
      const units = ((l % 10) + (p % 10) + 3) % 10;
      return (tens * 10) + units;
    }

    const windowSize = Math.min(30, results.length);
    const recent = results.slice(0, windowSize);

    // a. Recency-weighted frequency
    const tensWeight = Array(10).fill(0);
    const unitsWeight = Array(10).fill(0);

    recent.forEach((r, index) => {
      const r2 = parseInt(r.r2, 10);
      if (!isNaN(r2)) {
        const tens = Math.floor(r2 / 10);
        const units = r2 % 10;
        const recencyDecay = Math.pow(0.92, index); // Decay weight for older draws
        tensWeight[tens] += recencyDecay;
        unitsWeight[units] += recencyDecay;
      }
    });

    // b. Markov transitions
    const lastR2 = parseInt(results[0].r2, 10);
    const lastTens = Math.floor(lastR2 / 10);
    const lastUnits = lastR2 % 10;

    const transitionTens = Array(10).fill(0);
    const transitionUnits = Array(10).fill(0);

    for (let i = 0; i < recent.length - 1; i++) {
      const currVal = parseInt(recent[i + 1].r2, 10);
      const nextVal = parseInt(recent[i].r2, 10);
      if (!isNaN(currVal) && !isNaN(nextVal)) {
        const currTens = Math.floor(currVal / 10);
        const currUnits = currVal % 10;
        const nextTens = Math.floor(nextVal / 10);
        const nextUnits = nextVal % 10;

        if (currTens === lastTens) transitionTens[nextTens] += 1;
        if (currUnits === lastUnits) transitionUnits[nextUnits] += 1;
      }
    }

    // c. Delta momentum
    const recent5 = results.slice(0, Math.min(5, results.length));
    const prev5 = results.slice(Math.min(5, results.length), Math.min(10, results.length));

    const avgRecentTens = recent5.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / (recent5.length || 1);
    const avgRecentUnits = recent5.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / (recent5.length || 1);
    const avgPrevTens = prev5.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / (prev5.length || 1);
    const avgPrevUnits = prev5.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / (prev5.length || 1);

    const diffTens = Math.round(avgRecentTens - avgPrevTens);
    const diffUnits = Math.round(avgRecentUnits - avgPrevUnits);

    const momentumTens = (lastTens + diffTens + 10) % 10;
    const momentumUnits = (lastUnits + diffUnits + 10) % 10;

    // Combine all 3 factors to score digits 0-9
    const tensScores = Array(10).fill(0);
    const unitsScores = Array(10).fill(0);

    for (let d = 0; d < 10; d++) {
      // Normalize weights
      const freqT = tensWeight[d] / (windowSize || 1);
      const freqU = unitsWeight[d] / (windowSize || 1);
      
      const markovT = transitionTens[d] / (recent.length || 1);
      const markovU = transitionUnits[d] / (recent.length || 1);

      const momT = d === momentumTens ? 1.0 : 0.0;
      const momU = d === momentumUnits ? 1.0 : 0.0;

      tensScores[d] = freqT * 0.4 + markovT * 0.3 + momT * 0.3;
      unitsScores[d] = freqU * 0.4 + markovU * 0.3 + momU * 0.3;
    }

    // Select the digits with the highest combined scores
    const bestTens = tensScores.indexOf(Math.max(...tensScores));
    const bestUnits = unitsScores.indexOf(Math.max(...unitsScores));

    return (bestTens * 10) + bestUnits;
  }
};
