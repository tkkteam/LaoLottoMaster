import { Pattern } from '../../types';

export const staticCoreFormula: Pattern = {
  name: "Static Core (สูตรนิ่ง)",
  calc: (p, l, l4) => {
    const s = (l4 && l4.length > 0 ? l4 : l.toString()).padStart(4, '0');
    const sumAll = s.split('').reduce((acc, curr) => acc + parseInt(curr, 10), 0);
    const tens = (sumAll + 5) % 10;
    const units = (parseInt(s[3], 10) + 9) % 10;
    return (tens * 10) + units;
  }
};
