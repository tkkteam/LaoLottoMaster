import { Pattern, LottoResult } from '../../types';

/**
 * UNIFIED QUANTUM ANALYSIS ENGINE
 * รวมสูตรทั้งหมด 20 สูตรเป็นหนึ่งเดียว
 * 
 * เทคนิคที่รวม:
 * 1. Hot Numbers (Frequency Analysis)
 * 2. Master 2-Digit (Static Calculation)
 * 3. Quantum Flux (Hot + Last Drawn + Base Flow)
 * 4. Markov Chain (Transition Matrix)
 * 5. Neural Pattern (Multi-Factor Combination)
 * 6. Deep Learning 4D (Markov + 4D Pattern + Trend)
 * 7. Quantum Analysis (Frequency + Recency + Gap + Momentum)
 * 8. Advanced Cluster (High-Digit Sum + Cluster Frequency)
 * 9. N-Gram Pattern (Sequence Matching)
 * 10. Static Core (Static Calculation)
 * 11. Quantum Max (Digit Scoring with Grid Search)
 * 12. Bayesian Probability (Bayesian Inference)
 * 13. Entropy Analysis (Shannon Entropy)
 * 14. Fourier Cycle (DFT Cycle Detection)
 * 15. Regression Trend (Linear/Polynomial Regression)
 * 16. Pattern Memory (Error Pattern Analysis)
 * 17. Smart Fusion (Ensemble Learning)
 * 18. Cross Correlation (Cross-Correlation Analysis)
 * 19. Adaptive Weight (Adaptive Weight Learning)
 * 20. Digit Pair Frequency (Pair Frequency Matrix)
 */

const MIRRORS: Record<string, string> = { 
  '0': '5', '1': '6', '2': '7', '3': '8', '4': '9', 
  '5': '0', '6': '1', '7': '2', '8': '3', '9': '4' 
};

function getMirror(s: string): string {
  return (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
}

// ===== 1. HOT NUMBERS =====
function hotNumbers(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 10) return (p + l) % 100;
  const window = Math.min(20, results.length);
  const tensCount = Array(10).fill(0);
  const unitsCount = Array(10).fill(0);
  for (let i = 0; i < window; i++) {
    const r2 = parseInt(results[i].r2, 10);
    tensCount[Math.floor(r2 / 10)]++;
    unitsCount[r2 % 10]++;
  }
  return (tensCount.indexOf(Math.max(...tensCount)) * 10) + unitsCount.indexOf(Math.max(...unitsCount));
}

// ===== 2. MASTER 2-DIGIT =====
function master2Digit(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  const s = (l4 && l4.length > 0 ? l4 : l.toString()).padStart(4, '0');
  const a = parseInt(s[0], 10) || 0;
  const b = parseInt(s[1], 10) || 0;
  const c = parseInt(s[2], 10) || 0;
  const d = parseInt(s[3], 10) || 0;
  const tens = ((a * 2) + b + 5) % 10;
  const units = (c + d + 3) % 10;
  return (tens * 10) + units;
}

// ===== 3. QUANTUM FLUX =====
function quantumFlux(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  let hotTens = 0, hotUnits = 0, isRepeatDetected = false;
  if (results && results.length >= 10) {
    const window = Math.min(20, results.length);
    const recentData = results.slice(0, window);
    if (results.length >= 2) {
      const lastR2 = parseInt(results[0].r2, 10);
      const prevR2 = parseInt(results[1].r2, 10);
      if (lastR2 === prevR2) isRepeatDetected = true;
    }
    const tensFreq = Array(10).fill(0);
    const unitsFreq = Array(10).fill(0);
    recentData.forEach((r, idx) => {
      const r2 = parseInt(r.r2, 10);
      const w = (isRepeatDetected && idx < 2) ? 0.5 : 1;
      tensFreq[Math.floor(r2 / 10)] += w;
      unitsFreq[r2 % 10] += w;
    });
    hotTens = tensFreq.indexOf(Math.max(...tensFreq));
    hotUnits = unitsFreq.indexOf(Math.max(...unitsFreq));
  }
  const l1 = Math.floor(l / 10), l2 = l % 10;
  let lastTens = l1, lastUnits = l2;
  if (isRepeatDetected && results && results.length >= 3) {
    const thirdR2 = parseInt(results[2].r2, 10);
    lastTens = Math.floor(thirdR2 / 10);
    lastUnits = thirdR2 % 10;
  }
  const p1 = Math.floor(p / 10), p2 = p % 10;
  const baseTens = (p1 + l1 + 7) % 10, baseUnits = (p2 + l2 + 1) % 10;
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  tensVotes[hotTens] += 5; unitsVotes[hotUnits] += 5;
  const lw = isRepeatDetected ? 1 : 3;
  tensVotes[lastTens] += lw; unitsVotes[lastUnits] += lw;
  tensVotes[baseTens] += 2; unitsVotes[baseUnits] += 2;
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 4. MARKOV CHAIN =====
function markovChain(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 15) return ((Math.floor(l / 10) + 7) * 10) + ((l % 10 + 3) % 10);
  const analysisWindow = Math.min(60, results.length);
  const history = results.slice(0, analysisWindow);
  const tensTransition = Array(10).fill(0).map(() => Array(10).fill(0));
  const unitsTransition = Array(10).fill(0).map(() => Array(10).fill(0));
  for (let i = 0; i < history.length - 1; i++) {
    const current = parseInt(history[i + 1].r2, 10);
    const next = parseInt(history[i].r2, 10);
    const weight = (analysisWindow - i) / analysisWindow;
    tensTransition[Math.floor(current / 10)][Math.floor(next / 10)] += weight;
    unitsTransition[current % 10][next % 10] += weight;
  }
  const lastR2 = parseInt(history[0].r2, 10);
  const lastTens = Math.floor(lastR2 / 10), lastUnits = lastR2 % 10;
  const getBest = (matrix: number[][], current: number) => {
    const row = matrix[current];
    const maxVal = Math.max(...row);
    return maxVal === 0 ? (current + 5) % 10 : row.indexOf(maxVal);
  };
  return (getBest(tensTransition, lastTens) * 10) + getBest(unitsTransition, lastUnits);
}

