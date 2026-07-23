/**
 * Backtest Runner - ทดสอบสูตรทั้งหมดกับข้อมูลจริง จัดอันดับตามความแม่นยำ
 * รัน: npx tsx backtest-runner.ts
 */

import { fetchLottoData, PATTERNS, backtestPattern } from './services/lottoService';
import type { Pattern, BacktestResult } from './types';

interface FormulaRank {
  name: string;
  formula: Pattern;
  // Direct hit (2 ตัวตรง)
  directAccuracy: number;
  directHits: number;
  // Running hit (เข้าอย่างน้อย 1 หลัก)
  runningAccuracy: number;
  // ติดต่อกันสูงสุด
  maxConsecutiveHits: number;
  // คะแนนรวม (custom)
  compositeScore: number;
  // ความสม่ำเสมอ (std dev ยิ่งต่ำยิ่งดี)
  consistency: number;
  // ผลล่าสุด 20 งวด
  recent20Accuracy: number;
  totalRounds: number;
}

async function main() {
  console.log('🔄 กำลังดึงข้อมูลหวย...');
  const results = await fetchLottoData();
  
  if (results.length < 50) {
    console.error('❌ ข้อมูลไม่เพียงพอ ต้องการอย่างน้อย 50 งวด');
    process.exit(1);
  }

  console.log(`✅ ดึงข้อมูลสำเร็จ: ${results.length} งวด`);
  console.log(`📅 งวดล่าสุด: ${results[0]?.date} | เลข: ${results[0]?.r2}`);
  console.log(`📅 งวดเก่าสุด: ${results[results.length - 1]?.date}\n`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏆 BACKTEST ทุกสูตร (50 งวดล่าสุด)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ranks: FormulaRank[] = [];

  for (const pattern of PATTERNS) {
    try {
      // Backtest 50 งวด
      const stats50 = backtestPattern(results, pattern, 50);
      // Backtest 20 งวดล่าสุด (ดูฟอร์มปัจจุบัน)
      const stats20 = backtestPattern(results, pattern, 20);
      // Backtest 100 งวด (ดูความสม่ำเสมอในระยะยาว)
      const stats100 = backtestPattern(results, pattern, Math.min(100, results.length - 5));

      // คำนวณความสม่ำเสมอ: ดูว่า hits กระจุกตรงไหน
      // แบ่งเป็น 5 ช่วง ช่วงละ 20% ดูว่าแต่ละช่วง hit กี่ครั้ง
      const allHits = stats100.hits;
      const chunkSize = Math.ceil(allHits.length / 5);
      const chunks: number[] = [];
      for (let i = 0; i < 5; i++) {
        const chunk = allHits.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkHitRate = chunk.length > 0 
          ? chunk.filter(h => h.isDirect || h.isRunning).length / chunk.length 
          : 0;
        chunks.push(chunkHitRate);
      }
      const meanChunk = chunks.reduce((a, b) => a + b, 0) / chunks.length;
      const variance = chunks.reduce((s, v) => s + (v - meanChunk) ** 2, 0) / chunks.length;
      const stdDev = Math.sqrt(variance);
      // consistency = 100 - stdDev*200 (ยิ่งน้อยยิ่งสม่ำเสมอ)
      const consistency = Math.max(0, Math.min(100, 100 - stdDev * 200));

      // Composite Score: weighted
      // - Direct 50% (สำคัญสุด)
      // - Running 25%
      // - Consecutive 15%
      // - Consistency 10%
      const compositeScore = 
        (stats50.directAccuracy * 0.50) +
        (stats50.runningAccuracy * 0.25) +
        (Math.min(stats50.maxConsecutiveHits, 10) * 5 * 0.15) +
        (consistency * 0.10);

      ranks.push({
        name: pattern.name,
        formula: pattern,
        directAccuracy: stats50.directAccuracy,
        directHits: stats50.directHits,
        runningAccuracy: stats50.runningAccuracy,
        maxConsecutiveHits: stats50.maxConsecutiveHits,
        compositeScore: Math.round(compositeScore * 10) / 10,
        consistency: Math.round(consistency),
        recent20Accuracy: stats20.directAccuracy,
        totalRounds: stats50.totalRounds,
      });
    } catch (e) {
      console.log(`  ⚠️ ${pattern.name}: ERROR - ${(e as Error).message}`);
    }
  }

  // เรียงตาม compositeScore
  ranks.sort((a, b) => b.compositeScore - a.compositeScore);

  // แสดงผล
  console.log('┌─────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ #  │ สูตร                              │ Direct │ Running │ Consec │ Consist │ Score  │');
  console.log('├─────────────────────────────────────────────────────────────────────────────────────┤');

  ranks.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const name = r.name.length > 33 ? r.name.slice(0, 30) + '...' : r.name.padEnd(33);
    console.log(
      `│ ${medal}${String(i + 1).padStart(2)} │ ${name} │ ` +
      `${r.directAccuracy.toFixed(1).padStart(5)}% │ ` +
      `${r.runningAccuracy.toFixed(1).padStart(6)}% │ ` +
      `${String(r.maxConsecutiveHits).padStart(5)}  │ ` +
      `${String(r.consistency).padStart(5)}% │ ` +
      `${r.compositeScore.toFixed(1).padStart(5)}  │`
    );
  });

  console.log('└─────────────────────────────────────────────────────────────────────────────────────┘\n');

  // Top 6
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎯 TOP 6 สูตรแนะนำ (Composite Score + Recent Form)');
  console.log('═══════════════════════════════════════════════════════════\n');

  ranks.slice(0, 6).forEach((r, i) => {
    const trend = r.recent20Accuracy > r.directAccuracy ? '📈 กำลังมา' : 
                  r.recent20Accuracy < r.directAccuracy * 0.5 ? '📉 กำลังลด' : '➡️ คงที่';
    console.log(`  ${i + 1}. ${r.name}`);
    console.log(`     📊 Direct: ${r.directAccuracy.toFixed(1)}% | Running: ${r.runningAccuracy.toFixed(1)}%`);
    console.log(`     🔥 ติดต่อกันสูงสุด: ${r.maxConsecutiveHits} งวด | สม่ำเสมอ: ${r.consistency}%`);
    console.log(`     ${trend} (20 งวดล่าสุด: ${r.recent20Accuracy.toFixed(1)}%)`);
    console.log(`     ⭐ Composite Score: ${r.compositeScore}\n`);
  });

  // ทดสอบทำนายงวดถัดไปด้วย Top 6
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔮 ทำนายงวดถัดไปด้วย Top 6 สูตร');
  console.log('═══════════════════════════════════════════════════════════\n');

  const prevR2 = results.length > 1 ? parseInt(results[1].r2, 10) : 0;
  const lastR2 = parseInt(results[0].r2, 10);
  const lastR4 = results[0].r4;

  ranks.slice(0, 6).forEach((r, i) => {
    try {
      const predicted = r.formula.calc(prevR2, lastR2, lastR4, results);
      const predStr = predicted.toString().padStart(2, '0');
      console.log(`  ${i + 1}. ${r.name}: ${predStr}`);
    } catch (e) {
      console.log(`  ${i + 1}. ${r.name}: ERROR`);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  📋 สรุปคำแนะนำ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const top6 = ranks.slice(0, 6);
  const avgDirect = top6.reduce((s, r) => s + r.directAccuracy, 0) / top6.length;
  const avgRunning = top6.reduce((s, r) => s + r.runningAccuracy, 0) / top6.length;
  
  console.log(`  ค่าเฉลี่ย Top 6:`);
  console.log(`    - Direct (2 ตัวตรง): ${avgDirect.toFixed(1)}%`);
  console.log(`    - Running (เข้า 1 หลัก): ${avgRunning.toFixed(1)}%`);
  console.log(`    - อัตราสุ่มเฉลี่ย: Direct ~1% | Running ~20%`);
  console.log(`    - ถ้า Top 6 ทำได้สูงกว่าสุ่ม = สูตรมีประสิทธิภาพ\n`);

  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});