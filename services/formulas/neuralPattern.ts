import { Pattern } from '../../types';

export const neuralPatternFormula: Pattern = {
  name: "Neural Pattern (รูปแบบประสาท)",
  calc: (p, l, l4, results?) => {
    // Neural-inspired pattern: ใช้หลายปัจจัยร่วมกัน
    if (!results || results.length < 15) {
      const tens = (Math.floor(l / 10) + Math.floor(p / 10) + 6) % 10;
      const units = ((l % 10) + (p % 10) + 4) % 10;
      return (tens * 10) + units;
    }

    // Factor 1: Recent trend (last 5 draws)
    const recentTens: number[] = [];
    const recentUnits: number[] = [];
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const r2 = parseInt(results[i].r2, 10);
      recentTens.push(Math.floor(r2 / 10));
      recentUnits.push(r2 % 10);
    }

    const avgTens = recentTens.reduce((a, b) => a + b, 0) / recentTens.length;
    const avgUnits = recentUnits.reduce((a, b) => a + b, 0) / recentUnits.length;

    // Factor 2: Momentum (direction of change)
    const momentumTens = Math.floor(l / 10) - Math.floor(p / 10);
    const momentumUnits = (l % 10) - (p % 10);

    // Factor 3: Cycle detection (look for repeating patterns)
    const cycleLength = 7; // Weekly cycle assumption
    let cycleTens = 0, cycleUnits = 0;
    if (results.length > cycleLength) {
      const cycleR2 = parseInt(results[Math.min(cycleLength, results.length - 1)].r2, 10);
      cycleTens = Math.floor(cycleR2 / 10);
      cycleUnits = cycleR2 % 10;
    }

    // Combine factors with different weights
    const tens = Math.round(
      (avgTens * 0.35) +
      ((Math.floor(l / 10) + momentumTens) * 0.35) +
      (cycleTens * 0.30)
    ) % 10;

    const units = Math.round(
      (avgUnits * 0.35) +
      ((l % 10) + momentumUnits) * 0.35 +
      (cycleUnits * 0.30)
    ) % 10;

    return ((tens + 10) % 10 * 10) + ((units + 10) % 10);
  }
};