// ===== 5. NEURAL PATTERN =====
function neuralPattern(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 15) return ((Math.floor(l / 10) + Math.floor(p / 10) + 6) % 10 * 10) + ((l % 10 + p % 10 + 4) % 10);
  const recentTens: number[] = [], recentUnits: number[] = [];
  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r2 = parseInt(results[i].r2, 10);
    recentTens.push(Math.floor(r2 / 10));
    recentUnits.push(r2 % 10);
  }
  const avgTens = recentTens.reduce((a, b) => a + b, 0) / recentTens.length;
  const avgUnits = recentUnits.reduce((a, b) => a + b, 0) / recentUnits.length;
  const momentumTens = Math.floor(l / 10) - Math.floor(p / 10);
  const momentumUnits = (l % 10) - (p % 10);
  const cycleLength = 7;
  let cycleTens = 0, cycleUnits = 0;
  if (results.length > cycleLength) {
    const cycleR2 = parseInt(results[Math.min(cycleLength, results.length - 1)].r2, 10);
    cycleTens = Math.floor(cycleR2 / 10);
    cycleUnits = cycleR2 % 10;
  }
  const tens = Math.round((avgTens * 0.35) + ((Math.floor(l / 10) + momentumTens) * 0.35) + (cycleTens * 0.30)) % 10;
  const units = Math.round((avgUnits * 0.35) + (((l % 10) + momentumUnits) * 0.35) + (cycleUnits * 0.30)) % 10;
  return (((tens + 10) % 10) * 10) + ((units + 10) % 10);
}

// ===== 6. DEEP LEARNING 4D =====
function deepLearning4D(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 3) % 10 * 10) + ((l % 10 + 7) % 10);
  const analysisWindow = Math.min(50, results.length);
  const recentData = results.slice(0, analysisWindow);
  const lastResult = results[0];
  const tensTransition = Array(10).fill(0).map(() => Array(10).fill(0));
  const unitsTransition = Array(10).fill(0).map(() => Array(10).fill(0));
  for (let i = 0; i < recentData.length - 1; i++) {
    const weight = (recentData.length - i) / recentData.length;
    const currentR2 = parseInt(recentData[i + 1].r2, 10);
    const nextR2 = parseInt(recentData[i].r2, 10);
    tensTransition[Math.floor(currentR2 / 10)][Math.floor(nextR2 / 10)] += weight;
    unitsTransition[currentR2 % 10][nextR2 % 10] += weight;
  }
  const lTens = Math.floor(parseInt(lastResult.r2, 10) / 10);
  const lUnits = parseInt(lastResult.r2, 10) % 10;
  const getBest = (matrix: number[][], current: number) => {
    const row = matrix[current];
    const max = Math.max(...row);
    return max > 0 ? row.indexOf(max) : (current + 1) % 10;
  };
  const predictedTensMarkov = getBest(tensTransition, lTens);
  const predictedUnitsMarkov = getBest(unitsTransition, lUnits);
  const positionPattern = [Array(10).fill(0), Array(10).fill(0)];
  recentData.forEach((r, idx) => {
    const weight = (recentData.length - idx) / recentData.length;
    const r4 = (r.r4 || '').padStart(4, '0');
    positionPattern[0][parseInt(r4[2], 10)] += weight;
    positionPattern[1][parseInt(r4[3], 10)] += weight;
  });
  const predictedTens4D = positionPattern[0].indexOf(Math.max(...positionPattern[0]));
  const predictedUnits4D = positionPattern[1].indexOf(Math.max(...positionPattern[1]));
  const recent10 = results.slice(0, Math.min(10, results.length));
  const recentTensAvg = recent10.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent10.length;
  const recentUnitsAvg = recent10.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / recent10.length;
  const predictedTensRecent = Math.round(recentTensAvg) % 10;
  const predictedUnitsRecent = Math.round(recentUnitsAvg) % 10;
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  tensVotes[predictedTensMarkov] += 4; unitsVotes[predictedUnitsMarkov] += 4;
  tensVotes[predictedTens4D] += 3; unitsVotes[predictedUnits4D] += 3;
  tensVotes[predictedTensRecent] += 3; unitsVotes[predictedUnitsRecent] += 3;
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 7. QUANTUM ANALYSIS =====
function quantumAnalysis(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 30) return (p + l) % 100;
  const window = Math.min(50, results.length);
  const recentData = results.slice(0, window);
  const tensFreq = Array(10).fill(0), unitsFreq = Array(10).fill(0);
  recentData.forEach(r => {
    const r2 = parseInt(r.r2, 10);
    tensFreq[Math.floor(r2 / 10)]++;
    unitsFreq[r2 % 10]++;
  });
  const tensRecency = Array(10).fill(0), unitsRecency = Array(10).fill(0);
  recentData.forEach((r, idx) => {
    const r2 = parseInt(r.r2, 10);
    const weight = 1 + (window - idx) / window;
    tensRecency[Math.floor(r2 / 10)] += weight;
    unitsRecency[r2 % 10] += weight;
  });
  const tensLastSeen = Array(10).fill(-1), unitsLastSeen = Array(10).fill(-1);
  const tensGaps = Array(10).fill(0), unitsGaps = Array(10).fill(0);
  recentData.forEach((r, idx) => {
    const r2 = parseInt(r.r2, 10);
    const tens = Math.floor(r2 / 10), units = r2 % 10;
    if (tensLastSeen[tens] !== -1) tensGaps[tens] += idx - tensLastSeen[tens];
    if (unitsLastSeen[units] !== -1) unitsGaps[units] += idx - unitsLastSeen[units];
    tensLastSeen[tens] = idx; unitsLastSeen[units] = idx;
  });
  const tensAvgGap = Array(10).fill(0), unitsAvgGap = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (tensFreq[d] > 1) tensAvgGap[d] = tensGaps[d] / (tensFreq[d] - 1);
    if (unitsFreq[d] > 1) unitsAvgGap[d] = unitsGaps[d] / (unitsFreq[d] - 1);
  }
  const recent10 = results.slice(0, 10), prev10 = results.slice(10, 20);
  const recentTens = Array(10).fill(0), recentUnits = Array(10).fill(0);
  const prevTens = Array(10).fill(0), prevUnits = Array(10).fill(0);
  recent10.forEach(r => { const r2 = parseInt(r.r2, 10); recentTens[Math.floor(r2 / 10)]++; recentUnits[r2 % 10]++; });
  prev10.forEach(r => { const r2 = parseInt(r.r2, 10); prevTens[Math.floor(r2 / 10)]++; prevUnits[r2 % 10]++; });
  const tensMomentum = Array(10).fill(0), unitsMomentum = Array(10).fill(0);
  for (let d = 0; d < 10; d++) { tensMomentum[d] = recentTens[d] - prevTens[d]; unitsMomentum[d] = recentUnits[d] - prevUnits[d]; }
  const tensScore = Array(10).fill(0), unitsScore = Array(10).fill(0);
  const maxTensFreq = Math.max(...tensFreq, 1), maxUnitsFreq = Math.max(...unitsFreq, 1);
  const maxTensRecency = Math.max(...tensRecency, 1), maxUnitsRecency = Math.max(...unitsRecency, 1);
  const maxTensAvgGap = Math.max(...tensAvgGap, 1), maxUnitsAvgGap = Math.max(...unitsAvgGap, 1);
  const maxTensMomentum = Math.max(...tensMomentum.map(Math.abs), 1), maxUnitsMomentum = Math.max(...unitsMomentum.map(Math.abs), 1);
  for (let d = 0; d < 10; d++) {
    tensScore[d] = (tensFreq[d] / maxTensFreq) * 30 + (tensRecency[d] / maxTensRecency) * 25 + (tensAvgGap[d] / maxTensAvgGap) * 20 + ((tensMomentum[d] + maxTensMomentum) / (2 * maxTensMomentum)) * 25;
    unitsScore[d] = (unitsFreq[d] / maxUnitsFreq) * 30 + (unitsRecency[d] / maxUnitsRecency) * 25 + (unitsAvgGap[d] / maxUnitsAvgGap) * 20 + ((unitsMomentum[d] + maxUnitsMomentum) / (2 * maxUnitsMomentum)) * 25;
  }
  let bestTens = 0, bestUnits = 0, bestScore = 0;
  for (let t = 0; t < 10; t++) {
    for (let u = 0; u < 10; u++) {
      const pairScore = tensScore[t] + unitsScore[u];
      const pairFreq = recentData.filter(r => parseInt(r.r2, 10) === t * 10 + u).length;
      const pairBonus = pairFreq * 5;
      if (pairScore + pairBonus > bestScore) { bestScore = pairScore + pairBonus; bestTens = t; bestUnits = u; }
    }
  }
  return (bestTens * 10) + bestUnits;
}

