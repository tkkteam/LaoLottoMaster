type Draw = string;

export function getHotDigits(history: Draw[]) {
  const freq = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  history.forEach((num, i) => {
    num.split("").forEach(d => {
      freq.set(d, (freq.get(d) || 0) + 1);
      lastSeen.set(d, i);
    });
  });

  const scores: { digit: string; score: number }[] = [];

  for (let d = 0; d <= 9; d++) {
    const digit = d.toString();

    const f = freq.get(digit) || 0;
    const r = history.length - (lastSeen.get(digit) || 0);

    const score = f * 0.6 + r * 0.4;

    scores.push({ digit, score });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, 5);
}