import { Pattern, LottoResult } from '../../types';

/**
 * UNIFIED 3D PREDICTION ENGINE
 * ระบบวิเคราะห์ 3 ตัวตรงแบบ Ensemble (รวม 5 สูตรย่อย)
 */

// 1. Frequency Analyzer (30%) - วิเคราะห์ความถี่ตัวเลขที่ออกบ่อย
const freq3D = (results: LottoResult[]): Record<string, number> => {
  const scores: Record<string, number> = {};
  results.slice(0, 100).forEach((r, idx) => {
    const weight = (100 - idx) / 100;
    r.r3.split('').forEach(digit => {
      scores[digit] = (scores[digit] || 0) + weight;
    });
  });
  return scores;
};

// 2. Markov 3D (25%) - วิเคราะห์การเปลี่ยนผ่านของเลขหลักร้อย->สิบ->หน่วย
const markov3D = (results: LottoResult[]): Record<string, number> => {
  const matrix: Record<string, Record<string, number>> = {};
  results.slice(0, 150).forEach(r => {
    const d = r.r3.split('');
    if (!matrix[d[0]]) matrix[d[0]] = {};
    matrix[d[0]][d[1]] = (matrix[d[0]][d[1]] || 0) + 1;
    if (!matrix[d[1]]) matrix[d[1]] = {};
    matrix[d[1]][d[2]] = (matrix[d[1]][d[2]] || 0) + 1;
  });
  
  const scores: Record<string, number> = {};
  for (let i = 0; i < 1000; i++) {
    const s = i.toString().padStart(3, '0');
    const p1 = (matrix[s[0]]?.[s[1]] || 0.1);
    const p2 = (matrix[s[1]]?.[s[2]] || 0.1);
    scores[s] = p1 * p2;
  }
  return scores;
};

// 3. Gap Analyzer (20%) - วิเคราะห์เลขที่หายไปนาน (เลขเย็น)
const gap3D = (results: LottoResult[]): Record<string, number> => {
  const scores: Record<string, number> = {};
  for (let d = 0; d < 10; d++) {
    const s = d.toString();
    const lastIdx = results.findIndex(r => r.r3.includes(s));
    scores[s] = lastIdx === -1 ? 50 : lastIdx;
  }
  return scores;
};

// 4. Position Pattern (15%) - วิเคราะห์สถิติแยกตามตำแหน่ง (หลักร้อย, หลักสิบ, หลักหน่วย)
const position3D = (results: LottoResult[]): Record<number, Record<string, number>> => {
  const pos: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {} };
  results.slice(0, 50).forEach((r, idx) => {
    const weight = (50 - idx) / 50;
    const d = r.r3.split('');
    pos[0][d[0]] = (pos[0][d[0]] || 0) + weight;
    pos[1][d[1]] = (pos[1][d[1]] || 0) + weight;
    pos[2][d[2]] = (pos[2][d[2]] || 0) + weight;
  });
  return pos;
};

export const unified3DEngine: Pattern = {
  name: "Unified 3D Engine (รวมพลัง 3 ตัวตรง)",
  calc: (p, l, l4, results?) => {
    // Return 2 digits for leaderboard compatibility
    if (!results) return 0;
    const triple = unified3DEngine.getTriple!(results);
    return parseInt(triple.slice(1), 10);
  },

  getTriple: (results: LottoResult[]): string => {
    if (!results || results.length < 10) return "000";

    const fScores = freq3D(results);
    const mScores = markov3D(results);
    const gScores = gap3D(results);
    const pScores = position3D(results);
    
    // Last drawn to avoid/penalize
    const lastR3 = results[0].r3;
    const recent3s = results.slice(0, 5).map(r => r.r3);

    const candidates: Array<{ num: string, score: number }> = [];
    
    for (let i = 0; i < 1000; i++) {
      const s = i.toString().padStart(3, '0');
      const d = s.split('');
      
      // 1. Freq Score
      let freqScore = (fScores[d[0]] || 0) + (fScores[d[1]] || 0) + (fScores[d[2]] || 0);
      
      // 2. Markov Score
      let markovScore = mScores[s] || 0;
      
      // 3. Gap Score
      let gapScore = (gScores[d[0]] || 0) + (gScores[d[1]] || 0) + (gScores[d[2]] || 0);
      
      // 4. Position Score
      let posScore = (pScores[0][d[0]] || 0) + (pScores[1][d[1]] || 0) + (pScores[2][d[2]] || 0);
      
      // Normalizing and Weighing
      let finalScore = 
        (freqScore * 0.30) + 
        (markovScore * 10) + // Scale Markov up
        (gapScore * 0.15) + 
        (posScore * 0.25);

      // Penalties & Bonuses
      if (recent3s.includes(s)) finalScore *= 0.1; // Don't repeat recent 3D
      if (s[0] === s[1] && s[1] === s[2]) finalScore *= 0.5; // Triple numbers (low prob)
      if (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]) finalScore *= 1.2; // Double numbers (medium prob)
      
      // Sequence penalty (e.g. 123, 789)
      if ("0123456789".includes(s) || "9876543210".includes(s)) finalScore *= 0.7;

      candidates.push({ num: s, score: finalScore });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].num;
  }
};