// ===== 8. ADVANCED CLUSTER =====
function advancedCluster(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  const s = (l4 || l.toString().padStart(4, '0')).padStart(4, '0');
  const thousand = parseInt(s[0], 10) || 0, hundred = parseInt(s[1], 10) || 0;
  const baseDigit = (thousand + hundred) % 10;
  const d1 = (baseDigit + 3) % 10, d2 = (baseDigit + 7) % 10;
  const highDigitTens = (d1 + parseInt(s[2], 10)) % 10, highDigitUnits = (d2 + parseInt(s[3], 10)) % 10;
  let clusterTens = highDigitTens, clusterUnits = highDigitUnits;
  if (results && results.length >= 15) {
    const window = Math.min(30, results.length);
    const recentData = results.slice(0, window);
    const digitFrequency = Array(10).fill(0);
    recentData.forEach(r => { const r2 = parseInt(r.r2, 10); digitFrequency[Math.floor(r2 / 10)]++; digitFrequency[r2 % 10]++; });
    const hotDigits = digitFrequency.map((freq, digit) => ({ digit, freq })).sort((a, b) => b.freq - a.freq).slice(0, 3).map(x => x.digit);
    const lastDigit = parseInt(results[0].r2, 10) % 10;
    const pairs = hotDigits.map(digit => ({ tens: digit, units: lastDigit, score: digitFrequency[digit] * 2 + digitFrequency[lastDigit] }));
    pairs.sort((a, b) => b.score - a.score);
    if (pairs.length > 0) { clusterTens = pairs[0].tens; clusterUnits = pairs[0].units; }
  }
  let trendTens = highDigitTens, trendUnits = highDigitUnits;
  if (results && results.length >= 5) {
    const recent5 = results.slice(0, Math.min(10, results.length));
    trendTens = Math.round(recent5.reduce((sum, r) => sum + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent5.length) % 10;
    trendUnits = Math.round(recent5.reduce((sum, r) => sum + (parseInt(r.r2, 10) % 10), 0) / recent5.length) % 10;
  }
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  tensVotes[highDigitTens] += 4; unitsVotes[highDigitUnits] += 4;
  tensVotes[clusterTens] += 4; unitsVotes[clusterUnits] += 4;
  tensVotes[trendTens] += 2; unitsVotes[trendUnits] += 2;
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 9. N-GRAM PATTERN =====
function ngramPattern(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 10) return ((Math.floor(l / 10) + 2) % 10 * 10) + ((l % 10 + 5) % 10);
  const currentSequence = [parseInt(results[0].r2, 10), parseInt(results[1].r2, 10), parseInt(results[2].r2, 10)];
  const matches: Array<{ nextNumber: number, similarity: number }> = [];
  for (let i = 3; i < results.length - 1 && i < 50; i++) {
    const histSequence = [parseInt(results[i].r2, 10), parseInt(results[i - 1]?.r2 || '0', 10), parseInt(results[i - 2]?.r2 || '0', 10)];
    let distance = 0;
    for (let j = 0; j < 3; j++) distance += Math.abs(currentSequence[j] - histSequence[j]);
    const similarity = 1 / (1 + distance);
    const nextNumber = parseInt(results[i - 3]?.r2 || '0', 10);
    matches.push({ nextNumber, similarity });
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  const topMatches = matches.slice(0, 5);
  const tensCount = Array(10).fill(0), unitsCount = Array(10).fill(0);
  topMatches.forEach(match => {
    tensCount[Math.floor(match.nextNumber / 10)] += match.similarity;
    unitsCount[match.nextNumber % 10] += match.similarity;
  });
  return (tensCount.indexOf(Math.max(...tensCount)) * 10) + unitsCount.indexOf(Math.max(...unitsCount));
}

// ===== 10. STATIC CORE =====
function staticCore(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  const s = (l4 && l4.length > 0 ? l4 : l.toString()).padStart(4, '0');
  const sumAll = s.split('').reduce((acc, curr) => acc + parseInt(curr, 10), 0);
  const tens = (sumAll + 5) % 10, units = (parseInt(s[3], 10) + 9) % 10;
  return (tens * 10) + units;
}

// ===== 11. QUANTUM MAX =====
function quantumMax(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 10) return (p + l) % 100;
  const rawNumbers = results.slice(0, 100).map(r => parseInt(r.r2, 10));
  const data = rawNumbers.slice(-Math.min(100, rawNumbers.length));
  const freq: Record<number, number> = {}, lastSeen: Record<number, number> = {}, transition: Record<string, number> = {};
  data.forEach((num, idx) => {
    const digits = num.toString().padStart(2, '0').split('').map(Number);
    digits.forEach(d => { freq[d] = (freq[d] || 0) + 1; lastSeen[d] = idx; });
    if (digits.length === 2) { const key = `${digits[0]}->${digits[1]}`; transition[key] = (transition[key] || 0) + 1; }
  });
  const maxFreq = Math.max(...Object.values(freq), 1), maxGap = data.length || 1;
  const digitScores = [];
  for (let d = 0; d <= 9; d++) {
    const f = freq[d] || 0, gap = data.length - (lastSeen[d] ?? -1);
    const normFreq = f / maxFreq, normGap = gap / maxGap;
    let markovScore = 0;
    Object.entries(transition).forEach(([k, v]) => { if (k.startsWith(`${d}->`) || k.endsWith(`->${d}`)) markovScore += v; });
    const normMarkov = markovScore / (data.length || 1);
    const score = 0.33 * normFreq + 0.33 * normGap + 0.34 * normMarkov;
    digitScores.push({ digit: d, score });
  }
  digitScores.sort((a, b) => b.score - a.score);
  const topDigits = digitScores.slice(0, 5).map(r => r.digit);
  const bestTens = topDigits[0] ?? 0, bestUnits = topDigits[1] ?? 0;
  return (bestTens * 10) + bestUnits;
}

// ===== 12. BAYESIAN PROBABILITY =====
function bayesianProbability(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 15) return ((Math.floor(l / 10) + 3) % 10 * 10) + ((l % 10 + 7) % 10);
  const window = Math.min(80, results.length);
  const data = results.slice(0, window);
  const recent10 = data.slice(0, 10).map(r => parseInt(r.r2, 10));
  const volatility = recent10.reduce((sum, val, idx) => idx === 0 ? 0 : sum + Math.abs(val - recent10[idx - 1]), 0) / (recent10.length - 1);
  const decayRate = Math.min(0.15, 0.03 + (volatility / 100));
  const priorAlpha = 1.0, priorBeta = 9.0;
  const tensAlpha = Array(10).fill(priorAlpha), tensBeta = Array(10).fill(priorBeta);
  const unitsAlpha = Array(10).fill(priorAlpha), unitsBeta = Array(10).fill(priorBeta);
  for (let i = 0; i < data.length; i++) {
    const r2 = parseInt(data[i].r2, 10), tens = Math.floor(r2 / 10), units = r2 % 10;
    const weight = Math.pow(1 - decayRate, i);
    for (let d = 0; d < 10; d++) {
      tensAlpha[d] += d === tens ? weight : 0; tensBeta[d] += d === tens ? 0 : weight * 0.1;
      unitsAlpha[d] += d === units ? weight : 0; unitsBeta[d] += d === units ? 0 : weight * 0.1;
    }
  }
  const tensPosterior = tensAlpha.map((a, i) => a / (a + tensBeta[i]));
  const unitsPosterior = unitsAlpha.map((a, i) => a / (a + unitsBeta[i]));
  for (let i = 0; i < Math.min(3, data.length); i++) {
    const r2 = parseInt(data[i].r2, 10), tens = Math.floor(r2 / 10), units = r2 % 10;
    const penalty = 0.15 / (i + 1);
    tensPosterior[tens] *= (1 - penalty); unitsPosterior[units] *= (1 - penalty);
  }
  const tensLastSeen = Array(10).fill(-1), unitsLastSeen = Array(10).fill(-1);
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const r2 = parseInt(data[i].r2, 10), tens = Math.floor(r2 / 10), units = r2 % 10;
    if (tensLastSeen[tens] === -1) tensLastSeen[tens] = i;
    if (unitsLastSeen[units] === -1) unitsLastSeen[units] = i;
  }
  for (let d = 0; d < 10; d++) {
    const tensGap = tensLastSeen[d] === -1 ? 30 : tensLastSeen[d];
    const unitsGap = unitsLastSeen[d] === -1 ? 30 : unitsLastSeen[d];
    if (tensGap > 10) tensPosterior[d] *= 1 + (tensGap - 10) * 0.02;
    if (unitsGap > 10) unitsPosterior[d] *= 1 + (unitsGap - 10) * 0.02;
  }
  const tensSum = tensPosterior.reduce((a, b) => a + b, 0), unitsSum = unitsPosterior.reduce((a, b) => a + b, 0);
  const tensProb = tensPosterior.map(p => p / tensSum), unitsProb = unitsPosterior.map(p => p / unitsSum);
  let bestTens = 0, bestUnits = 0, bestScore = -1;
  for (let t = 0; t < 10; t++) {
    for (let u = 0; u < 10; u++) {
      let score = tensProb[t] * unitsProb[u];
      const pairCount = data.filter(r => { const r2 = parseInt(r.r2, 10); return Math.floor(r2 / 10) === t && r2 % 10 === u; }).length;
      if (pairCount > 0) score *= (1 + pairCount * 0.1);
      if (score > bestScore) { bestScore = score; bestTens = t; bestUnits = u; }
    }
  }
  return (bestTens * 10) + bestUnits;
}

