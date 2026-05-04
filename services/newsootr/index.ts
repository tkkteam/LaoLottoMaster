import { LotteryAnalyzer } from "./analyzer";

const history = [
  { date: "2026-05-01", number: "12345" },
  { date: "2026-04-29", number: "67890" },
  { date: "2026-04-27", number: "11223" },
  // 👉 ใส่ข้อมูลจริงเยอะๆ (สำคัญมาก)
];

const analyzer = new LotteryAnalyzer(history);

const result = analyzer.predict();

console.log("🔥 TOP เลขเด่น:");
console.table(result);