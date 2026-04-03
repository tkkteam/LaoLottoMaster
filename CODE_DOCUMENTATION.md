# 📘 คู่มืออธิบายโค้ด (Code Documentation)

## 📋 สารบัญ
1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [ฟังก์ชันหลัก](#ฟังก์ชันหลัก)
3. [การทำงานร่วมกัน](#การทำงานร่วมกัน)

---

## ภาพรวมระบบ

ระบบ AI ทำนายหวยลาวทำงานด้วย **Hybrid Approach** ที่ผสมผสาน:
- **Historical Analysis** (วิเคราะห์ข้อมูลย้อนหลัง 30 งวด)
- **Current Performance** (ดูแนวโน้ม 10 งวดล่าสุด)
- **Stability Check** (ตรวจสอบความมั่นคงของสูตร)
- **Repeat Analysis** (วิเคราะห์โอกาสออกซ้ำ)

---

## ฟังก์ชันหลัก

### 1. `fetchLottoData()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** ดึงข้อมูลหวยลาวจาก Google Sheets CSV

**วิธีทำงาน:**
```typescript
// 1. ดึงข้อมูลจาก URL
const res = await fetch(CSV_URL);
const text = await res.text();

// 2. แยกข้อมูลเป็นแถว
const rows = text.trim().split('\n').slice(1);

// 3. แปลงข้อมูล CSV เป็น Object
return rows.map(r => {
  const c = r.split(',');
  return {
    date: c[0],      // "02/04/2569"
    r4: c[1].slice(-4),  // "0643" (เอา 4 หลักท้าย)
    r3: c[2],        // "643"
    r2: c[3],        // "43"
    year: "2569"
  };
}).reverse();  // เรียงใหม่: ใหม่สุด → เก่าสุด
```

**ข้อมูลที่ได้:**
```javascript
[
  { date: '02/04/2569', r4: '0643', r3: '643', r2: '43', year: '2569' },
  { date: '01/04/2569', r4: '5182', r3: '182', r2: '10', year: '2569' },
  { date: '30/03/2569', r4: '9876', r3: '876', r2: '85', year: '2569' },
  // ... 750 รายการ
]
```

---

### 2. `backtestPattern()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** ทดสอบสูตรย้อนหลังเพื่อดูว่าแม่นยำแค่ไหน

**Input:**
- `results`: ข้อมูลหวยทั้งหมด
- `pattern`: สูตรที่ต้องการทดสอบ
- `rounds`: จำนวนรอบที่จะทดสอบ (default: 20)

**วิธีทำงาน:**
```typescript
// 1. วนลูปทดสอบจากข้อมูลใหม่สุด (2569) ย้อนกลับไป
for (let i = 1; i < results.length - 1 && hits.length < rounds; i++) {
  
  // 2. กำหนดข้อมูล: ใช้ 2 งวดก่อนหน้าทำนาย 1 งวดถัดไป
  const prev = results[i + 1];   // งวดเก่ากว่า (ใช้ทำนาย)
  const current = results[i];    // งวดใหม่กว่า (ใช้ทำนาย)
  const next = results[i - 1];   // งวดใหม่สุด (สิ่งที่ต้องการทาย)
  
  // 3. คำนวณเลขที่ทำนาย
  const predicted = pattern.calc(
    parseInt(prev.r2, 10),      // เลขงวดก่อนหน้า
    parseInt(current.r2, 10),   // เลขงวดล่าสุด
    current.r4,                 // 4 หลัก
    historicalResults           // ข้อมูลย้อนหลัง
  );
  
  // 4. ตรวจสอบว่าทายถูกหรือไม่
  const isDirect = predicted === nextR2;  // ทายตรงตัว?
  const isRunning = runningNumbers.includes(nextTens) || 
                    runningNumbers.includes(nextUnits);  // ทายถูกหลักเดียว?
  
  // 5. บันทึกผล
  hits.push({ date, predicted, actual, isDirect, isRunning });
}

// 6. คำนวณความแม่นยำ
return {
  directAccuracy: (directHits / hits.length) * 100,  // % ทายตรงตัว
  runningAccuracy: ((directHits + runningHits) / hits.length) * 100,  // % ทายถูกหลักเดียว
  maxConsecutiveHits: 6  // ทายถูกติดต่อกันสูงสุด 6 งวด
};
```

**ตัวอย่างผลลัพธ์:**
```javascript
{
  totalRounds: 30,
  directHits: 5,
  runningHits: 16,
  directAccuracy: 16.7,      // ทายตรงตัว 16.7%
  runningAccuracy: 70.0,     // ทายถูกอย่างน้อยหลักเดียว 70%
  maxConsecutiveHits: 6,     // ทายถูกติดต่อกันสูงสุด 6 งวด
  hits: [...]
}
```

**สำคัญ:** 
- `maxConsecutiveHits` ใช้กำหนดว่าสูตรนั้น **Qualified** หรือไม่ (ต้อง ≥ 6)
- ทดสอบจากข้อมูลใหม่สุด (2569) ไม่ใช่ข้อมูลเก่า (2564)

---

### 3. `analyzeHybridPatterns()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** วิเคราะห์ทุกสูตรด้วย Hybrid Approach (Historical + Current + Stability)

**Input:**
- `results`: ข้อมูลหวยทั้งหมด
- `currentMasterPattern`: สูตรที่เป็น Active Master อยู่ (ถ้ามี)
- `minConsecutive`: เกณฑ์ขั้นต่ำ (default: 6)

**วิธีทำงาน:**
```typescript
// 1. ทดสอบทุกสูตร
PATTERNS.forEach(pattern => {
  
  // 2. วิเคราะห์ Historical Performance (30 งวด)
  const historicalStats = backtestPattern(results, pattern, 30);
  
  // 3. วิเคราะห์ Current Performance (10 งวดล่าสุด)
  const currentStats = backtestPattern(results, pattern, 10);
  
  // 4. ตรวจสอบว่าผ่านเกณฑ์หรือไม่
  const isQualified = historicalStats.maxConsecutiveHits >= 6;
  
  // 5. คำนวณ Stability Score (ความมั่นคง 0-100%)
  const accuracyDiff = Math.abs(historicalAccuracy - currentAccuracy);
  const consecutiveDiff = Math.abs(historicalConsecutive - currentConsecutive);
  const stabilityScore = 100 - (accuracyDiff * 2) - (consecutiveDiff * 5);
  
  // ผลลัพธ์สูง = Performance คงที่, ผลลัพธ์ต่ำ = Performance เปลี่ยนแปลงมาก
});

// 6. เลือก Active Master ด้วยกฎ Hybrid
const activeMaster = selectHybridMaster(hybridResults, currentMasterPattern);

// 7. เรียงลำดับตามคะแนนรวม
hybridResults.sort((a, b) => 
  (a.historicalAccuracy + a.stabilityScore/10) - 
  (b.historicalAccuracy + b.stabilityScore/10)
);
```

**กฎการเลือก Active Master:**
```typescript
function selectHybridMaster(hybridResults, currentMasterPattern) {
  
  // กรณี 1: ไม่มีสูตรไหน Qualified → ใช้สูตรที่ดีที่สุด
  if (qualified.length === 0) return hybridResults[0];
  
  // กรณี 2: มี current master และยัง Qualified
  if (currentMasterPattern && currentMaster.isQualified) {
    
    // ตรวจสอบว่ามีสูตรที่ดีกว่า 10% ขึ้นไปหรือไม่
    const betterAlternative = qualified.find(h => {
      const scoreDiff = (h.accuracy + h.stability/10) - 
                        (current.accuracy + current.stability/10);
      return scoreDiff >= 10;  // ต้องดีกว่า 10%
    });
    
    // ถ้าไม่มีสูตรที่ดีกว่ามาก → ใช้สูตรเดิม (คงความมั่นคง)
    if (!betterAlternative) return currentMaster;
    
    // ถ้ามีสูตรที่ดีกว่ามาก → เปลี่ยนไปใช้สูตรใหม่
    return betterAlternative;
  }
  
  // กรณี 3: current master ไม่ Qualified แล้ว → เลือกสูตรใหม่ที่ดีที่สุด
  return qualified[0];
}
```

**ตัวอย่างผลลัพธ์:**
```javascript
[
  {
    pattern: { name: "Markov Chain..." },
    historicalStats: { directAccuracy: 16.7, maxConsecutiveHits: 6 },
    currentStats: { directAccuracy: 10.0, maxConsecutiveHits: 3 },
    isQualified: true,              // ผ่านเกณฑ์ ≥ 6
    stabilityScore: 85,             // มั่นคงสูง
    isActiveMaster: true            // ถูกเลือกเป็น Active Master
  },
  {
    pattern: { name: "Weighted Frequency..." },
    historicalStats: { directAccuracy: 3.3, maxConsecutiveHits: 5 },
    isQualified: false,             // ไม่ผ่าน (< 6)
    stabilityScore: 72,
    isActiveMaster: false
  }
]
```

---

### 4. `filterPatternsByConsecutive()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** กรองสูตรที่ผ่านเกณฑ์ Consecutive Hits (≥ 6 งวดติด)

**Input:**
- `results`: ข้อมูลหวยทั้งหมด
- `minConsecutive`: จำนวนงวดติดต่อกันขั้นต่ำ (default: 6)
- `rounds`: จำนวนรอบทดสอบ (default: 30)

**วิธีทำงาน:**
```typescript
// 1. ทดสอบทุกสูตร
PATTERNS.forEach(pattern => {
  const stats = backtestPattern(results, pattern, rounds);
  
  // 2. ตรวจสอบว่าผ่านเกณฑ์หรือไม่
  if (stats.maxConsecutiveHits >= minConsecutive) {
    // ผ่านเกณฑ์ → เก็บไว้
    qualifiedPatterns.push({ pattern, stats });
  } else {
    // ไม่ผ่าน → แสดง log
    console.log(`❌ ${pattern.name} ถูกคัดออก: Max Consecutive ${stats.maxConsecutiveHits} < ${minConsecutive}`);
  }
});

// 3. เรียงตามความแม่นยำ
qualifiedPatterns.sort((a, b) => b.stats.directAccuracy - a.stats.directAccuracy);

return qualifiedPatterns;
```

**ตัวอย่างผลลัพธ์:**
```
❌ Master 2-Digit ถูกคัดออก: Max Consecutive 2 < 6
❌ Quantum Flux ถูกคัดออก: Max Consecutive 4 < 6
✅ Markov Chain - Accuracy: 16.7%, Max Consecutive: 6
✅ MASTER ENSEMBLE - Accuracy: 10.0%, Max Consecutive: 5

✅ สูตรที่ผ่านเกณฑ์ (6 งวดติด): 1/9 สูตร
  1. Markov Chain - Accuracy: 16.7%, Max Consecutive: 6
```

---

### 5. `analyzeRepeatProbability()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** วิเคราะห์โอกาสที่เลขจะออกซ้ำในงวดถัดไป

**Input:**
- `results`: ข้อมูลหวยทั้งหมด
- `targetNumber`: เลขที่ต้องการวิเคราะห์ (เช่น "10")
- `lookbackRounds`: จำนวนงวดที่จะตรวจสอบ (default: 100)

**วิธีทำงาน:**
```typescript
// 1. วนลูปตรวจสอบข้อมูลย้อนหลัง
for (let i = 0; i < checkRounds; i++) {
  if (results[i].r2 === target) {
    totalOccurrences++;  // นับจำนวนครั้งที่ออก
    
    // 2. ตรวจสอบว่าออกซ้ำในงวดถัดไปหรือไม่
    if (i > 0 && results[i-1].r2 === target) {
      repeatAfterOne++;  // ออกซ้ำงวดถัดไป
    }
  }
}

// 3. คำนวณ % การออกซ้ำ
const repeatPercentage = (repeatAfterOne / (totalOccurrences - 1)) * 100;

// 4. กำหนดระดับความเชื่อมั่น
if (repeatPercentage > 20) confidenceLevel = 'HIGH';
else if (repeatPercentage > 10) confidenceLevel = 'MEDIUM';
else confidenceLevel = 'LOW';
```

**ตัวอย่างผลลัพธ์:**
```javascript
{
  totalOccurrences: 8,         // ออกทั้งหมด 8 ครั้ง
  repeatAfterOne: 1,           // ออกซ้ำงวดถัดไป 1 ครั้ง
  repeatAfterTwo: 0,           // ออกซ้ำ 2 งวดถัดไป 0 ครั้ง
  repeatAfterThree: 0,         // ออกซ้ำ 3 งวดถัดไป 0 ครั้ง
  repeatPercentage: 14.3,      // โอกาสออกซ้ำ 14.3%
  averageGap: 12.5,            // โดยเฉลี่ยออกทุก 12.5 งวด
  lastSeenDate: '01/04/2569',  // ครั้งล่าสุดที่ออก
  confidenceLevel: 'MEDIUM',   // ระดับความเชื่อมั่น
  recommendation: '🔶 เลข 10 มีโอกาสออกซ้ำปานกลาง (14.3%)'
}
```

---

### 6. `findBestPattern()`

**ไฟล์:** `lottoService.ts`

**หน้าที่:** หาสูตรที่ดีที่สุดจากทุกสูตร

**Input:**
- `results`: ข้อมูลหวยทั้งหมด
- `rounds`: จำนวนรอบทดสอบ (default: 20)

**วิธีทำงาน:**
```typescript
let bestPattern = PATTERNS[0];
let bestStats = backtestPattern(results, bestPattern, rounds);

// ทดสอบทุกสูตร
PATTERNS.forEach(pattern => {
  const stats = backtestPattern(results, pattern, rounds);
  
  // เลือกสูตรที่ดีที่สุดตามลำดับความสำคัญ:
  // 1. Direct Accuracy (ความแม่นยำตรงตัว)
  // 2. Running Accuracy (ความแม่นยำอย่างน้อยหลักเดียว)
  // 3. Max Consecutive Hits (จำนวนงวดทายถูกติดต่อกันสูงสุด)
  
  if (stats.directAccuracy > bestStats.directAccuracy ||
     (stats.directAccuracy === bestStats.directAccuracy && 
      stats.runningAccuracy > bestStats.runningAccuracy) ||
     (stats.directAccuracy === bestStats.directAccuracy && 
      stats.runningAccuracy === bestStats.runningAccuracy &&
      stats.maxConsecutiveHits > bestStats.maxConsecutiveHits)) {
    bestPattern = pattern;
    bestStats = stats;
  }
});

return { pattern: bestPattern, stats: bestStats };
```

**ตัวอย่างผลลัพธ์:**
```javascript
{
  pattern: { name: "Markov Chain (มาร์คอฟเชน)" },
  stats: {
    directAccuracy: 16.7,
    runningAccuracy: 70.0,
    maxConsecutiveHits: 6
  }
}
```

---

### 7. `autoCalculate()` (ใน App.tsx)

**ไฟล์:** `App.tsx`

**หน้าที่:** คำนวณเลขทำนายทั้งหมดเมื่อผู้ใช้กดปุ่ม "RE-ANALYZE" หรือข้อมูลเปลี่ยน

**วิธีทำงาน:**
```typescript
const autoCalculate = () => {
  
  // 1. ตรวจสอบว่ามีข้อมูลเพียงพอหรือไม่
  if (allData.length < 2 || !bestPatternInfo || !stats) return;
  
  // 2. ดึงข้อมูลล่าสุด
  const lastResult = allData[0];      // งวดล่าสุด
  const prevResult = allData[1];      // งวดก่อนหน้า
  
  // 3. คำนวณเลขทำนายจากทุกสูตร
  const allPredictions = PATTERNS.map(p => ({
    name: p.name,
    value: p.calc(
      parseInt(prevResult.r2, 10),    // เลขงวดก่อนหน้า
      parseInt(lastResult.r2, 10),    // เลขงวดล่าสุด
      lastResult.r4,                  // 4 หลัก
      allData                         // ข้อมูลทั้งหมด
    ).toString().padStart(2, '0')
  }));
  
  // 4. เลือกเลขจากสูตรที่เป็น Active Master
  const activePattern = bestPatternInfo.pattern;
  const resPri = allPredictions.find(p => p.name === activePattern.name)?.value;
  
  // 5. คำนวณเลข Mirror (กระจก)
  const mirrorStr = getMirror(resPri);
  
  // 6. คำนวณเลข Rhythm (จังหวะ)
  const rhythm = ((parseInt(resPri[0]) + 5) % 10).toString() + 
                 ((parseInt(resPri[1]) + 3) % 10).toString();
  
  // 7. คำนวณเลข Triple (3 หลัก)
  const predictedH = (hLast * 2 + hPrev + dSum + 3) % 10;
  const triple = predictedH.toString() + resPri;
  
  // 8. คำนวณ Combined Confidence
  const confidence = calculateCombinedConfidence(
    allPredictions,     // เลขจากทุกสูตร
    bestPatternInfo.stats,
    stats.topT,         // เลขเด่นหลักสิบ
    stats.topU          // เลขเด่นหลักหน่วย
  );
  
  // 9. บันทึกผลลัพธ์
  setManualRes({
    primary: resPri,      // เลขหลัก (เช่น "43")
    mirror: mirrorStr,    // เลขกระจก (เช่น "98")
    rhythm: rhythm,       // เลขจังหวะ (เช่น "96")
    triple: triple,       // เลข 3 หลัก (เช่น "543")
    confidence: confidence,  // ความเชื่อมั่น (เช่น 75)
    formulaName: activePattern.name  // ชื่อสูตรที่ใช้
  });
};
```

**ผลลัพธ์ที่ได้:**
```javascript
{
  primary: "43",           // เลขหลักที่ AI ทำนาย
  mirror: "98",            // เลขกระจกของ 43
  rhythm: "96",            // เลขจังหวะ
  triple: "543",           // เลข 3 หลัก
  confidence: 75,          // ความเชื่อมั่น 75%
  formulaName: "Markov Chain (มาร์คอฟเชน)"
}
```

---

## การทำงานร่วมกัน

### **ลำดับการทำงานเมื่อผู้ใช้กด "SYNC SYSTEM":**

```
1. fetchLottoData()
   ↓ ดึงข้อมูล 750 งวดจาก CSV
   
2. analyzeHybridPatterns(data, undefined, 6)
   ↓ ทดสอบทุกสูตรด้วย backtestPattern()
   ↓ เลือก Active Master (Markov Chain)
   
3. findBestPattern(data, 20)
   ↓ หาสูตรที่ดีที่สุด (สำรอง)
   
4. analyzeRepeatProbability(data, lastR2, 100)
   ↓ วิเคราะห์โอกาสออกซ้ำ
   
5. setBestPatternInfo(activeMaster)
   ↓ อัพเดท UI
```

### **ลำดับการทำงานเมื่อผู้ใช้กด "RE-ANALYZE":**

```
1. autoCalculate()
   ↓ ตรวจสอบว่ามีข้อมูลเพียงพอ
   
2. PATTERNS.map(p => p.calc(...))
   ↓ คำนวณเลขจากทุกสูตร
   
3. calculateCombinedConfidence(...)
   ↓ คำนวณความเชื่อมั่น
   
4. setManualRes({...})
   ↓ แสดงผลลัพธ์ใน UI
```

---

## 📊 สรุปสูตรทั้ง 9 สูตร

| # | ชื่อสูตร | หลักการทำงาน | ความแม่นยำ |
|---|----------|--------------|------------|
| 1 | Master 2-Digit (สูตรอมตะ) | คำนวณจาก 4 หลัก | 3.3% |
| 2 | Quantum Flux (สูตรไหล) | บวกไหล 2 งวด | 0% |
| 3 | Static Core (สูตรนิ่ง) | ผลรวม + ค่าคงที่ | 0% |
| 4 | Mirror Matrix (สูตรกระจก) | เลขกระจก + ค่าคงที่ | 0% |
| 5 | Golden Ratio (สูตรรวมโชค) | อัตราส่วนทอง | 0% |
| 6 | **Markov Chain** | ความน่าจะเป็นเปลี่ยนสถานะ | **16.7%** ✅ |
| 7 | Weighted Frequency | ความถี่แบบให้น้ำหนัก | 3.3% |
| 8 | Neural Pattern | หลายปัจจัยร่วมกัน | 3.3% |
| 9 | MASTER ENSEMBLE | ผสม 5 หลักการ | 0% |

---

## 🎯 สรุปกฎ Hybrid Approach

### **Active Master จะเปลี่ยนเมื่อ:**

1. ✅ **สูตรปัจจุบันล้มเหลว** (Max Consecutive < 6)
2. ✅ **มีสูตรอื่นที่ดีกว่า ≥ 10%**

### **Active Master จะไม่เปลี่ยนเมื่อ:**

1. ✅ **สูตรปัจจุบันยังดีอยู่** (Max Consecutive ≥ 6)
2. ✅ **ไม่มีสูตรอื่นที่ดีกว่า 10%**

---

**อัพเดทล่าสุด:** เมษายน 2569  
**Version:** 5.0 (Hybrid + Repeat Analysis)