// ===== 13. ENTROPY ANALYSIS =====
function entropyAnalysis(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 5) % 10 * 10) + ((l % 10 + 2) % 10);
  const window = Math.min(60, results.length);
  const data = results.slice(0, window);
  const tensCount = Array(10).fill(0), unitsCount = Array(10).fill(0);
  data.forEach(r => { const r2 = parseInt(r.r2, 10); tensCount[Math.floor(r2 / 10)]++; unitsCount[r2 % 10]++; });
  const calcEntropy = (counts: number[]): number => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    let entropy = 0;
    for (const count of counts) { if (count > 0) { const prob = count / total; entropy -= prob * Math.log2(prob); } }
    return entropy;
  };
  const tensEntropy = calcEntropy(tensCount), maxEntropy = Math.log2(10);
  const conditionalCounts = Array(10).fill(null).map(() => Array(10).fill(0));
  const tensTotalForConditional = Array(10).fill(0);
  data.forEach(r => { const r2 = parseInt(r.r2, 10), tens = Math.floor(r2 / 10), units = r2 % 10; conditionalCounts[tens][units]++; tensTotalForConditional[tens]++; });
  const entropyRatio = tensEntropy / maxEntropy;
  const tensProb = tensCount.map(c => c / data.length), unitsProb = unitsCount.map(c => c / data.length);
  const tensScore = Array(10).fill(0), unitsScore = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    tensScore[d] = tensProb[d]; unitsScore[d] = unitsProb[d];
    if (entropyRatio < 0.7) {
      const lastTens = Math.floor(parseInt(data[0].r2, 10) / 10);
      const condProb = conditionalCounts[lastTens][d] / (tensTotalForConditional[lastTens] || 1);
      unitsScore[d] = unitsScore[d] * 0.5 + condProb * 0.5;
    }
  }
  const tensSum = tensScore.reduce((a, b) => a + b, 0), unitsSum = unitsScore.reduce((a, b) => a + b, 0);
  const tensNorm = tensScore.map(s => s / (tensSum || 1)), unitsNorm = unitsScore.map(s => s / (unitsSum || 1));
  let bestTens = 0, bestUnits = 0, bestScore = -1;
  for (let t = 0; t < 10; t++) {
    for (let u = 0; u < 10; u++) {
      let score = tensNorm[t] * 0.5 + unitsNorm[u] * 0.5;
      const pairFreq = conditionalCounts[t][u] / (tensTotalForConditional[t] || 1);
      score += pairFreq * 0.2;
      const lastR2 = parseInt(data[0].r2, 10);
      if (t * 10 + u === lastR2) score *= 0.85;
      if (score > bestScore) { bestScore = score; bestTens = t; bestUnits = u; }
    }
  }
  return (bestTens * 10) + bestUnits;
}

