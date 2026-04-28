
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
  backtestPattern,
  findBestPattern,
  calculateCombinedConfidence,
  analyzeHybridPatterns,
  analyzeRepeatProbability,
  PATTERNS,
  calculateRunningDigits
  } from './services/lottoService';
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
    runningDigits: string[];        // NEW: Running digits
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

    // คำนวณเลขเด่นจากสูตรที่ 2: Multiplicative Scalar
    const runningDigits = calculateRunningDigits(lastResult.r4, parseInt(lastResult.r2, 10));

    return {
      topT, topU, chartData,
      parityData: [{ name: 'คู่', value: even }, { name: 'คี่', value: odd }],
      backyard: calculateBackyard(lastResult.r3, lastResult.r4),
      aiMaster: aiMasterNum,
      runningDigits: runningDigits
    };
  }, [allData, bestPatternInfo]);

  useEffect(() => {
    if (allData.length >= 2 && stats) {
      autoCalculate();
    }
  }, [allData, bestPatternInfo, stats]);

  // Recalculate Running Digits stats when data changes
  useEffect(() => {
    if (allData.length >= 2) {
      calculateRunningDigitsStats(allData);
    }
  }, [allData]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchLottoData();
    setAllData(data);

    if (data.length > 0) {
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
    const latest = data[0];
    const nextRunningDigits = calculateRunningDigits(latest.r4, parseInt(latest.r2, 10));
    history.push({
      date: 'งวดถัดไป',
      predicted: nextRunningDigits,
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

      const runningDigits = calculateRunningDigits(prev.r4, parseInt(prev.r2, 10));
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

    const totalRounds = correct + incorrect;
    const accuracy = totalRounds > 0 ? (correct / totalRounds * 100) : 0;

    setRunningDigitsStats({
      history: history.slice(0, 50), // เพิ่มการแสดงเป็น 50 งวด
      correct,
      incorrect,
      accuracy,
      currentStreak,
      bestStreak
    });
  };

  const autoCalculate = () => {
    if (allData.length < 2 || !bestPatternInfo || !stats) {
      return;
    }

    const lastResult = allData[0];
    const prevResult = allData[1];

    const prevR2 = parseInt(prevResult.r2, 10);
    const lastR2 = parseInt(lastResult.r2, 10);
    const lastR3 = lastResult.r3;
    const lastR4 = lastResult.r4;

    const activePattern = bestPatternInfo.pattern;

    // Predictions from ALL patterns for convergence check
    const allPredictions = PATTERNS.map(p => ({
      name: p.name,
      value: p.calc(prevR2, lastR2, lastR4, allData).toString().padStart(2, '0')
    }));

    // ===== ENSEMBLE METHOD WITH ANTI-REPEAT =====
    // ผสมผลลัพธ์จากทุกสูตรแทนการเลือกสูตรเดียว
    const lastR2Str = lastResult.r2.padStart(2, '0');
    const prevR2Str = prevResult.r2.padStart(2, '0');
    const isRepeatDetected = lastR2Str === prevR2Str;
    
    // นับคะแนนของแต่ละเลข (ถ่วงน้ำหนักตามความแม่นยำของสูตร)
    const numberScores: Record<string, number> = {};
    const numberVotes: Record<string, number> = {};
    
    allPredictions.forEach(pred => {
      const hybridInfo = hybridPatterns.find(h => h.pattern.name === pred.name);
      const accuracy = hybridInfo?.currentStats.directAccuracy || 0;
      const weight = Math.max(1, accuracy / 5); // น้ำหนักขั้นต่ำ 1, สูงสุด 20
      
      // ===== ANTI-REPEAT LOGIC =====
      // ถ้าตรวจพบ Repeat และเลขนี้คือเลขที่ออกซ้ำ ให้ลดคะแนนลง 90%
      let finalWeight = weight;
      if (isRepeatDetected && pred.value === lastR2Str) {
        finalWeight = weight * 0.1; // ลดคะแนนลง 90%
      }
      
      numberScores[pred.value] = (numberScores[pred.value] || 0) + finalWeight;
      numberVotes[pred.value] = (numberVotes[pred.value] || 0) + 1;
    });
    
    // เรียงตามคะแนน
    const sortedNumbers = Object.entries(numberScores)
      .sort((a, b) => b[1] - a[1]);
    
    // เลือกเลขที่ได้คะแนนสูงสุด
    let resPri = sortedNumbers[0]?.[0] || allPredictions[0].value;
    
    // ===== SECONDARY ANTI-REPEAT =====
    // ถ้าเลขที่ได้ยังคงเป็นเลขที่ออกซ้ำ และคะแนนไม่แตกต่างจากอันดับ 2 มาก
    // ให้เลือกอันดับ 2 แทน
    if (isRepeatDetected && resPri === lastR2Str && sortedNumbers.length >= 2) {
      const topScore = sortedNumbers[0][1];
      const secondScore = sortedNumbers[1][1];
      const scoreDiff = topScore - secondScore;
      
      // ถ้าคะแนนแตกต่างน้อยกว่า 50% ให้เลือกอันดับ 2
      if (scoreDiff < topScore * 0.5) {
        resPri = sortedNumbers[1][0];
      }
    }
    
    const resNum = parseInt(resPri, 10);

    const hLast = parseInt(lastR3[0], 10) || 0;
    const hPrev = parseInt(prevResult?.r3[0] || "0", 10);
    const dSum = getDigitSum(lastR4);
    const predictedH = ( (hLast * 2) + hPrev + dSum + 3 ) % 10;

    const mirrorPair = activePattern.getMirrorPair?.(resNum);
    const mirrorStr = mirrorPair?.toString().padStart(2, '0') || getMirror(resPri);

    const combinedConfidence = calculateCombinedConfidence(
      allPredictions,
      bestPatternInfo.stats,
      stats.topT,
      stats.topU
    );

    // บันทึกเลขทำนายของทุกสูตรสำหรับ Algorithm Leaderboard
    const latestResult = allData[0];
    const latestR2 = latestResult.r2.padStart(2, '0');
    const latestDrawnDate = latestResult.date;

    // ดึงเลขที่ออกใน 5 งวดล่าสุดเพื่อตรวจสอบ
    const recentDrawnNumbers = allData.slice(0, 5).map(r => r.r2.padStart(2, '0'));

    const patternPredictions = allPredictions.map(pred => {
      const hybridInfo = hybridPatterns.find(h => h.pattern.name === pred.name);
      const predictionNum = pred.value.padStart(2, '0');

      // ตรวจสอบว่าเลขที่ทำนายออกในงวดล่าสุดหรือไม่
      const isRecentlyDrawn = predictionNum === latestR2;
      const wasDrawnRecently = recentDrawnNumbers.includes(predictionNum);

      // คำนวณเลขกระจก
      const mirrorNumber = getMirror(predictionNum);

      // คำนวณ running digits
      const tens = predictionNum[0];
      const units = predictionNum[1];
      const runningDigits = [
        tens + '0', tens + '1', tens + '2', tens + '3', tens + '4',
        tens + '5', tens + '6', tens + '7', tens + '8', tens + '9',
        '0' + units, '1' + units, '2' + units, '3' + units, '4' + units,
        '5' + units, '6' + units, '7' + units, '8' + units, '9' + units
      ].filter(d => d !== predictionNum).slice(0, 10);

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
      triple: predictedH.toString() + resPri,
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
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">TiGDev Enterprise Production v3.8</p>
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
                RUNNING DIGITS
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

              {/* RUNNING DIGITS 30-DRAW STATISTICS - Simple */}
              {runningDigitsStats.history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">
                      📊 สถิติย้อนหลัง 30 งวด
                    </p>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">ถูก</p>
                        <p className="text-2xl font-black text-emerald-400">{runningDigitsStats.correct}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">ผิด</p>
                        <p className="text-2xl font-black text-red-400">{runningDigitsStats.incorrect}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">แม่น</p>
                        <p className="text-2xl font-black text-cyan-400">{runningDigitsStats.accuracy.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DAILY LOGS MODAL OVERLAY */}
            {showRunningLogs && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                  onClick={() => setShowRunningLogs(false)}
                ></div>
                
                {/* Modal Content */}
                <div className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                  {/* Header */}
                  <div className="flex-shrink-0 p-6 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-3">
                          <span className="text-3xl">📋</span>
                          RUNNING DIGITS DAILY LOGS
                        </h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                          สถิติย้อนหลัง <span className="text-cyan-400">{runningDigitsStats.history.length} งวด</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Stats Summary */}
                        <div className="flex gap-4">
                          <div className="text-center px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <p className="text-[9px] font-black text-slate-500 uppercase">ถูก</p>
                            <p className="text-lg font-black text-emerald-400">{runningDigitsStats.correct}</p>
                          </div>
                          <div className="text-center px-3 py-1 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-[9px] font-black text-slate-500 uppercase">ผิด</p>
                            <p className="text-lg font-black text-red-400">{runningDigitsStats.incorrect}</p>
                          </div>
                          <div className="text-center px-3 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                            <p className="text-[9px] font-black text-slate-500 uppercase">แม่น</p>
                            <p className="text-lg font-black text-cyan-400">{runningDigitsStats.accuracy.toFixed(1)}%</p>
                          </div>
                        </div>
                        {/* Close Button */}
                        <button
                          onClick={() => setShowRunningLogs(false)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500/50 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Table Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-900 z-10">
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">วันที่</th>
                          <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">เลขเด่นที่คำนวณได้</th>
                          <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ผลที่ออก (2 ตัว)</th>
                          <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ผลลัพธ์</th>
                          <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">สถานะ</th>
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
                            <td className="py-3 px-4">
                              <span className={`font-black ${log.status === 'PENDING' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`}>
                                {log.date}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex justify-center gap-2">
                                {log.predicted.map((d, i) => (
                                  <span
                                    key={i}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${
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
                            <td className="py-3 px-4 text-center">
                              <span className={`text-lg font-black ${log.status === 'WIN' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {log.actual}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {log.status === 'WIN' ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-emerald-400 font-black text-xs">MATCHED</span>
                                  <span className="text-[10px] text-slate-600 font-black">{log.matchedDigits} DIGITS</span>
                                </div>
                              ) : log.status === 'LOSS' ? (
                                <span className="text-red-400 font-black text-xs opacity-50">MISS</span>
                              ) : (
                                <span className="text-cyan-400 font-black text-xs animate-pulse">AWAITING...</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {log.status === 'WIN' ? (
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                                  WIN ✅
                                </span>
                              ) : log.status === 'LOSS' ? (
                                <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                                  LOSS ❌
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                  PENDING 🔄
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
            <h2 className="section-title text-indigo-400">Backyard Strategy (ชุดเสริม)</h2>
            <div className="grid grid-cols-2 gap-3">
              {stats?.backyard.map((num, i) => (
                <div key={i} className="bg-slate-950/60 p-4 rounded-2xl border border-indigo-500/10 text-center hover:border-indigo-500/30 transition-all group">
                  <div className="text-2xl font-black text-white group-hover:scale-110 transition-transform">{num}</div>
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">UNIT {i+1}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Engine */}
          <section className="glass-card bg-gradient-to-br from-slate-900/60 to-slate-900/40">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Quantum Analysis Engine</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">ชุดข้อมูลประมวลผลผ่าน Neural Network ประจำงวดปัจจุบัน</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-[10px] font-black text-emerald-400 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  LIVE ENGINE
                </span>
                <button onClick={autoCalculate} className="btn-sync !py-1.5 !px-4">
                  RE-ANALYZE
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
                    <p className="text-center text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-4">Running Digits</p>
                    <div className="flex justify-center gap-4">
                      <div className="ultra-huge-text glow-cyan group-hover:-translate-x-2 transition-transform duration-500">{manualRes.primary[0]}</div>
                      <div className="ultra-huge-text glow-cyan group-hover:translate-x-2 transition-transform duration-500">{manualRes.primary[1]}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card !p-6 text-center !border-t-2 !border-t-cyan-500 !bg-slate-900/20 hover:!bg-slate-900/40 transition-colors">
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-2">Primary</p>
                    <div className="text-3xl font-black text-white">{manualRes.primary}</div>
                  </div>
                  <div className="glass-card !p-6 text-center !border-t-2 !border-t-amber-500 !bg-slate-900/20 hover:!bg-slate-900/40 transition-colors">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Mirror</p>
                    <div className="text-3xl font-black text-white">{manualRes.mirror}</div>
                  </div>
                  <div className="glass-card !p-6 text-center !border-t-2 !border-t-indigo-500 !bg-slate-900/20 hover:!bg-slate-900/40 transition-colors">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Rhythm</p>
                    <div className="text-3xl font-black text-white">{manualRes.rhythm}</div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Leaderboard Section - HYBRID APPROACH */}
          <section className="glass-card">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Algorithm Leaderboard</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">การจัดอันดับประสิทธิภาพ AI ENGINE แบบ Hybrid</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    showExplanation
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  {showExplanation ? '📖 HIDE GUIDE' : '📖 VIEW GUIDE'}
                </button>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                    {hybridPatterns.filter(h => h.isQualified).length} Qualified
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-full border border-amber-500/30">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">
                    Hybrid Mode
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                    className={`group relative flex flex-col md:flex-row items-center justify-between p-5 rounded-[1.5rem] border transition-all duration-500 ${
                      isBest
                        ? 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40 shadow-xl shadow-emerald-500/10'
                        : isQualified
                        ? 'bg-slate-900/50 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-slate-900/70'
                        : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-6 mb-4 md:mb-0 w-full md:w-auto">
                      <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl font-black text-xl transition-transform group-hover:scale-110 ${
                        isBest ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' : 
                        isQualified ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className={`text-lg font-black tracking-tight ${isBest ? 'text-white' : isQualified ? 'text-cyan-300' : 'text-slate-300'}`}>
                            {h.pattern.name}
                          </h4>
                          <div className="flex gap-2">
                            {isBest && (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse" title="Active Master">
                                <span className="text-lg">👑</span>
                              </div>
                            )}
                            {isQualified && !isBest && (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20" title="Qualified">
                                <span className="text-sm text-emerald-400 font-black">✓</span>
                              </div>
                            )}
                            {!isQualified && (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20" title="Unstable">
                                <span className="text-sm text-red-400 font-black">✗</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* HYBRID INFO */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Stability: <span className={stability >= 70 ? 'text-emerald-400' : stability >= 50 ? 'text-amber-400' : 'text-red-400'}>{stability}%</span>
                          </span>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Max Consecutive: <span className={maxConsecutive >= 6 ? 'text-emerald-400' : 'text-red-400'}>{maxConsecutive} งวด</span>
                          </span>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            Current: <span className={currentConsecutive >= 6 ? 'text-emerald-400' : currentConsecutive >= 4 ? 'text-amber-400' : 'text-red-400'}>{currentConsecutive} งวด</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-6 border-t border-slate-800 md:border-t-0 pt-4 md:pt-0">
                      <div className="flex gap-6">
                        {/* Historical Accuracy */}
                        <div className="text-center md:text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Historical (30)</p>
                          <div className={`text-xl font-black ${isBest ? 'text-emerald-400' : isQualified ? 'text-cyan-400' : 'text-white'}`}>
                            {historicalAccuracy.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>
                        
                        {/* Current Accuracy */}
                        <div className="text-center md:text-right">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Current (10)</p>
                          <div className={`text-xl font-black ${
                            currentAccuracy >= historicalAccuracy ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {currentAccuracy.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>

                        {/* Trending Indicator */}
                        <div className="flex items-center">
                          {currentAccuracy >= historicalAccuracy + 5 ? (
                            <span className="text-2xl text-emerald-400" title="Trending Up">📈</span>
                          ) : currentAccuracy <= historicalAccuracy - 5 ? (
                            <span className="text-2xl text-red-400" title="Trending Down">📉</span>
                          ) : (
                            <span className="text-2xl text-amber-400" title="Stable">➡️</span>
                          )}
                        </div>
                      </div>

                      {/* Stability Bar */}
                      <div className="hidden lg:block w-32 ml-4">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => { setShowLeaderboard(false); setExpandedPattern(null); }}
              ></div>
              
              {/* Modal Content */}
              <div className="relative w-full max-w-7xl max-h-[90vh] bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-500/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="text-3xl">🎯</span>
                        ALGORITHM LEADERBOARD
                      </h3>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        เปรียบเทียบเลขที่แต่ละสูตรทำนาย พร้อมสถิติย้อนหลัง
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Stats Summary */}
                      <div className="flex gap-3">
                        <div className="text-center px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <p className="text-[9px] font-black text-slate-500 uppercase">Qualified</p>
                          <p className="text-lg font-black text-emerald-400">{hybridPatterns.filter(h => h.isQualified).length}</p>
                        </div>
                        <div className="text-center px-3 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <p className="text-[9px] font-black text-slate-500 uppercase">Total</p>
                          <p className="text-lg font-black text-purple-400">{allPatternPredictions.length}</p>
                        </div>
                      </div>
                      {/* Close Button */}
                      <button
                        onClick={() => { setShowLeaderboard(false); setExpandedPattern(null); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-purple-500/50 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Table Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">อันดับ</th>
                        <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">สูตร</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">เลขทำนาย</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">สถานะ</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hist (30)</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Curr (10)</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Streak</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Stability</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">รายละเอียด</th>
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
                            <td className="py-3 px-4">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                                pattern.isActiveMaster 
                                  ? 'bg-emerald-500 text-slate-950' 
                                  : pattern.isQualified
                                  ? 'bg-cyan-500/20 text-cyan-400'
                                  : 'bg-slate-800 text-slate-500'
                              }`}>
                                {idx + 1}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className={`font-black text-sm ${
                                pattern.isActiveMaster 
                                  ? 'text-emerald-400' 
                                  : pattern.isQualified
                                  ? 'text-cyan-300'
                                  : 'text-slate-400'
                              }`}>
                                {pattern.name}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`inline-flex items-center justify-center w-16 h-10 rounded-lg font-black text-lg ${
                                  pattern.isRecentlyDrawn
                                    ? 'bg-red-500/30 border-2 border-red-500/50 text-red-400'
                                    : 'bg-slate-800 text-white'
                                }`}>
                                  {pattern.prediction}
                                </div>
                                {pattern.isRecentlyDrawn && (
                                  <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter animate-pulse">
                                    ⚠️ ออกแล้ว!
                                  </span>
                                )}
                                {pattern.isRecentlyDrawn && (
                                  <div className="flex gap-1 mt-1">
                                    <span className="text-[8px] text-slate-500">ทางเลือก:</span>
                                    <span className="text-[9px] font-black text-cyan-400">{pattern.mirrorNumber}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {pattern.isActiveMaster ? (
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse">
                                  <span className="text-2xl" title="Active Master">👑</span>
                                </div>
                              ) : pattern.isQualified ? (
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                  <span className="text-xl text-emerald-400 font-black" title="Qualified">✓</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20">
                                  <span className="text-xl text-red-400 font-black" title="Unstable">✗</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm font-black ${
                                pattern.historicalAccuracy >= 10 ? 'text-emerald-400' : 
                                pattern.historicalAccuracy >= 5 ? 'text-amber-400' : 'text-slate-400'
                              }`}>
                                {pattern.historicalAccuracy.toFixed(1)}%
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm font-black ${
                                pattern.currentAccuracy >= 10 ? 'text-emerald-400' : 
                                pattern.currentAccuracy >= 5 ? 'text-amber-400' : 'text-slate-400'
                              }`}>
                                {pattern.currentAccuracy.toFixed(1)}%
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm font-black ${
                                pattern.maxConsecutive >= 6 ? 'text-emerald-400' : 
                                pattern.maxConsecutive >= 4 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {pattern.maxConsecutive} งวด
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-1000 ${
                                      pattern.stabilityScore >= 70 ? 'bg-emerald-500' :
                                      pattern.stabilityScore >= 50 ? 'bg-amber-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${pattern.stabilityScore}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-black text-slate-500">{pattern.stabilityScore}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setExpandedPattern(expandedPattern === pattern.name ? null : pattern.name)}
                                className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/20 rounded text-[9px] font-black uppercase tracking-tighter transition-colors"
                              >
                                {expandedPattern === pattern.name ? '▲ ซ่อน' : '▼ ดู'}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

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
                                  🔄 Running Digits - เลขทางเลือก (10 ตัว)
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
        TKK STUDIO ENTERPRISE • QUANTUM ENGINE v3.8 • {new Date().toLocaleDateString('th-TH')}
      </footer>
    </div>
  );
};

export default App;
