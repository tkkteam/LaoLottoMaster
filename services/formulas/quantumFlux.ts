import { Pattern } from '../../types';

export const quantumFluxFormula: Pattern = {
  name: "Quantum Flux (สูตรไหล)",
  calc: (p, l) => {
    const p1 = Math.floor(p / 10);
    const p2 = p % 10;
    const l1 = Math.floor(l / 10);
    const l2 = l % 10;
    const tens = (p1 + l1 + 7) % 10;
    const units = (p2 + l2 + 1) % 10;
    return (tens * 10) + units;
  }
};