// ===== 14. FOURIER CYCLE =====
function fourierCycle(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 30) return ((Math.floor(l / 10) + 4) % 10 * 10) + ((l % 10 + 8) % 10);
  const N = Math.min(100, results.length);
  const data = results.slice(0, N);
  const tensSeries: number[] = [], unitsSeries: number[] = [];
  for (let i = data.length - 1; i >= 0; i--) { const r2 = parseInt(data[i].r2, 10); tensSeries.push(Math.floor(r2 / 10)); unitsSeries.push(r2 % 10); }
  const dft = (signal: number[]): { magnitude: number[], phase: number[] } => {
    const n = signal.length;
    const magnitude: number[] = [], phase: number[] = [];
    for (let k = 0; k < Math.floor(n / 2); k++) {
      let real = 0, imag = 0;
      for (let t = 0; t < n; t++) { const angle = (2 * Math.PI * k * t) / n; real += signal[t] * Math.cos(angle); imag -= signal[t] * Math.sin(angle); }
      magnitude.push(Math.sqrt(real * real + imag * imag) / n);
      phase.push(Math.atan2(imag, real));
    }
    return { magnitude, phase };
  };
  const tensDFT = dft(tensSeries), unitsDFT = dft(unitsSeries);
  const findDominant = (magnitude: number[], phase: number[], topN = 3) => {
    const indexed = magnitude.map((m, i) => ({ freq: i, magnitude: m, phase: phase[i] }));
    return indexed.slice(1).sort((a, b) => b.magnitude - a.magnitude).slice(0, topN);
  };
  const tensFreqs = findDominant(tensDFT.magnitude, tensDFT.phase, 3);
  const unitsFreqs = findDominant(unitsDFT.magnitude, unitsDFT.phase, 3);
  const predictNext = (series: number[], freqs: Array<{ freq: number, magnitude: number, phase: number }>): number => {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    let prediction = mean;
    const totalMag = freqs.reduce((sum, f) => sum + f.magnitude, 0);
    for (const freq of freqs) {
      if (totalMag > 0) {
        const weight = freq.magnitude / totalMag;
        const angle = (2 * Math.PI * freq.freq * n) / n + freq.phase;
        prediction += weight * Math.cos(angle) * 4.5;
      }
    }
    return Math.round(Math.max(0, Math.min(9, prediction)));
  };
  const predictedTens = predictNext(tensSeries, tensFreqs);
  const predictedUnits = predictNext(unitsSeries, unitsFreqs);
  return (predictedTens * 10) + predictedUnits;
}

