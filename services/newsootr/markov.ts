export class MarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map();

  train(data: string[]) {
    data.forEach(num => {
      const digits = num.split("");
      for (let i = 0; i < digits.length - 1; i++) {
        const current = digits[i];
        const next = digits[i + 1];

        if (!this.transitions.has(current)) {
          this.transitions.set(current, new Map());
        }

        const map = this.transitions.get(current)!;
        map.set(next, (map.get(next) || 0) + 1);
      }
    });
  }

  getProbability(a: string, b: string): number {
    const map = this.transitions.get(a);
    if (!map) return 0;

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return (map.get(b) || 0) / total;
  }
}