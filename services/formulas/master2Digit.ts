import { Pattern } from '../../types';

const MIRRORS: Record<string, string> = { 
  '0': '5', '1': '6', '2': '7', '3': '8', '4': '9', 
  '5': '0', '6': '1', '7': '2', '8': '3', '9': '4' 
};

export const master2DigitFormula: Pattern = {
  name: "Master 2-Digit (สูตรอมตะ)",
  calc: (p, l, l4) => {
    const s = l4 || l.toString().padStart(4, '0');
    const a = parseInt(s[0], 10) || 0;
    const b = parseInt(s[1], 10) || 0;
    const c = parseInt(s[2], 10) || 0;
    const d = parseInt(s[3], 10) || 0;
    const tens = ((a * 2) + b + 5) % 10;
    const units = (c + d + 3) % 10;
    return (tens * 10) + units;
  },
  getMirrorPair: (result: number) => {
    const s = result.toString().padStart(2, '0');
    const mirrorStr = (MIRRORS[s[0]] || '0') + (MIRRORS[s[1]] || '0');
    return parseInt(mirrorStr, 10);
  }
};