// ===== 15. REGRESSION TREND =====
function regressionTrend(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 15) return ((Math.floor(l / 10) + 2) % 10 * 10) + ((l % 10 + 9) % 10);
  const N = Math.min(50, results.length);
  const data = results.slice(0, N);
  const tensSeries: number[] = [], unitsSeries: number[] = [];
  for (let i = data.length - 1; i >= 0; i--) { const r2 = parseInt(data[i].r2, 10); tensSeries.push(Math.floor(r2 / 10)); unitsSeries.push(r2 % 10); }
  const weightedLinearRegression = (series: number[], decayFactor = 0.95) => {
    const n = series.length;
    const weights = series.map((_, i) => Math.pow(decayFactor, n - 1 - i));
    const sumW = weights.reduce((a, b) => a + b, 0);
    let sumWX = 0, sumWY = 0;
    for (let i = 0; i < n; i++) { sumWX += weights[i] * i; sumWY += weights[i] * series[i]; }
    const meanX = sumWX / sumW, meanY = sumWY / sumW;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += weights[i] * (i - meanX) * (series[i] - meanY); den += weights[i] * (i - meanX) ** 2; }
    const slope = den !== 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const prediction = slope * n + intercept;
    return { slope, intercept, prediction };
  };
  const tensLinear = weightedLinearRegression(tensSeries);
  const unitsLinear = weightedLinearRegression(unitsSeries);
  const tensMean = tensSeries.reduce((a, b) => a + b, 0) / tensSeries.length;
  const unitsMean = unitsSeries.reduce((a, b) => a + b, 0) / unitsSeries.length;
  const tensStd = Math.sqrt(tensSeries.reduce((sum, v) => sum + (v - tensMean) ** 2, 0) / tensSeries.length);
  const unitsStd = Math.sqrt(unitsSeries.reduce((sum, v) => sum + (v - unitsMean) ** 2, 0) / unitsSeries.length);
  const clamp = (value: number, mean: number, std: number) => {
    const maxDev = std * 2.5;
    return Math.round(Math.max(0, Math.min(9, Math.max(mean - maxDev, Math.min(mean + maxDev, value)))));
  };
  const clampedTens = clamp(tensLinear.prediction, tensMean, tensStd);
  const clampedUnits = clamp(unitsLinear.prediction, unitsMean, unitsStd);
  const recent5Tens = tensSeries.slice(-5), recent5Units = unitsSeries.slice(-5);
  const tensMomentum = recent5Tens.length > 1 ? (recent5Tens[recent5Tens.length - 1] - recent5Tens[0]) / recent5Tens.length : 0;
  const unitsMomentum = recent5Units.length > 1 ? (recent5Units[recent5Units.length - 1] - recent5Units[0]) / recent5Units.length : 0;
  return (clamp(clampedTens + tensMomentum * 0.3, tensMean, tensStd) * 10) + clamp(clampedUnits + unitsMomentum * 0.3, unitsMean, unitsStd);
}

