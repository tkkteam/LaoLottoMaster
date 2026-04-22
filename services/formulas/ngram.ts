import { LottoResult, Pattern } from '../../types';

export const ngramPattern: Pattern = {
  name: "N-Gram Pattern (รูปแบบลำดับ)",
  calc: (p, l, l4, results?) => {
    /**
     * N-GRAM PATTERN MATCHING
     * หารูปแบบจากลำดับ 2-3 งวดที่คล้ายกัน
     *
     * หลักการ:
     * - จำดูลำดับของเลข 2-3 งวดก่อนหน้า
     * - หาลำดับที่คล้ายที่สุดในอดีต
     * - ดูว่าหลังจากลำดับนั้น ออกเลขอะไร
     */
    if (!results || results.length < 10) {
      const tens = (Math.floor(l / 10) + 2) % 10;
      const units = ((l % 10) + 5) % 10;
      return (tens * 10) + units;
    }

    const ngramLength = 3; // ดู 3 งวดล่าสุด
    const currentSequence: number[] = [l, p];
    if (results.length >= 3) {
      currentSequence.push(parseInt(results[2].r2, 10));
    }

    // ค้นหาลำดับที่คล้ายกันในอดีต
    const matches: Array<{ sequence: number[], nextNumber: number, similarity: number }> = [];

    for (let i = 2; i < results.length - 1 && i < 50; i++) {
      const histSequence: number[] = [
        parseInt(results[i].r2, 10),
        parseInt(results[i - 1]?.r2 || '0', 10),
        parseInt(results[i - 2]?.r2 || '0', 10)
      ];

      // คำนวณความคล้าย (inverse distance)
      let distance = 0;
      for (let j = 0; j < Math.min(currentSequence.length, histSequence.length); j++) {
        distance += Math.abs(currentSequence[j] - histSequence[j]);
      }

      const similarity = 1 / (1 + distance);
      const nextNumber = parseInt(results[i - 1]?.r2 || '0', 10);

      matches.push({ sequence: histSequence, nextNumber, similarity });
    }

    // เรียงตามความคล้าย
    matches.sort((a, b) => b.similarity - a.similarity);

    // เลือก top 5 matches
    const topMatches = matches.slice(0, 5);

    // นับความถี่ของเลขที่ออกหลังจากลำดับที่คล้าย
    const tensCount: number[] = Array(10).fill(0);
    const unitsCount: number[] = Array(10).fill(0);

    topMatches.forEach(match => {
      const tens = Math.floor(match.nextNumber / 10);
      const units = match.nextNumber % 10;
      tensCount[tens] += match.similarity;
      unitsCount[units] += match.similarity;
    });

    const predictedTens = tensCount.indexOf(Math.max(...tensCount));
    const predictedUnits = unitsCount.indexOf(Math.max(...unitsCount));

    return (predictedTens * 10) + predictedUnits;
  }
};
