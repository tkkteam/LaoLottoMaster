
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  fetchLottoData,
  getDigitSum,
  getMirror,
  calculateBackyard,
  backtestBackyard,
  backtestBackyardWithConstants,
  findBestBackyardConstants,
  backtestPattern,
  findBestPattern,
  calculateCombinedConfidence,
  analyzeHybridPatterns,
  analyzeRepeatProbability,
  PATTERNS,
  calculateRunningDigits,
  monteCarlo3DFormula,
  unified3DEngine
  } from './services/lottoService';

import { backtestHotnumber1 } from './services/hotnumber1Backtest';
import { getHotDigits as getHotNumber1Digits } from './services/formulas/Hotnumber1';
import { neuralAI } from './services/neuralAIService';

  import { LottoResult, PredictionResult, BacktestResult, Pattern, HybridPatternInfo, RepeatAnalysis, RunningDigitLog } from './types';

  interface StatsResult {
    topT: string[];
    topU: string[];
    chartData: Array<{ num: string, count: number }>;
    parityData: Array<{ name: string, value: number }>;
    backyard: string[];
    aiMaster: string;
    runningDigits: number[];
  }

  const COLORS = ['#22d3ee', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

  const App: React.FC = () => {
  const [allData, setAllData] = useState<LottoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualRes, setManualRes] = useState<PredictionResult | null>(null);
  const [bestPatternInfo, setBestPatternInfo] = useState<{ pattern: Pattern, stats: BacktestResult } | null>(null);
  const [hybridPatterns, setHybridPatterns] = useState<Array<HybridPatternInfo>>([]);
  const [repeatAnalysis, setRepeatAnalysis] = useState<RepeatAnalysis | null>(null);
  const [showRunningLogs, setShowRunningLogs] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showBackyardLogs, setShowBackyardLogs] = useState(false);
  const [backyardBacktest, setBackyardBacktest] = useState<import('./services/lottoService').BackyardBacktestResult | null>(null);
  const [backyardConstants, setBackyardConstants] = useState<{ a: number; b: number; c: number }>({ a: 6, b: 7, c: 1 });
  const [isHot1Enabled, setIsHot1Enabled] = useState(false);

  // NEW: Neural AI Prediction
  const [neuralPrediction, setNeuralPrediction] = useState<{ prediction: string, confidence: number } | null>(null);
  const [isTraining, setIsTraining] = useState(false);

  // NEW: Running Digits 30-Draw Statistics
  const [runningDigitsStats, setRunningDigitsStats] = useState<{
    history: Array<import('./types').RunningDigitLog>;
    correct: number;
    incorrect: number;
    accuracy: number;
    currentStreak: number;
    bestStreak: number;
  }>({
    history: [],
    correct: 0,
    incorrect: 0,
    accuracy: 0,
    currentStreak: 0,
    bestStreak: 0
  });

  // NEW: Algorithm Leaderboard - เก็บเลขทำนายของทุกสูตร
  const [allPatternPredictions, setAllPatternPredictions] = useState<Array<{
    name: string;
    prediction: string;
    isQualified: boolean;
    isActiveMaster: boolean;
    historicalAccuracy: number;
    currentAccuracy: number;
    maxConsecutive: number;
    stabilityScore: number;
    isRecentlyDrawn: boolean;       // NEW: เลขนี้ออกในงวดล่าสุดหรือไม่
    lastDrawnDate: string;          // NEW: วันที่ออกครั้งล่าสุด
    mirrorNumber: string;           // NEW: เลขกระจก
    runningDigits: number[];        // NEW: Running digits
  }>>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo<StatsResult | null>(() => {
    if (allData.length === 0) return {
      topT: [],
      topU: [],
      chartData: [],
      parityData: [],
      backyard: [],
      aiMaster: '',
      runningDigits: []
    };
    const range = allData;
    const tens: Record<string, number> = {};
    const units: Record<string, number> = {};
    const frequencies: Record<string, number> = {};
    let even = 0, odd = 0;

    range.forEach(i => {
      const s = i.r2.padStart(2, '0');
      tens[s[0]] = (tens[s[0]] || 0) + 1;
      units[s[1]] = (units[s[1]] || 0) + 1;
      frequencies[i.r2] = (frequencies[i.r2] || 0) + 1;
      const val = parseInt(i.r2, 10);
      if (!isNaN(val)) { if (val % 2 === 0) even++; else odd++; }
    });

    const topT = Object.entries(tens).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const topU = Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const chartData = Object.entries(frequencies).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([num, count]) => ({ num, count }));

    const lastResult = allData[0];
    const activePattern = bestPatternInfo?.pattern || PATTERNS[0];
    const aiMasterNum = activePattern.calc(
      allData.length >= 2 ? parseInt(allData[1].r2, 10) : 0,
      parseInt(lastResult.r2, 10),
      lastResult.r4,
      allData
    ).toString().padStart(2, '0');

    // คำนวณเลขเด่นจาก 21 สูตร - แบบไดนามิก (ไม่เกิน 4 ตัว)
    const digitFreq = Array(10).fill(0);
    PATTERNS.forEach(p => {
      try {
        const pred = p.calc(
          allData.length >= 2 ? parseInt(allData[1].r2, 10) : 0,
          parseInt(lastResult.r2, 10),
          lastResult.r4,
          allData
        ).toString().padStart(2, '0');
        digitFreq[parseInt(pred[0], 10)]++;
        digitFreq[parseInt(pred[1], 10)]++;
      } catch (e) {}
    });

    // NEW: Recency Penalty for Running Digits
    // หักคะแนนเลขที่เพิ่งออกไปใน 2 งวดล่าสุด เพื่อให้เลขเด่นเปลี่ยนชุด
    const recentDigits = new Set([
      ...allData[0].r2.split('').map(d => parseInt(d, 10)),
      ...(allData[1]?.r2.split('').map(d => parseInt(d, 10)) || [])
    ]);

    const sortedDigits = digitFreq
      .map((freq, digit) => {
        let finalFreq = freq;
        if (recentDigits.has(digit)) finalFreq *= 0.5; // หักคะแนนเลขเพิ่งออก 50%
        return { digit, freq: finalFreq };
      })
      .sort((a, b) => b.freq - a.freq);
    
    // เลือกเลขเด่นแบบไดนามิก: ใช้ threshold 60% ของความถี่สูงสุด
    const maxFreq = sortedDigits[0]?.freq || 1;
    const threshold = maxFreq * 0.6;
    const selectedDigits = sortedDigits
      .filter(d => d.freq >= threshold)
      .slice(0, 4)
      .map(x => x.digit);
    
    const runningDigits = selectedDigits.length > 0 ? selectedDigits : sortedDigits.slice(0, 2).map(x => x.digit);

    // ✅ CONDITIONAL INTEGRATION: Hotnumber1 (ถ้าถูกเกิน 20/30 งวด)
    let finalRunningDigits = [...runningDigits];
    if (isHot1Enabled) {
      const hot1Digits = getHotNumber1Digits(allData).slice(0, 3).map(d => parseInt(d.digit, 10));
      // รวมเลขจาก Hotnumber1 เข้าไป (ไม่ซ้ำ)
      finalRunningDigits = Array.from(new Set([...finalRunningDigits, ...hot1Digits])).sort((a, b) => a - b);
    }

    return {
      topT, topU, chartData,
      parityData: [{ name: 'คู่', value: even }, { name: 'คี่', value: odd }],
      backyard: calculateBackyard(lastResult.r3, lastResult.r4, backyardConstants),
      aiMaster: aiMasterNum,
      runningDigits: finalRunningDigits
    };
  }, [allData, bestPatternInfo, backyardConstants]);

  useEffect(() => {
    if (allData.length >= 2 && stats && hybridPatterns.length > 0) {
      autoCalculate();
    }
  }, [allData, bestPatternInfo, stats, hybridPatterns]);

  // NEW: Neural AI Training
  useEffect(() => {
    if (allData.length >= 20) {
      trainNeuralAI();
    }
  }, [allData]);

  const trainNeuralAI = async (force = false) => {
    setIsTraining(true);
    try {
      await neuralAI.train(allData, force);
      const last10 = allData.slice(0, 10).map(d => parseInt(d.r2, 10));
      const pred = neuralAI.predict(last10);
      setNeuralPrediction(pred);
    } catch (e) {
      console.error('Neural AI Training Error:', e);
    }
    setIsTraining(false);
  };

  // Recalculate Running Digits stats when data changes
  useEffect(() => {
    if (allData.length >= 2) {
      calculateRunningDigitsStats(allData);
    }
  }, [allData]);

  // Recalculate Backyard Backtest when data changes
  useEffect(() => {
    if (allData.length >= 2) {
      // หา constant ที่ดีที่สุดจากข้อมูล 70% แรก (train set) - optimize สำหรับ running accuracy
      const trainSize = Math.floor(allData.length * 0.7);
      const trainData = allData.slice(allData.length - trainSize);
      const best = findBestBackyardConstants(trainData, Math.min(100, trainData.length));
      setBackyardConstants(best.constants);
      console.log(`   🎯 Optimized Constants: a=${best.constants.a}, b=${best.constants.b}, c=${best.constants.c}`);
      console.log(`   Train Running Accuracy: ${best.runningAccuracy.toFixed(1)}%`);

      // ทดสอบกับข้อมูล 30% ล่าสุด (test set)
      const bt = backtestBackyardWithConstants(allData, 30, best.constants);
      setBackyardBacktest(bt);
      console.log(`   🏡 Backyard Backtest (30 rounds):`);
      console.log(`     Exact: ${bt.accuracy.toFixed(1)}% (${bt.hits}/${bt.totalRounds})`);
      console.log(`     Running: ${bt.runningAccuracy.toFixed(1)}% (${bt.runningHits}/${bt.totalRounds})`);
      console.log(`     Best Streak: ${bt.streak.best} | Running Best: ${bt.runningStreak.best}`);
    }
  }, [allData]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchLottoData();
    setAllData(data);

    if (data.length > 30) {
      // BACKTEST HOTNUMBER1 - วิเคราะห์ย้อนหลัง 30 งวด
      const hot1Bt = backtestHotnumber1(data, 30);
      if (hot1Bt) {
        console.log(`\n🔥 HOTNUMBER1 BACKTEST (30 Rounds):`);
        console.log(`   Hits: ${hot1Bt.hits}/30 (${hot1Bt.accuracy.toFixed(1)}%)`);
        
        // ถ้าถูกเกิน 20 งวด ให้เปิดใช้งานระบบเสริม
        if (hot1Bt.hits >= 20) {
          console.log(`   ✅ CRITERIA MET: Integrating Hotnumber1 into Daily Running Digits`);
          setIsHot1Enabled(true);
        } else {
          console.log(`   ❌ CRITERIA NOT MET: Using Standard Ensemble only`);
          setIsHot1Enabled(false);
        }
      }

      // HYBRID ANALYSIS - ต้องทำก่อน เพื่อเลือก Active Master ที่ถูกต้อง
      const hybrid = analyzeHybridPatterns(data, undefined, 4); // ครั้งแรกไม่มี currentMaster
      setHybridPatterns(hybrid);
      
      // เลือก Active Master ที่ดีที่สุด
      const activeMaster = hybrid.find(h => h.isActiveMaster);
      if (activeMaster) {
        setBestPatternInfo({
          pattern: activeMaster.pattern,
          stats: activeMaster.historicalStats
        });
      } else {
        // ถ้าไม่มี Qualified ให้ใช้สูตรที่ดีที่สุด
        const best = findBestPattern(data, 20);
        setBestPatternInfo(best);
      }

      // REPEAT ANALYSIS - วิเคราะห์โอกาสออกซ้ำของเลขล่าสุด
      const lastR2 = data[0].r2.padStart(2, '0');
      const repeat = analyzeRepeatProbability(data, lastR2, 100);
      setRepeatAnalysis(repeat);
    }

    setLoading(false);
  };

  // NEW: Function to calculate Running Digits 30-Draw Statistics
  const calculateRunningDigitsStats = (data: LottoResult[]) => {
    if (data.length < 2) return;

    // Calculate hot digits from all 21 formulas
    const getHotDigits = (results: LottoResult[]): number[] => {
      if (results.length < 2) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const lastResult = results[0];
      const prevResult = results[1];
      const prevR2 = parseInt(prevResult.r2, 10);
      const lastR2Num = parseInt(lastResult.r2, 10);
      const digitFreq = Array(10).fill(0);
      PATTERNS.forEach(p => {
        try {
          const pred = p.calc(prevR2, lastR2Num, lastResult.r4, results).toString().padStart(2, '0');
          digitFreq[parseInt(pred[0], 10)]++;
          digitFreq[parseInt(pred[1], 10)]++;
        } catch (e) {}
      });
      const sortedDigits = digitFreq
        .map((freq, digit) => ({ digit, freq }))
        .sort((a, b) => b.freq - a.freq);
      
      // เลือกเลขเด่นแบบไดนามิก: ใช้ threshold 60% ของความถี่สูงสุด
      const maxFreq = sortedDigits[0]?.freq || 1;
      const threshold = maxFreq * 0.6;
      const selected = sortedDigits
        .filter(d => d.freq >= threshold)
        .slice(0, 4)
        .map(x => x.digit);
      
      return selected.length > 0 ? selected : sortedDigits.slice(0, 2).map(x => x.digit);
    };

    const history: Array<import('./types').RunningDigitLog> = [];

    let correct = 0;
    let incorrect = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // เริ่มนับจากงวด 02/01/2569 ถึงปัจจุบัน
    let startIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i].date === '02/01/2569') {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      startIndex = 0;
    }

    // งวดที่กำลังจะมาถึง (Pending)
    const nextHotDigits = getHotDigits(data);
    history.push({
      date: 'งวดถัดไป',
      predicted: nextHotDigits,
      actual: '--',
      isCorrect: false,
      matchedDigits: 0,
      status: 'PENDING'
    });

    // ตรวจสอบทั้งหมดตั้งแต่งวด 02/01/2569 ถึงปัจจุบัน
    const maxRounds = Math.min(startIndex, data.length - 1);

    for (let i = 0; i <= maxRounds; i++) {
      const current = data[i];
      const prev = data[i + 1];

      if (!current || !prev) continue;

      const runningDigits = getHotDigits(data.slice(i));
      const actualR2 = current.r2;
      const actualTens = parseInt(actualR2[0], 10);
      const actualUnits = parseInt(actualR2[1], 10);

      const hasTens = runningDigits.includes(actualTens);
      const hasUnits = runningDigits.includes(actualUnits);
      const matchedDigits = (hasTens ? 1 : 0) + (hasUnits ? 1 : 0);

      const isCorrect = matchedDigits > 0;

      if (isCorrect) {
        correct++;
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        incorrect++;
        tempStreak = 0;
      }

      currentStreak = tempStreak;

      history.push({
        date: current.date,
        predicted: runningDigits,
        actual: actualR2,
        isCorrect,
        matchedDigits,
        status: isCorrect ? 'WIN' : 'LOSS'
      });
    }

    setRunningDigitsStats({
      correct,
      incorrect,
      accuracy: (correct + incorrect) > 0 ? (correct / (correct + incorrect)) * 100 : 0,
      currentStreak,
      bestStreak,
      history: history
    });
  };

  const autoCalculate = () => {
    console.log('\n🔍 RE-ANALYZE clicked (V4 Adaptive Learning)');
    
    if (allData.length < 5) {
      console.warn('   ❌ Not enough data for learning');
      return;
    }
    if (!bestPatternInfo || !stats) {
      console.warn('   ❌ Stats not ready');
      return;
    }

    // Clear previous results to show update
    setManualRes(null);

    const lastResult = allData[0];
    const prevResult = allData[1];
    const prevR2 = parseInt(prevResult.r2, 10);
    const lastR2 = parseInt(lastResult.r2, 10);
    const lastR4 = lastResult.r4;
    const lastR3 = lastResult.r3;

    const activePattern = bestPatternInfo.pattern;

    // 1. Gap Analysis
    const numberGaps: Record<string, number> = {};
    for (let i = 0; i <= 99; i++) {
      const s = i.toString().padStart(2, '0');
      const gap = allData.findIndex(r => r.r2 === s);
      numberGaps[s] = gap === -1 ? 100 : gap;
    }

    // 2. PATTERN DISCOVERY (Self-Correction / Learning)
    console.log('   🧠 Learning from recent 5 draws...');
    const ruleBiases: Record<string, number> = {};
    
    PATTERNS.forEach(p => {
      let hitCount = 0;
      for (let i = 0; i < 5; i++) {
        const actual = allData[i].r2;
        const p_prevR2 = parseInt(allData[i+2]?.r2 || "0", 10);
        const p_lastR2 = parseInt(allData[i+1]?.r2 || "0", 10);
        const p_lastR4 = allData[i+1]?.r4 || "0000";
        const pred = p.calc(p_prevR2, p_lastR2, p_lastR4, allData.slice(i+1)).toString().padStart(2, '0');
        
        if (pred === actual) hitCount++;
        else if (getMirror(pred) === actual) hitCount += 0.5;
      }
      ruleBiases[p.name] = 1 + (hitCount * 0.5);
    });

    // 3. Calculating predictions
    const allPredictions = PATTERNS.map(p => {
      try {
        const value = p.calc(prevR2, lastR2, lastR4, allData).toString().padStart(2, '0');
        return { name: p.name, value };
      } catch (e) {
        return { name: p.name, value: '00' };
      }
    });

    // 4. ENSEMBLE SCORING V4 (Deterministic)
    const lastR2Str = lastResult.r2.padStart(2, '0');
    const isRepeatDetected = lastR2Str === prevResult.r2.padStart(2, '0');
    
    // Recent 5 results to avoid
    const recent5Results = allData.slice(0, 5).map(r => r.r2.padStart(2, '0'));
    
    const numberScores: Record<string, number> = {};
    
    allPredictions.forEach(pred => {
      const hybridInfo = hybridPatterns.find(h => h.pattern.name === pred.name);
      
      const accuracy = hybridInfo?.currentStats.directAccuracy || 0;
      const stability = hybridInfo?.stabilityScore || 0;
      const historical = hybridInfo?.historicalStats.directAccuracy || 0;
      const learningBonus = ruleBiases[pred.name] || 1.0;
      
      let weight = (accuracy * 0.5) + (stability * 0.3) + (historical * 0.2);
      weight = (weight / 2) * learningBonus;

      const gap = numberGaps[pred.value] || 0;
      
      // Dynamic Penalization
      if (recent5Results.includes(pred.value)) {
        // Strongly penalize numbers that just came out
        const recencyIndex = recent5Results.indexOf(pred.value);
        const penalty = 0.1 * (5 - recencyIndex); // Penalty 0.5, 0.4, 0.3, 0.2, 0.1
        weight *= penalty;
      } else if (gap > 30) {
        weight *= 1.4; // Cold number bonus
      } else if (gap > 15) {
        weight *= 1.2;
      }

      if (isRepeatDetected && pred.value === lastR2Str) weight *= 0.01;
      
      numberScores[pred.value] = (numberScores[pred.value] || 0) + weight;
    });
    
    const sortedNumbers = Object.entries(numberScores)
      .sort((a, b) => b[1] - a[1]);
    
    const resPri = sortedNumbers[0]?.[0] || allPredictions[0].value;
    
    console.log(`\n✅ SOLID BEST SELECTION (Ensemble V4): ${resPri}`);
    
    const resNum = parseInt(resPri, 10);

    // ===== HOT DIGITS FROM ALL 21 FORMULAS (Dynamic, max 4) =====
    const digitFreq = Array(10).fill(0);
    allPredictions.forEach(pred => {
      const tens = parseInt(pred.value[0], 10);
      const units = parseInt(pred.value[1], 10);
      digitFreq[tens]++;
      digitFreq[units]++;
    });
    const sortedHotDigits = digitFreq
      .map((freq, digit) => ({ digit, freq }))
      .sort((a, b) => b.freq - a.freq);
    
    // เลือกเลขเด่นแบบไดนามิก: ใช้ threshold 60% ของความถี่สูงสุด
    const maxFreq = sortedHotDigits[0]?.freq || 1;
    const threshold = maxFreq * 0.6;
    const hotDigits = sortedHotDigits
      .filter(d => d.freq >= threshold)
      .slice(0, 4)
      .map(x => x.digit);

    // 3-Digit Target: Use the new Unified 3D Engine
    const tripleStr = unified3DEngine.getTriple ? unified3DEngine.getTriple(allData) : "000";

    const mirrorPair = activePattern.getMirrorPair?.(resNum);
    const mirrorStr = mirrorPair?.toString().padStart(2, '0') || getMirror(resPri);

    const combinedConfidence = calculateCombinedConfidence(
      allPredictions,
      bestPatternInfo.stats,
      stats.topT,
      stats.topU
    );

    const latestResult = allData[0];
    const latestR2 = latestResult.r2.padStart(2, '0');
    const latestDrawnDate = latestResult.date;
    const recentDrawnNumbers = allData.slice(0, 5).map(r => r.r2.padStart(2, '0'));

    const patternPredictions = allPredictions.map(pred => {
      const hybridInfo = hybridPatterns.find(h => h.pattern.name === pred.name);
      const predictionNum = pred.value.padStart(2, '0');
      const isRecentlyDrawn = predictionNum === latestR2;
      const wasDrawnRecently = recentDrawnNumbers.includes(predictionNum);
      const mirrorNumber = getMirror(predictionNum);
      const runningDigits = hotDigits.slice(0, 4);

      return {
        name: pred.name,
        prediction: pred.value,
        isQualified: hybridInfo?.isQualified || false,
        isActiveMaster: hybridInfo?.isActiveMaster || false,
        historicalAccuracy: hybridInfo?.historicalStats.directAccuracy || 0,
        currentAccuracy: hybridInfo?.currentStats.directAccuracy || 0,
        maxConsecutive: hybridInfo?.historicalStats.maxConsecutiveHits || 0,
        stabilityScore: hybridInfo?.stabilityScore || 0,
        isRecentlyDrawn: isRecentlyDrawn,
        lastDrawnDate: wasDrawnRecently ? latestDrawnDate : '',
        mirrorNumber: mirrorNumber,
        runningDigits: runningDigits
      };
    });

    setAllPatternPredictions(patternPredictions);

    setManualRes({
      primary: resPri,
      mirror: mirrorStr,
      rhythm: ((parseInt(resPri[0]) + 5) % 10).toString() + ((parseInt(resPri[1]) + 3) % 10).toString(),
      triple: tripleStr,
      confidence: combinedConfidence,
      formulaName: activePattern.name
    });
  };

  const filteredData = useMemo(() => {
    return allData.filter(i => 
      (yearFilter === 'all' || i.year === yearFilter) && 
      (i.date.includes(searchTerm) || i.r2.includes(searchTerm) || i.r3.includes(searchTerm))
    );
  }, [allData, yearFilter, searchTerm]);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      {/* Header */}
      <header className="glass-card flex flex-col md:flex-row justify-between items-center gap-6 mb-8 !py-4">
        <div className="flex items-center gap-4">
          <div className="animate-float p-3 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl shadow-lg shadow-cyan-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <h1 className="text-white font-black text-xl md:text-3xl leading-none">
              LAO LOTTO <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 glow-cyan">AI MASTER</span>
            </h1>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">TiGDev Enterprise Production v5.0</p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 items-center">
          <button onClick={loadData} className="btn-sync">
            {loading ? 'SYNCING DATA...' : 'SYNC SYSTEM'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 space-y-8">
          {/* Neural Quantum AI - TOP CARD */}
          <div className="glass-card !border-t-4 !border-t-purple-600 !bg-gradient-to-br from-purple-900/20 to-transparent relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <svg className="w-32 h-32 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.464 15.05a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 14a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1z" />
              </svg>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                <p className="section-title text-purple-400 !mb-2">
                  <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping"></span>
                  NEURAL QUANTUM AI (Deep Learning V4)
                </p>
                <h2 className="text-3xl md:text-5xl font-black text-white glow-purple tracking-tighter">
                  {isTraining ? (
                    <span className="animate-pulse">TRAINING AI...</span>
                  ) : neuralPrediction ? (
                    neuralPrediction.prediction
                  ) : (
                    '--'
                  )}
                </h2>
                <div className="mt-2 flex items-center gap-3 justify-center md:justify-start">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Score:</span>
                  <span className="text-purple-400 font-black text-xs">
                    {neuralPrediction ? (neuralPrediction.confidence * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-2">
                <div className="flex gap-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-purple-500 transition-all duration-1000 ${isTraining ? 'animate-shimmer' : ''}`} style={{ width: isTraining ? '100%' : '75%' }}></div>
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                  {isTraining ? 'Processing Tensor History...' : 'Model Optimized for 00-99 Prediction'}
                </p>
                <button 
                  onClick={trainNeuralAI} 
                  disabled={isTraining}
                  className="mt-2 px-4 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl text-[10px] font-black text-purple-400 uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isTraining ? 'NEURAL ENGINE BUSY' : '⚡ FORCE RE-TRAIN'}
                </button>
              </div>
            </div>
          </div>

          {/* Main Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card !border-t-4 !border-t-emerald-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <svg className="w-24 h-24 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="section-title text-emerald-500">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                AI MASTER ({bestPatternInfo?.pattern.name || 'ANALYZING...'})
              </p>
              <div className="huge-text-display glow-emerald">{stats?.aiMaster}</div>
              <div className="mt-4 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Confidence Level</span>
                <span className="text-emerald-400">{bestPatternInfo?.stats.directAccuracy.toFixed(1)}% Direct</span>
              </div>
            </div>

            {/* Running Digits Card */}
            <div className="glass-card !border-t-4 !border-t-cyan-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <svg className="w-24 h-24 text-cyan-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <p className="section-title text-cyan-500">
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                เลขเด่นประจำวัน
              </p>
              <div className="mt-6 grid grid-cols-5 gap-3">
                {stats?.runningDigits.map((digit, idx) => (
                  <div
                    key={idx}
                    className="aspect-square flex items-center justify-center bg-slate-900/60 rounded-xl border border-cyan-500/20 group-hover:border-cyan-500/40 transition-all"
                  >
                    <span className="text-2xl font-black text-white group-hover:text-cyan-400 group-hover:scale-110 transition-all">
                      {digit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Alternative Numbers</span>
                <span className="text-cyan-400">{stats?.runningDigits.length} digits</span>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowRunningLogs(!showRunningLogs)}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    showRunningLogs
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                  }`}
                >
                  {showRunningLogs ? '📖 HIDE DAILY LOGS' : '📋 VIEW DAILY LOGS'}
                </button>
              </div>

              {/* RUNNING DIGITS CUMULATIVE STATISTICS */}
              {runningDigitsStats.history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-cyan-500/20">
                  <div className="flex flex-col gap-4">
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest text-center">
                      📊 สถิติสะสมตั้งแต่วันที่ 02/01/2569 ถึงปัจจุบัน
                    </p>
                    <div className="flex items-center justify-around">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">ถูก (ครั้ง)</p>
                        <p className="text-2xl font-black text-emerald-400">{runningDigitsStats.correct}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">ผิด (ครั้ง)</p>
                        <p className="text-2xl font-black text-red-400">{runningDigitsStats.incorrect}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">แม่นยำ</p>
                        <p className="text-2xl font-black text-cyan-400">{runningDigitsStats.accuracy.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* DAILY LOGS MODAL OVERLAY */}
            {showRunningLogs && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                  onClick={() => setShowRunningLogs(false)}
                ></div>

                {/* Modal Content */}
                <div className="relative w-full max-w-6xl max-h-[95vh] bg-slate-900 border border-cyan-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                  {/* Header */}
                  <div className="flex-shrink-0 p-4 sm:p-6 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="w-full sm:w-auto">
                        <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
                          <span className="text-2xl sm:text-3xl">📋</span>
                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">DAILY LOGS</span>
                        </h3>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                          สถิติย้อนหลัง <span className="text-cyan-400">{runningDigitsStats.history.length} งวด</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4">
                        {/* Stats Summary */}
                        <div className="flex gap-2 sm:gap-4 flex-1 sm:flex-none">
                          <div className="flex-1 sm:flex-none text-center px-2 sm:px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">ถูก</p>
                            <p className="text-base sm:text-lg font-black text-emerald-400">{runningDigitsStats.correct}</p>
                          </div>
                          <div className="flex-1 sm:flex-none text-center px-2 sm:px-3 py-1 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">ผิด</p>
                            <p className="text-base sm:text-lg font-black text-red-400">{runningDigitsStats.incorrect}</p>
                          </div>
                          <div className="flex-1 sm:flex-none text-center px-2 sm:px-3 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">แม่น</p>
                            <p className="text-base sm:text-lg font-black text-cyan-400">{runningDigitsStats.accuracy.toFixed(1)}%</p>
                          </div>
                        </div>
                        {/* Close Button */}
                        <button
                          onClick={() => setShowRunningLogs(false)}
                          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500/50 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Table Content - Scrollable */}
                  <div className="flex-1 overflow-auto p-2 sm:p-6">
                    <div className="min-w-[500px] sm:min-w-full">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-900 z-10">
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">วันที่</th>
                            <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">เลขเด่นที่คำนวณได้</th>
                            <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">ผลที่ออก</th>
                            <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">ผลลัพธ์</th>
                            <th className="text-right py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runningDigitsStats.history.map((log, idx) => (
                            <tr
                              key={idx}
                              className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                                log.status === 'WIN' ? 'bg-emerald-500/5' : log.status === 'LOSS' ? 'bg-red-500/5' : ''
                              }`}
                            >
                              <td className="py-3 px-2 sm:px-4">
                                <span className={`font-black text-[11px] sm:text-sm ${log.status === 'PENDING' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`}>
                                  {log.date}
                                </span>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className="flex justify-center gap-1 sm:gap-2">
                                  {log.predicted.map((d, i) => (
                                    <span
                                      key={i}
                                      className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg font-black text-xs sm:text-sm ${
                                        log.status === 'WIN' && log.actual.includes(d.toString())
                                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-110'
                                          : 'bg-slate-800 text-white'
                                      }`}
                                    >
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <span className={`text-base sm:text-lg font-black ${log.status === 'WIN' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {log.actual}
                                </span>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                {log.status === 'WIN' ? (
                                  <div className="flex flex-col items-center">
                                    <span className="text-emerald-400 font-black text-[9px] sm:text-xs">MATCHED</span>
                                    <span className="text-[8px] sm:text-[10px] text-slate-600 font-black">{log.matchedDigits} DIGITS</span>
                                  </div>
                                ) : log.status === 'LOSS' ? (
                                  <span className="text-red-400 font-black text-[9px] sm:text-xs opacity-50">MISS</span>
                                ) : (
                                  <span className="text-cyan-400 font-black text-[9px] sm:text-xs animate-pulse">AWAITING...</span>
                                )}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-right">
                                {log.status === 'WIN' ? (
                                  <span className="px-2 sm:px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
                                    WIN ✅
                                  </span>
                                ) : log.status === 'LOSS' ? (
                                  <span className="px-2 sm:px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
                                    LOSS ❌
                                  </span>
                                ) : (
                                  <span className="px-2 sm:px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    WAIT 🔄
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* REPEAT ANALYSIS */}
          {repeatAnalysis && allData.length > 0 && (
            <div className={`glass-card !border-t-4 ${
              repeatAnalysis.confidenceLevel === 'HIGH' ? '!border-t-red-500' :
              repeatAnalysis.confidenceLevel === 'MEDIUM' ? '!border-t-amber-500' :
              '!border-t-emerald-500'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="section-title text-amber-500">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                    REPEAT ANALYSIS (วิเคราะห์เลขซ้ำ)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    งวดล่าสุด: <span className="text-white font-black">{allData[0].date}</span> ออก: <span className="text-amber-400 font-black text-lg">{allData[0].r2}</span>
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${
                  repeatAnalysis.confidenceLevel === 'HIGH' ? 'bg-red-500/20 border-red-500/30' :
                  repeatAnalysis.confidenceLevel === 'MEDIUM' ? 'bg-amber-500/20 border-amber-500/30' :
                  'bg-emerald-500/20 border-emerald-500/30'
                }`}>
                  <span className={`text-2xl font-black ${
                    repeatAnalysis.confidenceLevel === 'HIGH' ? 'text-red-400' :
                    repeatAnalysis.confidenceLevel === 'MEDIUM' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {Number.isFinite(repeatAnalysis.repeatPercentage) ? repeatAnalysis.repeatPercentage.toFixed(1) : '0.0'}%
                  </span>
                  <p className="text-[8px] font-black uppercase text-slate-500">Repeat Rate</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Total Occurrences</p>
                  <p className="text-2xl font-black text-white">{repeatAnalysis.totalOccurrences} <span className="text-sm text-slate-500">ครั้ง</span></p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Repeat Next Draw</p>
                  <p className="text-2xl font-black text-amber-400">{repeatAnalysis.repeatAfterOne} <span className="text-sm text-slate-500">ครั้ง</span></p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Avg Gap</p>
                  <p className="text-2xl font-black text-cyan-400">{repeatAnalysis.averageGap.toFixed(1)} <span className="text-sm text-slate-500">งวด</span></p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Last Seen</p>
                  <p className="text-sm font-black text-purple-400">{repeatAnalysis.lastSeenDate}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase mb-2">
                  <span>Repeat Probability</span>
                  <span>{Number.isFinite(repeatAnalysis.repeatPercentage) ? repeatAnalysis.repeatPercentage.toFixed(1) : '0.0'}%</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      repeatAnalysis.repeatPercentage > 20 ? 'bg-red-500' :
                      repeatAnalysis.repeatPercentage > 10 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(Number.isFinite(repeatAnalysis.repeatPercentage) ? repeatAnalysis.repeatPercentage * 2 : 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`p-4 rounded-xl border ${
                repeatAnalysis.confidenceLevel === 'HIGH' ? 'bg-red-500/10 border-red-500/30' :
                repeatAnalysis.confidenceLevel === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <p className={`text-sm font-black ${
                  repeatAnalysis.confidenceLevel === 'HIGH' ? 'text-red-400' :
                  repeatAnalysis.confidenceLevel === 'MEDIUM' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {repeatAnalysis.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Backtest Statistics */}
          {bestPatternInfo && (
            <section className="glass-card border-l-8 border-l-emerald-500">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white flex items-center gap-3">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs">TOP PERFORMANCE</span>
                  STATISTICS
                </h2>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Model</p>
                   <p className="text-sm font-black text-emerald-400">{bestPatternInfo.pattern.name}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                  <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Direct Hits</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white leading-none">{bestPatternInfo.stats.directHits}</span>
                    <span className="text-emerald-400 font-black text-sm mb-1">/ {bestPatternInfo.stats.totalRounds}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${bestPatternInfo.stats.directAccuracy}%` }}></div>
                  </div>
                </div>

                <div className="p-6 bg-cyan-500/5 rounded-2xl border border-cyan-500/20">
                  <p className="text-[10px] font-black text-cyan-500/60 uppercase tracking-widest mb-1">Running Hits</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white leading-none">{bestPatternInfo.stats.runningHits}</span>
                    <span className="text-cyan-400 font-black text-sm mb-1">งวด</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${bestPatternInfo.stats.runningAccuracy}%` }}></div>
                  </div>
                </div>

                <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                  <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mb-1">Accuracy Score</p>
                  <div className="text-4xl font-black text-white leading-none">
                    {Math.round(bestPatternInfo.stats.directAccuracy + (bestPatternInfo.stats.runningHits / bestPatternInfo.stats.totalRounds * 100))}%
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase mt-2">Combined Confidence</p>
                </div>
              </div>
            </section>
          )}

          {/* Backyard Strategy */}
          <section className="glass-card !border-l-8 !border-l-indigo-600 !bg-indigo-600/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="section-title text-indigo-400 !mb-0">Backyard Strategy (ชุดเสริม)</h2>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {backyardBacktest && (
                  <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/30">
                    <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                      Running {backyardBacktest.runningAccuracy.toFixed(1)}% ({backyardBacktest.runningHits}/{backyardBacktest.totalRounds})
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-500">|</span>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                      Exact {backyardBacktest.accuracy.toFixed(1)}% ({backyardBacktest.hits}/{backyardBacktest.totalRounds})
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setShowBackyardLogs(!showBackyardLogs)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    showBackyardLogs
                      ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/30'
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                  }`}
                >
                  {showBackyardLogs ? ' HIDE LOG' : '📊 VIEW LOG'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stats?.backyard.map((num, i) => (
                <div key={i} className="bg-slate-950/60 p-4 rounded-2xl border border-indigo-500/10 text-center hover:border-indigo-500/30 transition-all group">
                  <div className="text-2xl font-black text-white group-hover:scale-110 transition-transform">{num}</div>
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">UNIT {i+1}</div>
                </div>
              ))}
            </div>

            {backyardBacktest && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-6">
                <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-emerald-500/20 text-center">
                  <div className="text-[8px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Running</div>
                  <div className="text-lg sm:text-xl font-black text-white">{backyardBacktest.runningAccuracy.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-indigo-500/20 text-center">
                  <div className="text-[8px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Exact</div>
                  <div className="text-lg sm:text-xl font-black text-white">{backyardBacktest.accuracy.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-amber-500/20 text-center">
                  <div className="text-[8px] sm:text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">🔥 Run Streak</div>
                  <div className="text-lg sm:text-xl font-black text-white">{backyardBacktest.runningStreak.best}</div>
                </div>
                <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-cyan-500/20 text-center">
                  <div className="text-[8px] sm:text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">🔥 Exact Streak</div>
                  <div className="text-lg sm:text-xl font-black text-white">{backyardBacktest.streak.best}</div>
                </div>
              </div>
            )}

            {showBackyardLogs && backyardBacktest && (
              <div className="mt-6 bg-slate-950/60 rounded-2xl border border-indigo-500/20 overflow-hidden">
                <div className="p-4 border-b border-indigo-500/10">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Backyard History Log (30 งวดล่าสุด)</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-950/90 border-b border-indigo-500/10">
                      <tr>
                        <th className="p-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">งวด</th>
                        <th className="p-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">ที่ทำนาย</th>
                        <th className="p-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">ผลออก</th>
                        <th className="p-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Running</th>
                        <th className="p-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Exact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backyardBacktest.hitDetails.map((detail, i) => (
                        <tr key={i} className={`border-b border-slate-800/50 ${detail.isRunning ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                          <td className="p-3 font-bold text-white">{detail.date}</td>
                          <td className="p-3 text-center font-mono text-indigo-300">{detail.predicted.join(', ')}</td>
                          <td className="p-3 text-center font-mono font-black text-white">{detail.actual}</td>
                          <td className="p-3 text-center">
                            {detail.isRunning
                              ? <span className="text-emerald-400 font-black">✅ ตรง</span>
                              : <span className="text-red-400 font-black">❌ ผิด</span>
                            }
                          </td>
                          <td className="p-3 text-center">
                            {detail.isHit
                              ? <span className="text-amber-400 font-black">🎯 ถูก</span>
                              : <span className="text-slate-500">-</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Engine */}
          <section className="glass-card bg-gradient-to-br from-slate-900/60 to-slate-900/40">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Quantum Analysis Engine</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  ชุดข้อมูลประมวลผลผ่าน Neural Network ประจำงวด: <span className="text-emerald-400 font-bold">{allData[0]?.date || '--/--/----'}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-[10px] font-black text-emerald-400 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  LIVE ENGINE
                </span>
                <button 
                  onClick={loadData} 
                  className={`btn-sync !py-1.5 !px-4 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={loading}
                >
                  {loading ? 'SYNCING...' : 'RE-ANALYZE'}
                </button>
                <button 
                  onClick={() => setShowLeaderboard(!showLeaderboard)} 
                  className="btn-sync !py-1.5 !px-4 !bg-purple-600/20 !border-purple-500/30 hover:!bg-purple-600/30"
                >
                  {showLeaderboard ? '👁️ HIDE' : ' ALGORITHM LEADERBOARD'}
                </button>
              </div>
            </div>

            {manualRes && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-slate-950/60 rounded-[2.5rem] border border-blue-500/20 shadow-inner group">
                    <p className="text-center text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4">AI 3-Digit Target</p>
                    <div className="ultra-huge-text glow-blue group-hover:scale-105 transition-transform duration-500">{manualRes.triple}</div>
                  </div>
                  <div className="p-8 bg-slate-950/60 rounded-[2.5rem] border border-cyan-500/20 shadow-inner group">
                    <p className="text-center text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-4">เลขเด่นประจำวัน</p>
                    <div className="flex justify-center gap-4">
                      {stats?.runningDigits.map((digit, idx) => (
                        <div key={idx} className="ultra-huge-text glow-cyan group-hover:-translate-x-2 transition-transform duration-500">{digit}</div>
                      ))}
                    </div>
                    <p className="text-center text-[10px] font-black text-cyan-400 mt-2">{stats?.runningDigits.length} DIGITS</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">📊 ผลทำนายจาก 21 สูตร (กรองเลขซ้ำ - เลือกสูตรที่ดีที่สุด)</p>
                  {(() => {
                    // Group predictions by value, keep only the best formula for each number
                    const predictionMap: Record<string, { name: string; accuracy: number; stability: number; score: number }> = {};
                    allPatternPredictions
                      .filter(pred => pred.currentAccuracy >= 10.0)
                      .forEach(pred => {
                      const existing = predictionMap[pred.prediction];
                      const predScore = (pred.currentAccuracy * 0.5) + (pred.stabilityScore * 0.3) + (pred.historicalAccuracy * 0.2);
                      if (!existing || predScore > existing.score) {
                        predictionMap[pred.prediction] = {
                          name: pred.name,
                          accuracy: pred.currentAccuracy,
                          stability: pred.stabilityScore,
                          score: predScore
                        };
                      }
                    });
                    // Sort by score descending
                    const uniquePredictions = Object.entries(predictionMap)
                      .sort((a, b) => b[1].score - a[1].score);
                    
                    return uniquePredictions.map(([number, info], idx) => (
                      <div key={number} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        idx === 0 
                          ? 'bg-gradient-to-r from-emerald-500/15 to-transparent border-emerald-500/40' 
                          : 'bg-slate-900/50 border-slate-700/50 hover:border-cyan-500/30'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                            idx === 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-cyan-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-2xl font-black text-white">{number}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{info.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black">
                          <span className="text-emerald-400">Accuracy: {info.accuracy.toFixed(1)}%</span>
                          <span className="text-cyan-400">Stability: {info.stability}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </section>

          {/* Leaderboard Section - HYBRID APPROACH */}
          <section className="glass-card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <div className="w-full sm:w-auto">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Algorithm Leaderboard</h3>
                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">การจัดอันดับประสิทธิภาพ AI ENGINE แบบ Hybrid</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    showExplanation
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  {showExplanation ? '📖 HIDE GUIDE' : '📖 VIEW GUIDE'}
                </button>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                    {hybridPatterns.filter(h => h.isQualified).length} Qualified
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/30">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  <span className="text-[9px] sm:text-[10px] font-black text-amber-400 uppercase tracking-tighter">
                    Hybrid Mode
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {hybridPatterns.map((h, idx) => {
                const isBest = h.isActiveMaster;
                const isQualified = h.isQualified;
                const historicalAccuracy = h.historicalStats.directAccuracy;
                const currentAccuracy = h.currentStats.directAccuracy;
                const maxConsecutive = h.historicalStats.maxConsecutiveHits;
                const currentConsecutive = h.currentStats.maxConsecutiveHits;
                const stability = h.stabilityScore;

                return (
                  <div
                    key={h.pattern.name}
                    className={`group relative flex flex-col xl:flex-row items-start xl:items-center justify-between p-4 sm:p-5 rounded-[1.5rem] border transition-all duration-500 ${
                      isBest
                        ? 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40 shadow-xl shadow-emerald-500/10'
                        : isQualified
                        ? 'bg-slate-900/50 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-slate-900/70'
                        : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 xl:gap-6 mb-3 xl:mb-0 w-full xl:w-auto">
                      <div className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl font-black text-lg sm:text-xl transition-transform group-hover:scale-110 flex-shrink-0 ${
                        isBest ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' : 
                        isQualified ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <h4 className={`text-sm sm:text-base xl:text-lg font-black tracking-tight ${isBest ? 'text-white' : isQualified ? 'text-cyan-300' : 'text-slate-300'}`}>
                            {h.pattern.name}
                          </h4>
                          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                            {isBest && (
                              <div className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse" title="Active Master">
                                <span className="text-sm sm:text-lg">👑</span>
                              </div>
                            )}
                            {isQualified && !isBest && (
                              <div className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20" title="Qualified">
                                <span className="text-xs sm:text-sm text-emerald-400 font-black">✓</span>
                              </div>
                            )}
                            {!isQualified && (
                              <div className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500/10 border border-red-500/20" title="Unstable">
                                <span className="text-xs sm:text-sm text-red-400 font-black"></span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* HYBRID INFO */}
                        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 xl:gap-x-4 gap-y-1 sm:gap-y-1.5 xl:gap-y-2 mt-1 sm:mt-1.5 xl:mt-2">
                          <span className="text-[7px] sm:text-[8px] xl:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Stability: <span className={stability >= 70 ? 'text-emerald-400' : stability >= 50 ? 'text-amber-400' : 'text-red-400'}>{stability}%</span>
                          </span>
                          <span className="text-[7px] sm:text-[8px] xl:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Max Streak: <span className={maxConsecutive >= 6 ? 'text-emerald-400' : 'text-red-400'}>{maxConsecutive} งวด</span>
                          </span>
                          <span className="text-[7px] sm:text-[8px] xl:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Current: <span className={currentConsecutive >= 6 ? 'text-emerald-400' : currentConsecutive >= 4 ? 'text-amber-400' : 'text-red-400'}>{currentConsecutive} งวด</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full xl:w-auto gap-3 sm:gap-4 xl:gap-6 border-t border-slate-800 xl:border-t-0 pt-3 xl:pt-0 mt-3 xl:mt-0">
                      <div className="flex gap-3 sm:gap-4 xl:gap-6">
                        {/* Historical Accuracy */}
                        <div className="text-center">
                          <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 sm:mb-1">Historical (30)</p>
                          <div className={`text-base sm:text-lg xl:text-xl font-black ${isBest ? 'text-emerald-400' : isQualified ? 'text-cyan-400' : 'text-white'}`}>
                            {historicalAccuracy.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>
                        
                        {/* Current Accuracy */}
                        <div className="text-center">
                          <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 sm:mb-1">Current (10)</p>
                          <div className={`text-base sm:text-lg xl:text-xl font-black ${
                            currentAccuracy >= historicalAccuracy ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {currentAccuracy.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>

                        {/* Trending Indicator */}
                        <div className="flex items-center">
                          {currentAccuracy >= historicalAccuracy + 5 ? (
                            <span className="text-lg sm:text-xl xl:text-2xl text-emerald-400" title="Trending Up">📈</span>
                          ) : currentAccuracy <= historicalAccuracy - 5 ? (
                            <span className="text-lg sm:text-xl xl:text-2xl text-red-400" title="Trending Down">📉</span>
                          ) : (
                            <span className="text-lg sm:text-xl xl:text-2xl text-amber-400" title="Stable">️</span>
                          )}
                        </div>
                      </div>

                      {/* Stability Bar - Show on larger screens */}
                      <div className="hidden xl:block w-24 xl:w-32 ml-2 xl:ml-4">
                        <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase mb-2">
                          <span>Stability</span>
                          <span>{stability}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ease-out ${
                              stability >= 70 ? 'bg-emerald-500' : 
                              stability >= 50 ? 'bg-amber-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${stability}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* HYBRID EXPLANATION - คำอธิบายความหมายต่างๆ */}
            {showExplanation && (
              <div className="mt-6 p-5 bg-slate-900/40 rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500">
                <h4 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                  <span className="text-lg">📖</span> คำอธิบายความหมายของแต่ละตัวชี้วัด
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px]">
                  {/* คอลัมน์ซ้าย */}
                  <div className="space-y-4">
                    {/* Historical Accuracy */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex-shrink-0">
                        <span className="text-xs font-black text-cyan-400">H</span>
                      </div>
                      <div>
                        <p className="font-black text-cyan-400 uppercase">Historical (30) - ความแม่นยำย้อนหลัง 30 งวด</p>
                        <p className="text-slate-500 mt-1">
                          เปอร์เซ็นต์การทายถูกตรงตัวใน 30 งวดย้อนหลัง ยิ่งสูงยิ่งดี (แนะนำ &gt; 15%)
                        </p>
                      </div>
                    </div>

                    {/* Current Accuracy */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
                        <span className="text-xs font-black text-emerald-400">C</span>
                      </div>
                      <div>
                        <p className="font-black text-emerald-400 uppercase">Current (10) - ความแม่นยำ 10 งวดล่าสุด</p>
                        <p className="text-slate-500 mt-1">
                          เปอร์เซ็นต์การทายถูกตรงตัวใน 10 งวดล่าสุด สะท้อนประสิทธิภาพปัจจุบัน (สำคัญที่สุด!)
                        </p>
                      </div>
                    </div>

                    {/* Stability */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex-shrink-0">
                        <span className="text-xs font-black text-amber-400">S</span>
                      </div>
                      <div>
                        <p className="font-black text-amber-400 uppercase">Stability - คะแนนความมั่นคง (0-100%)</p>
                        <p className="text-slate-500 mt-1">
                          วัดความสม่ำเสมอของสูตร สูตรที่มี Performance คงที่ได้คะแนนสูง
                          <br />
                          <span className="text-emerald-400">≥ 70% = มั่นคงมาก</span> | <span className="text-amber-400">50-69% = ปานกลาง</span> | <span className="text-red-400">&lt; 50% = ไม่มั่นคง</span>
                          <br />
                          <span className="text-slate-600">⚠️ ถ้า Accuracy &lt; 5% จะได้ Stability = 0% ทันที</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* คอลัมน์ขวา */}
                  <div className="space-y-4">
                    {/* Max Consecutive */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                        <span className="text-xs font-black text-purple-400">M</span>
                      </div>
                      <div>
                        <p className="font-black text-purple-400 uppercase">Max Consecutive - ทายถูกติดต่อกันสูงสุด</p>
                        <p className="text-slate-500 mt-1">
                          จำนวนงวดสูงสุดที่สูตรทายถูกติดต่อกัน (ตรงตัว หรือ Running) ยิ่งสูงยิ่งแสดงถึงความน่าเชื่อถือ
                          <br />
                          <span className="text-emerald-400">≥ 6 งวด = ดีมาก</span> | <span className="text-amber-400">4-5 งวด = พอใช้</span> | <span className="text-red-400">&lt; 4 งวด = ควรระวัง</span>
                        </p>
                      </div>
                    </div>

                    {/* Current Consecutive */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/30 flex-shrink-0">
                        <span className="text-xs font-black text-pink-400">CC</span>
                      </div>
                      <div>
                        <p className="font-black text-pink-400 uppercase">Current - ทายถูกติดต่อกันปัจจุบัน</p>
                        <p className="text-slate-500 mt-1">
                          จำนวนงวดที่ทายถูกติดต่อกันในปัจจุบัน (กำลังเกิดขึ้น) ถ้ายิ่งสูงแสดงว่าสูตรกำลัง "Hot"
                          <br />
                          <span className="text-emerald-400">≥ 6 งวด = กำลัง Hot 🔥</span> | <span className="text-amber-400">3-5 งวด = ปกติ</span> | <span className="text-red-400">0-2 งวด = กำลัง Cold ❄️</span>
                        </p>
                      </div>
                    </div>

                    {/* Trend Arrows */}
                    <div className="flex items-start gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                        <span className="text-xs">📊</span>
                      </div>
                      <div>
                        <p className="font-black text-blue-400 uppercase">Trend - แนวโน้ม (ลูกศร)</p>
                        <p className="text-slate-500 mt-1">
                          <span className="text-emerald-400">📈 กำลังดีขึ้น</span> = Current &gt; Historical + 5% (สูตรกำลังพัฒนา)
                          <br />
                          <span className="text-amber-400">➡️ คงที่</span> = ต่างกันไม่เกิน ±5% (เสถียร)
                          <br />
                          <span className="text-red-400">📉 กำลังแย่ลง</span> = Current &lt; Historical - 5% (ควรเปลี่ยนสูตร)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* สัญลักษณ์เพิ่มเติม */}
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <h5 className="text-xs font-black text-slate-400 mb-3">สัญลักษณ์และสถานะ:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                    <div className="flex items-start gap-2">
                      <span className="text-base">👑</span>
                      <div>
                        <p className="font-black text-emerald-400">Active Master (มงกุฎ)</p>
                        <p className="text-slate-600">สูตรที่ระบบเลือกใช้งานอยู่ เปลี่ยนเฉพาะเมื่อล้มเหลว หรือมีสูตรที่ดีกว่าชัดเจน</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base text-emerald-400 font-black">✓</span>
                      <div>
                        <p className="font-black text-emerald-400">Qualified (เครื่องหมายถูก)</p>
                        <p className="text-slate-600">สูตรที่ผ่านเกณฑ์ Max Consecutive ≥ 4 งวด มีความน่าเชื่อถือ</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base text-red-400 font-black">✗</span>
                      <div>
                        <p className="font-black text-red-400">Unqualified (เครื่องหมายผิด)</p>
                        <p className="text-slate-600">สูตรที่ไม่ผ่านเกณฑ์ Max Consecutive &lt; 4 งวด ควรหลีกเลี่ยง</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">🔥</span>
                      <div>
                        <p className="font-black text-amber-400">Hot / Cold</p>
                        <p className="text-slate-600">Hot = กำลังทายถูกติดต่อกันหลายงวด | Cold = กำลังทายผิดหลายงวดติด</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* การให้คะแนน */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h5 className="text-xs font-black text-slate-400 mb-2">🏆 การคำนวณคะแนนจัดอันดับ:</h5>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[10px] space-y-1">
                    <p className="text-slate-500">คะแนนรวม = (Current × 40%) + (Stability × 30%) + (Historical × 20%) + (Trend × 10%)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <p className="font-black text-emerald-400">Current 40%</p>
                        <p className="text-slate-600">สำคัญที่สุด</p>
                      </div>
                      <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <p className="font-black text-amber-400">Stability 30%</p>
                        <p className="text-slate-600">ความมั่นคง</p>
                      </div>
                      <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                        <p className="font-black text-cyan-400">Historical 20%</p>
                        <p className="text-slate-600">อดีต</p>
                      </div>
                      <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                        <p className="font-black text-blue-400">Trend 10%</p>
                        <p className="text-slate-600">แนวโน้ม</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* คำแนะนำ */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h5 className="text-xs font-black text-slate-400 mb-2">💡 คำแนะนำการใช้งาน:</h5>
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 text-[10px] space-y-2">
                    <p className="text-slate-400">
                      <span className="text-emerald-400 font-black">✅ ควรใช้สูตรที่:</span>
                    </p>
                    <ul className="text-slate-500 space-y-1 ml-4 list-disc">
                      <li>มี <span className="text-emerald-400">Current (10) &gt; 10%</span> (ทายถูกอย่างน้อย 1 ใน 10 งวด)</li>
                      <li>มี <span className="text-emerald-400">Stability &gt; 60%</span> (มีความมั่นคง)</li>
                      <li>มี <span className="text-emerald-400">Max Consecutive ≥ 4 งวด</span> (เคยทายถูกติดต่อกัน)</li>
                      <li>มี <span className="text-emerald-400">Trend 📈 หรือ ➡️</span> (กำลังดีขึ้นหรือคงที่)</li>
                    </ul>
                    <p className="text-slate-400 mt-2">
                      <span className="text-red-400 font-black">❌ ควรหลีกเลี่ยงสูตรที่:</span>
                    </p>
                    <ul className="text-slate-500 space-y-1 ml-4 list-disc">
                      <li>มี <span className="text-red-400">Current (10) = 0%</span> (ไม่ถูกเลย 10 งวดล่าสุด)</li>
                      <li>มี <span className="text-red-400">Stability &lt; 40%</span> (ไม่มั่นคง)</li>
                      <li>มี <span className="text-red-400">Trend 📉</span> (กำลังแย่ลง)</li>
                      <li>มีเครื่องหมาย <span className="text-red-400">✗</span> (ไม่ผ่านเกณฑ์)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ALGORITHM LEADERBOARD MODAL OVERLAY */}
          {showLeaderboard && allPatternPredictions.length > 0 && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
                onClick={() => { setShowLeaderboard(false); setExpandedPattern(null); }}
              ></div>
              
              {/* Modal Content */}
              <div className="relative w-full max-w-7xl max-h-[95vh] bg-slate-900 border border-purple-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-purple-500/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex-shrink-0 p-4 sm:p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="w-full sm:w-auto">
                      <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl">🎯</span>
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">ALGORITHM LEADERBOARD</span>
                      </h3>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        เปรียบเทียบเลขที่แต่ละสูตรทำนาย พร้อมสถิติย้อนหลัง
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4">
                      {/* Stats Summary */}
                      <div className="flex gap-2 sm:gap-3 flex-1 sm:flex-none">
                        <div className="flex-1 sm:flex-none text-center px-2 sm:px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">Qualified</p>
                          <p className="text-base sm:text-lg font-black text-emerald-400">{hybridPatterns.filter(h => h.isQualified).length}</p>
                        </div>
                        <div className="text-center px-2 sm:px-3 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20 flex-1 sm:flex-none">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">Total</p>
                          <p className="text-base sm:text-lg font-black text-purple-400">{allPatternPredictions.length}</p>
                        </div>
                      </div>
                      
                      {/* Close Button */}
                      <button
                        onClick={() => { setShowLeaderboard(false); setExpandedPattern(null); }}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-purple-500/50 transition-all flex-shrink-0"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Table Content - Scrollable */}
                <div className="flex-1 overflow-auto p-2 sm:p-6">
                  <div className="min-w-[800px] sm:min-w-full">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-900 z-10">
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">อันดับ</th>
                          <th className="text-left py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">สูตร</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">เลขทำนาย</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">สถานะ</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Hist (30)</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Curr (10)</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Streak</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Stability</th>
                          <th className="text-center py-3 px-2 sm:px-4 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPatternPredictions
                          .sort((a, b) => {
                            if (a.isActiveMaster && !b.isActiveMaster) return -1;
                            if (!a.isActiveMaster && b.isActiveMaster) return 1;
                            if (a.isQualified && !b.isQualified) return -1;
                            if (!a.isQualified && b.isQualified) return 1;
                            return b.historicalAccuracy - a.historicalAccuracy;
                          })
                          .map((pattern, idx) => (
                            <tr 
                              key={pattern.name}
                              className={`border-b border-slate-800/50 transition-colors ${
                                pattern.isActiveMaster 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/15' 
                                  : pattern.isQualified
                                  ? 'bg-slate-900/30 hover:bg-slate-900/50'
                                  : 'hover:bg-slate-900/30'
                              }`}
                            >
                              <td className="py-3 px-2 sm:px-4">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-xs sm:text-sm ${
                                  pattern.isActiveMaster 
                                    ? 'bg-emerald-500 text-slate-950' 
                                    : pattern.isQualified
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'bg-slate-800 text-slate-500'
                                }`}>
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4">
                                <div className={`font-black text-xs sm:text-sm ${
                                  pattern.isActiveMaster 
                                    ? 'text-emerald-400' 
                                    : pattern.isQualified
                                    ? 'text-cyan-300'
                                    : 'text-slate-400'
                                }`}>
                                  {pattern.name}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`inline-flex items-center justify-center w-14 sm:w-16 h-8 sm:h-10 rounded-lg font-black text-base sm:text-lg ${
                                    pattern.isRecentlyDrawn
                                      ? 'bg-red-500/30 border-2 border-red-500/50 text-red-400'
                                      : 'bg-slate-800 text-white'
                                  }`}>
                                    {pattern.prediction}
                                  </div>
                                  {pattern.isRecentlyDrawn && (
                                    <span className="text-[7px] sm:text-[8px] font-black text-red-400 uppercase tracking-tighter animate-pulse">
                                      ⚠️ ออกแล้ว!
                                    </span>
                                  )}
                                  {pattern.isRecentlyDrawn && (
                                    <div className="flex gap-1 mt-0.5 sm:mt-1">
                                      <span className="text-[7px] sm:text-[8px] text-slate-500">Mirror:</span>
                                      <span className="text-[8px] sm:text-[9px] font-black text-cyan-400">{pattern.mirrorNumber}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                {pattern.isActiveMaster ? (
                                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse">
                                    <span className="text-xl sm:text-2xl" title="Active Master">👑</span>
                                  </div>
                                ) : pattern.isQualified ? (
                                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <span className="text-lg sm:text-xl text-emerald-400 font-black" title="Qualified">✓</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/10 border border-red-500/20">
                                    <span className="text-lg sm:text-xl text-red-400 font-black" title="Unstable">✗</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className={`text-xs sm:text-sm font-black ${
                                  pattern.historicalAccuracy >= 10 ? 'text-emerald-400' : 
                                  pattern.historicalAccuracy >= 5 ? 'text-amber-400' : 'text-slate-400'
                                }`}>
                                  {pattern.historicalAccuracy.toFixed(1)}%
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className={`text-xs sm:text-sm font-black ${
                                  pattern.currentAccuracy >= 10 ? 'text-emerald-400' : 
                                  pattern.currentAccuracy >= 5 ? 'text-amber-400' : 'text-slate-400'
                                }`}>
                                  {pattern.currentAccuracy.toFixed(1)}%
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className={`text-xs sm:text-sm font-black ${
                                  pattern.maxConsecutive >= 6 ? 'text-emerald-400' : 
                                  pattern.maxConsecutive >= 4 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {pattern.maxConsecutive}
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <div className="flex items-center justify-center gap-1 sm:gap-2">
                                  <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-1000 ${
                                        pattern.stabilityScore >= 70 ? 'bg-emerald-500' :
                                        pattern.stabilityScore >= 50 ? 'bg-amber-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${pattern.stabilityScore}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-[10px] sm:text-xs font-black text-slate-500">{pattern.stabilityScore}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-4 text-center">
                                <button
                                  onClick={() => setExpandedPattern(expandedPattern === pattern.name ? null : pattern.name)}
                                  className="px-2 sm:px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/20 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-tighter transition-colors"
                                >
                                  {expandedPattern === pattern.name ? '▲ HIDE' : '▼ VIEW'}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* รายละเอียดขยายของแต่ละสูตร */}
                  {expandedPattern && (
                    <div className="mt-6 p-6 bg-slate-900/50 rounded-2xl border border-purple-500/30">
                      {(() => {
                        const pattern = allPatternPredictions.find(p => p.name === expandedPattern);
                        if (!pattern) return null;

                        const hybridInfo = hybridPatterns.find(h => h.pattern.name === pattern.name);
                        const backtestHits = hybridInfo?.historicalStats.hits || [];

                        return (
                          <div>
                            <h4 className="text-lg font-black text-purple-400 mb-4">
                              📊 รายละเอียด: {pattern.name}
                            </h4>

                            {pattern.isRecentlyDrawn && (
                              <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">⚠️</span>
                                  <div>
                                    <p className="text-sm font-black text-red-400">
                                      เลข {pattern.prediction} ออกในงวดล่าสุดแล้ว!
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                      วันที่ออก: {pattern.lastDrawnDate} | ไม่แนะนำให้ใช้เลขนี้
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className={`p-4 rounded-xl ${
                                pattern.isRecentlyDrawn 
                                  ? 'bg-red-500/10 border-2 border-red-500/30' 
                                  : 'bg-slate-800/50'
                              }`}>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">เลขทำนาย</p>
                                <p className={`text-3xl font-black ${
                                  pattern.isRecentlyDrawn ? 'text-red-400' : 'text-white'
                                }`}>
                                  {pattern.prediction}
                                </p>
                                {pattern.isRecentlyDrawn && (
                                  <p className="text-[9px] font-black text-red-400 mt-2">⚠️ ออกแล้ว!</p>
                                )}
                              </div>
                              <div className="p-4 bg-slate-800/50 rounded-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">เลขกระจก (ทางเลือก)</p>
                                <p className="text-3xl font-black text-cyan-400">{pattern.mirrorNumber}</p>
                                <p className="text-[9px] text-slate-500 mt-2">แนะนำถ้าเลขหลักออกแล้ว</p>
                              </div>
                              <div className="p-4 bg-slate-800/50 rounded-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">ความแม่นยำ (30 งวด)</p>
                                <p className="text-3xl font-black text-emerald-400">{pattern.historicalAccuracy.toFixed(1)}%</p>
                              </div>
                              <div className="p-4 bg-slate-800/50 rounded-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">ความแม่นยำ (10 งวด)</p>
                                <p className="text-3xl font-black text-cyan-400">{pattern.currentAccuracy.toFixed(1)}%</p>
                              </div>
                            </div>

                            {pattern.isRecentlyDrawn && (
                              <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                                <h5 className="text-sm font-black text-cyan-400 uppercase mb-3">
                                  เลขเด่นประจำวัน
                                </h5>
                                <div className="grid grid-cols-10 gap-2">
                                  {pattern.runningDigits.map((digit, idx) => (
                                    <div
                                      key={idx}
                                      className="p-2 bg-slate-800/50 rounded-lg text-center"
                                    >
                                      <span className="text-lg font-black text-white">{digit}</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[9px] text-slate-500 mt-2">
                                  ใช้หลักสิบหรือหลักหน่วยจากเลขที่ทำนาย ผสมกับ 0-9
                                </p>
                              </div>
                            )}

                            <h5 className="text-sm font-black text-slate-400 uppercase mb-3">📈 ผลย้อนหลัง 10 งวดล่าสุด</h5>
                            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                              {backtestHits.slice(0, 10).map((hit, idx) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-xl text-center ${
                                    hit.isDirect
                                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                                      : hit.isRunning
                                      ? 'bg-amber-500/20 border border-amber-500/30'
                                      : 'bg-red-500/10 border border-red-500/20'
                                  }`}
                                >
                                  <p className="text-[9px] font-black text-slate-500 mb-1">{hit.date.slice(0, 5)}</p>
                                  <p className="text-sm font-black text-white">{hit.predicted.toString().padStart(2, '0')}</p>
                                  <p className="text-[9px] text-slate-500 mt-1">→ {hit.actual.toString().padStart(2, '0')}</p>
                                  {hit.isDirect && (
                                    <span className="text-[9px] font-black text-emerald-400">✓ ถูก</span>
                                  )}
                                  {hit.isRunning && !hit.isDirect && (
                                    <span className="text-[9px] font-black text-amber-400">~ รันนิ่ง</span>
                                  )}
                                  {!hit.isDirect && !hit.isRunning && (
                                    <span className="text-[9px] font-black text-red-400">✗ ผิด</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* คำอธิบายสัญลักษณ์ */}
                  <div className="mt-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[10px]">
                      <div className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse flex-shrink-0">
                          <span className="text-lg">👑</span>
                        </div>
                        <div>
                          <p className="font-black text-slate-400 uppercase">Active Master</p>
                          <p className="text-slate-600">สูตรหลักที่ทำนายงวดถัดไป</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                          <span className="text-sm text-emerald-400 font-black">✓</span>
                        </div>
                        <div>
                          <p className="font-black text-slate-400 uppercase">Qualified</p>
                          <p className="text-slate-600">Max Streak ≥ 4 งวด</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex-shrink-0">
                          <span className="text-sm text-red-400 font-black">✗</span>
                        </div>
                        <div>
                          <p className="font-black text-slate-400 uppercase">Unstable</p>
                          <p className="text-slate-600">Max Streak {'<'} 4 งวด</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/30 border-2 border-red-500/50 flex-shrink-0">
                          <span className="text-sm font-black text-red-400">XX</span>
                        </div>
                        <div>
                          <p className="font-black text-slate-400 uppercase">ออกแล้ว!</p>
                          <p className="text-slate-600">เลขที่ทำนายตรงกับผลหวย</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                          <span className="text-sm text-purple-400 font-black">▼</span>
                        </div>
                        <div>
                          <p className="font-black text-slate-400 uppercase">ดูรายละเอียด</p>
                          <p className="text-slate-600">ผลย้อนหลัง + เลขทางเลือก</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card">
              <h3 className="section-title">Frequency Histogram</h3>
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.chartData || []}>
                    <XAxis dataKey="num" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'}} 
                    />
                    <Bar dataKey="count" fill="url(#colorBar)" radius={[6, 6, 0, 0]}>
                      <defs>
                        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card">
              <h3 className="section-title">Parity Distribution</h3>
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={stats?.parityData || []} 
                      innerRadius={60} 
                      outerRadius={85} 
                      paddingAngle={8} 
                      dataKey="value"
                      stroke="none"
                    >
                      {(stats?.parityData || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </main>

        <aside className="lg:col-span-4 space-y-8">
          <div className="glass-card !p-0 overflow-hidden">
            <div className="p-6 bg-slate-900/60 border-b border-slate-800">
              <h3 className="section-title !mb-4">Historical Terminal</h3>
              <div className="space-y-3">
                <select 
                  value={yearFilter} 
                  onChange={e => setYearFilter(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
                >
                  <option value="all">ALL YEARS</option>
                  {[2569, 2568, 2567, 2566, 2565, 2564].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Search results..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pl-10 text-sm font-bold text-white outline-none focus:border-cyan-500/50 transition-colors"
                  />
                  <svg className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="custom-scrollbar h-[calc(100vh-450px)] min-h-[500px] overflow-y-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="!text-left">Date</th>
                    <th className="text-center">3D</th>
                    <th className="text-right">2D</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-4">
                        <p className="text-[10px] font-black text-slate-500 group-hover:text-slate-400">{item.date}</p>
                      </td>
                      <td className="text-center">
                        <span className="text-sm font-black text-slate-300 group-hover:text-white">{item.r3}</span>
                      </td>
                      <td className="text-right">
                        <span className={`text-xl font-black ${idx === 0 ? 'text-cyan-400 glow-cyan' : 'text-blue-500'}`}>
                          {item.r2}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>

      <footer className="text-center py-12 mt-12 border-t border-slate-900 text-[10px] font-black text-slate-600 tracking-[0.4em] uppercase">
        TKK STUDIO ENTERPRISE • QUANTUM ENGINE v5.0 • {new Date().toLocaleDateString('th-TH')}
      </footer>
    </div>
  );
};

export default App;