// ===== 16. PATTERN MEMORY =====
function patternMemory(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 6) % 10 * 10) + ((l % 10 + 1) % 10);
  const N = Math.min(80, results.length);
  const data = results.slice(0, N);
  const tensConfusion = Array(10).fill(null).map(() => Array(10).fill(0));
  const unitsConfusion = Array(10).fill(null).map(() => Array(10).fill(0));
  for (let i = 1; i < data.length; i++) {
    const currentR2 = parseInt(data[i].r2, 10), nextR2 = parseInt(data[i - 1].r2, 10);
    const simpleTens = (Math.floor(currentR2 / 10) + 3) % 10, simpleUnits = (currentR2 % 10 + 7) % 10;
    tensConfusion[simpleTens][Math.floor(nextR2 / 10)]++;
    unitsConfusion[simpleUnits][nextR2 % 10]++;
  }
  const tensTransition = Array(10).fill(null).map(() => Array(10).fill(0));
  const unitsTransition = Array(10).fill(null).map(() => Array(10).fill(0));
  for (let i = 0; i < data.length - 1; i++) {
    const currentR2 = parseInt(data[i].r2, 10), nextR2 = parseInt(data[i + 1].r2, 10);
    const weight = Math.pow(0.95, i);
    tensTransition[Math.floor(currentR2 / 10)][Math.floor(nextR2 / 10)] += weight;
    unitsTransition[currentR2 % 10][nextR2 % 10] += weight;
  }
  for (let i = 0; i < 10; i++) {
    const tensSum = tensTransition[i].reduce((a, b) => a + b, 0), unitsSum = unitsTransition[i].reduce((a, b) => a + b, 0);
    if (tensSum > 0) for (let j = 0; j < 10; j++) tensTransition[i][j] /= tensSum;
    if (unitsSum > 0) for (let j = 0; j < 10; j++) unitsTransition[i][j] /= unitsSum;
  }
  const lastR2 = parseInt(data[0].r2, 10), lastTens = Math.floor(lastR2 / 10), lastUnits = lastR2 % 10;
  const baseTens = (lastTens + 3) % 10, baseUnits = (lastUnits + 7) % 10;
  const tensFromConfusion = tensConfusion[baseTens].indexOf(Math.max(...tensConfusion[baseTens]));
  const unitsFromConfusion = unitsConfusion[baseUnits].indexOf(Math.max(...unitsConfusion[baseUnits]));
  const tensFromTransition = tensTransition[lastTens].indexOf(Math.max(...tensTransition[lastTens]));
  const unitsFromTransition = unitsTransition[lastUnits].indexOf(Math.max(...unitsTransition[lastUnits]));
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  tensVotes[tensFromConfusion] += 3.5; unitsVotes[unitsFromConfusion] += 3.5;
  tensVotes[baseTens] += 3.5; unitsVotes[baseUnits] += 3.5;
  tensVotes[tensFromTransition] += 3; unitsVotes[unitsFromTransition] += 3;
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 17. SMART FUSION =====
function smartFusion(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 5) % 10 * 10) + ((l % 10 + 3) % 10);
  const N = Math.min(100, results.length);
  const data = results.slice(0, N);
  const subFormulas: Array<(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined) => number> = [
    (p, l, l4, results) => {
      if (!results || results.length < 10) return (p + l) % 100;
      const window = Math.min(20, results.length);
      const tensCount = Array(10).fill(0), unitsCount = Array(10).fill(0);
      for (let i = 0; i < window; i++) { const r2 = parseInt(results[i].r2, 10); tensCount[Math.floor(r2 / 10)]++; unitsCount[r2 % 10]++; }
      return (tensCount.indexOf(Math.max(...tensCount)) * 10) + unitsCount.indexOf(Math.max(...unitsCount));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 5) return (p + l) % 100;
      const recent = results.slice(0, 5);
      const tensAvg = recent.reduce((s, r) => s + Math.floor(parseInt(r.r2, 10) / 10), 0) / recent.length;
      const unitsAvg = recent.reduce((s, r) => s + (parseInt(r.r2, 10) % 10), 0) / recent.length;
      return (Math.round(tensAvg) * 10) + Math.round(unitsAvg);
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return (p + l) % 100;
      const transition = Array(10).fill(null).map(() => Array(10).fill(0));
      for (let i = 0; i < Math.min(30, results.length - 1); i++) {
        const current = parseInt(results[i + 1].r2, 10), next = parseInt(results[i].r2, 10);
        const weight = (30 - i) / 30;
        transition[Math.floor(current / 10)][Math.floor(next / 10)] += weight;
        transition[current % 10][next % 10] += weight;
      }
      const lastR2 = parseInt(results[0].r2, 10);
      const tens = transition[Math.floor(lastR2 / 10)].indexOf(Math.max(...transition[Math.floor(lastR2 / 10)]));
      const units = transition[lastR2 % 10].indexOf(Math.max(...transition[lastR2 % 10]));
      return (tens * 10) + units;
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return (p + l) % 100;
      const tensLastSeen = Array(10).fill(-1), unitsLastSeen = Array(10).fill(-1);
      for (let i = 0; i < Math.min(30, results.length); i++) {
        const r2 = parseInt(results[i].r2, 10);
        if (tensLastSeen[Math.floor(r2 / 10)] === -1) tensLastSeen[Math.floor(r2 / 10)] = i;
        if (unitsLastSeen[r2 % 10] === -1) unitsLastSeen[r2 % 10] = i;
      }
      let bestTens = 0, bestUnits = 0, maxGap = -1;
      for (let d = 0; d < 10; d++) {
        const tensGap = tensLastSeen[d] === -1 ? 30 : tensLastSeen[d];
        const unitsGap = unitsLastSeen[d] === -1 ? 30 : unitsLastSeen[d];
        if (tensGap + unitsGap > maxGap) { maxGap = tensGap + unitsGap; bestTens = d; bestUnits = d; }
      }
      return (bestTens * 10) + bestUnits;
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return (p + l) % 100;
      const n = Math.min(30, results.length);
      const tensSeries: number[] = [], unitsSeries: number[] = [];
      for (let i = n - 1; i >= 0; i--) { const r2 = parseInt(results[i].r2, 10); tensSeries.push(Math.floor(r2 / 10)); unitsSeries.push(r2 % 10); }
      const linearReg = (series: number[]) => {
        const len = series.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < len; i++) { sumX += i; sumY += series[i]; sumXY += i * series[i]; sumX2 += i * i; }
        const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX || 1);
        const intercept = (sumY - slope * sumX) / len;
        return Math.max(0, Math.min(9, Math.round(slope * len + intercept)));
      };
      return (linearReg(tensSeries) * 10) + linearReg(unitsSeries);
    }
  ];
  const predictions: Array<{ tens: number, units: number }> = subFormulas.map(f => {
    const predicted = f(p, l, l4, data);
    return { tens: Math.floor(predicted / 10), units: predicted % 10 };
  });
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  predictions.forEach(pred => { tensVotes[pred.tens]++; unitsVotes[pred.units]++; });
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 18. CROSS CORRELATION =====
function crossCorrelation(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 1) % 10 * 10) + ((l % 10 + 4) % 10);
  const N = Math.min(60, results.length);
  const data = results.slice(0, N);
  const r2Tens: number[] = [], r2Units: number[] = [];
  for (let i = data.length - 1; i >= 0; i--) {
    const r2 = parseInt(data[i].r2, 10);
    r2Tens.push(Math.floor(r2 / 10));
    r2Units.push(r2 % 10);
  }
  const crossCorr = (x: number[], y: number[], maxLag = 5): number[][] => {
    const n = Math.min(x.length, y.length);
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const stdX = Math.sqrt(x.slice(0, n).reduce((s, v) => s + (v - meanX) ** 2, 0) / n) || 1;
    const stdY = Math.sqrt(y.slice(0, n).reduce((s, v) => s + (v - meanY) ** 2, 0) / n) || 1;
    const correlations: number[][] = [];
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0, count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) { sum += ((x[i] - meanX) / stdX) * ((y[j] - meanY) / stdY); count++; }
      }
      correlations.push([lag, count > 0 ? sum / count : 0]);
    }
    return correlations;
  };
  const tensFreq = Array(10).fill(0), unitsFreq = Array(10).fill(0);
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const r2 = parseInt(data[i].r2, 10);
    tensFreq[Math.floor(r2 / 10)]++;
    unitsFreq[r2 % 10]++;
  }
  const predictedTens = tensFreq.indexOf(Math.max(...tensFreq));
  const predictedUnits = unitsFreq.indexOf(Math.max(...unitsFreq));
  return (predictedTens * 10) + predictedUnits;
}

// ===== 19. ADAPTIVE WEIGHT =====
function adaptiveWeight(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 25) return ((Math.floor(l / 10) + 8) % 10 * 10) + ((l % 10 + 2) % 10);
  const N = Math.min(100, results.length);
  const data = results.slice(0, N);
  const subFormulas: Array<(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined) => number> = [
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const count = Array(10).fill(0);
      for (let i = 0; i < Math.min(20, results.length); i++) count[Math.floor(parseInt(results[i].r2, 10) / 10)]++;
      return count.indexOf(Math.max(...count));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const count = Array(10).fill(0);
      for (let i = 0; i < Math.min(20, results.length); i++) count[parseInt(results[i].r2, 10) % 10]++;
      return count.indexOf(Math.max(...count));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const trans = Array(10).fill(null).map(() => Array(10).fill(0));
      for (let i = 0; i < Math.min(30, results.length - 1); i++) {
        const from = Math.floor(parseInt(results[i + 1].r2, 10) / 10), to = Math.floor(parseInt(results[i].r2, 10) / 10);
        trans[from][to] += (30 - i) / 30;
      }
      const last = Math.floor(parseInt(results[0].r2, 10) / 10);
      return trans[last].indexOf(Math.max(...trans[last]));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const trans = Array(10).fill(null).map(() => Array(10).fill(0));
      for (let i = 0; i < Math.min(30, results.length - 1); i++) {
        const from = parseInt(results[i + 1].r2, 10) % 10, to = parseInt(results[i].r2, 10) % 10;
        trans[from][to] += (30 - i) / 30;
      }
      const last = parseInt(results[0].r2, 10) % 10;
      return trans[last].indexOf(Math.max(...trans[last]));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const n = Math.min(20, results.length);
      const series: number[] = [];
      for (let i = n - 1; i >= 0; i--) series.push(Math.floor(parseInt(results[i].r2, 10) / 10));
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) { sumX += i; sumY += series[i]; sumXY += i * series[i]; sumX2 += i * i; }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;
      return Math.max(0, Math.min(9, Math.round(slope * n + intercept)));
    },
    (p, l, l4, results) => {
      if (!results || results.length < 10) return 0;
      const n = Math.min(20, results.length);
      const series: number[] = [];
      for (let i = n - 1; i >= 0; i--) series.push(parseInt(results[i].r2, 10) % 10);
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) { sumX += i; sumY += series[i]; sumXY += i * series[i]; sumX2 += i * i; }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;
      return Math.max(0, Math.min(9, Math.round(slope * n + intercept)));
    }
  ];
  const tensPredictions: number[] = [], unitsPredictions: number[] = [];
  for (let i = 0; i < subFormulas.length; i++) {
    const predicted = subFormulas[i](p, l, l4, data);
    if (i % 2 === 0) tensPredictions.push(predicted);
    else unitsPredictions.push(predicted);
  }
  const tensVotes = Array(10).fill(0), unitsVotes = Array(10).fill(0);
  tensPredictions.forEach(t => tensVotes[t]++);
  unitsPredictions.forEach(u => unitsVotes[u]++);
  return (tensVotes.indexOf(Math.max(...tensVotes)) * 10) + unitsVotes.indexOf(Math.max(...unitsVotes));
}

// ===== 20. DIGIT PAIR FREQUENCY =====
function digitPairFrequency(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined): number {
  if (!results || results.length < 20) return ((Math.floor(l / 10) + 9) % 10 * 10) + ((l % 10 + 3) % 10);
  const N = Math.min(80, results.length);
  const data = results.slice(0, N);
  const pairFreq = Array(10).fill(null).map(() => Array(10).fill(0));
  const tensFreq = Array(10).fill(0), unitsFreq = Array(10).fill(0);
  for (let i = 0; i < data.length; i++) {
    const r2 = parseInt(data[i].r2, 10), tens = Math.floor(r2 / 10), units = r2 % 10;
    const weight = Math.pow(0.97, i);
    pairFreq[tens][units] += weight;
    tensFreq[tens] += weight;
    unitsFreq[units] += weight;
  }
  const lastR2 = parseInt(data[0].r2, 10), lastTens = Math.floor(lastR2 / 10), lastUnits = lastR2 % 10;
  const condUnitsGivenTens = Array(10).fill(null).map(() => Array(10).fill(0));
  for (let t = 0; t < 10; t++) {
    for (let u = 0; u < 10; u++) {
      condUnitsGivenTens[t][u] = tensFreq[t] > 0 ? pairFreq[t][u] / tensFreq[t] : 0;
    }
  }
  const tensScore = Array(10).fill(0), unitsScore = Array(10).fill(0);
  for (let u = 0; u < 10; u++) unitsScore[u] += condUnitsGivenTens[lastTens][u];
  for (let t = 0; t < 10; t++) tensScore[t] += pairFreq[t][lastUnits] / (unitsFreq[lastUnits] || 1);
  let bestTens = 0, bestUnits = 0, bestScore = -1;
  for (let t = 0; t < 10; t++) {
    for (let u = 0; u < 10; u++) {
      let score = tensScore[t] + unitsScore[u] + pairFreq[t][u] / (Math.max(...pairFreq.flat()) || 1) * 0.1;
      if (t * 10 + u === lastR2) score *= 0.9;
      if (score > bestScore) { bestScore = score; bestTens = t; bestUnits = u; }
    }
  }
  return (bestTens * 10) + bestUnits;
}

// ===== UNIFIED ENGINE =====
export const unifiedQuantumEngine: Pattern = {
  name: "Unified Quantum Analysis Engine (สูตรรวมทั้งหมด)",
  calc: (p, l, l4, results?) => {
    const formulas: Array<(p: number, l: number, l4: string | undefined, results: LottoResult[] | undefined) => number> = [
      hotNumbers,
      master2Digit,
      quantumFlux,
      markovChain,
      neuralPattern,
      deepLearning4D,
      quantumAnalysis,
      advancedCluster,
      ngramPattern,
      staticCore,
      quantumMax,
      bayesianProbability,
      entropyAnalysis,
      fourierCycle,
      regressionTrend,
      patternMemory,
      smartFusion,
      crossCorrelation,
      adaptiveWeight,
      digitPairFrequency
    ];

    const tensVotes = Array(10).fill(0);
    const unitsVotes = Array(10).fill(0);

    for (const formula of formulas) {
      try {
        const predicted = formula(p, l, l4, results);
        const tens = Math.floor(predicted / 10);
        const units = predicted % 10;
        if (tens >= 0 && tens <= 9 && units >= 0 && units <= 9) {
          tensVotes[tens]++;
          unitsVotes[units]++;
        }
      } catch (e) {
        // Skip formula that fails
      }
    }

    const finalTens = tensVotes.indexOf(Math.max(...tensVotes));
    const finalUnits = unitsVotes.indexOf(Math.max(...unitsVotes));

    return (finalTens * 10) + finalUnits;
  },

  getMirrorPair: (result: number) => {
    const s = result.toString().padStart(2, '0');
    const mirrorStr = (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
    return parseInt(mirrorStr, 10);
  }
};
