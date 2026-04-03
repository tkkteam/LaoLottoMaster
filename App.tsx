
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
  filterPatternsByConsecutive,
  analyzeHybridPatterns,
  analyzeRepeatProbability,
  PATTERNS
  } from './services/lottoService';
  import { LottoResult, PredictionResult, BacktestResult, Pattern, HybridPatternInfo, RepeatAnalysis } from './types';

  const COLORS = ['#22d3ee', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

  const App: React.FC = () => {
  const [allData, setAllData] = useState<LottoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeLimit, setModeLimit] = useState(40);
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualRes, setManualRes] = useState<PredictionResult | null>(null);
  const [bestPatternInfo, setBestPatternInfo] = useState<{ pattern: Pattern, stats: BacktestResult } | null>(null);
  const [allPatternStats, setAllPatternStats] = useState<Array<{ name: string, stats: BacktestResult }>>([]);
  const [hybridPatterns, setHybridPatterns] = useState<Array<HybridPatternInfo>>([]);
  const [repeatAnalysis, setRepeatAnalysis] = useState<RepeatAnalysis | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    if (allData.length === 0) return null;
    const range = allData.slice(0, modeLimit);
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

    const masterNums = Array.from(new Set([...topT, ...topU]));
    let master: string[] = [];
    if (masterNums.length >= 2) {
      for (const i of masterNums) {
        for (const j of masterNums) { if (i !== j) master.push(i + j); }
      }
    }

    const lastResult = allData[0];
    const activePattern = bestPatternInfo?.pattern || PATTERNS[0];
    const aiMasterNum = activePattern.calc(
      allData.length >= 2 ? parseInt(allData[1].r2, 10) : 0,
      parseInt(lastResult.r2, 10),
      lastResult.r4,
      allData // Pass all historical data for advanced patterns
    ).toString().padStart(2, '0');

    return {
      topT, topU, chartData,
      parityData: [{ name: 'คู่', value: even }, { name: 'คี่', value: odd }],
      backyard: calculateBackyard(lastResult.r3, lastResult.r4),
      master: master.slice(0, 8),
      aiMaster: aiMasterNum
    };
  }, [allData, modeLimit, bestPatternInfo]);

  useEffect(() => {
    if (allData.length >= 2 && stats) {
      autoCalculate();
    }
  }, [allData, bestPatternInfo, stats]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchLottoData();
    setAllData(data);

    if (data.length > 0) {
      // HYBRID ANALYSIS - ต้องทำก่อน เพื่อเลือก Active Master ที่ถูกต้อง
      const hybrid = analyzeHybridPatterns(data, undefined, 6); // ครั้งแรกไม่มี currentMaster
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

      // Basic pattern stats สำหรับ Leaderboard
      const allStats = PATTERNS.map(p => ({
        name: p.name,
        stats: backtestPattern(data, p, 20)
      })).sort((a, b) => b.stats.directAccuracy - a.stats.directAccuracy || b.stats.runningAccuracy - a.stats.runningAccuracy);
      setAllPatternStats(allStats);

      // REPEAT ANALYSIS - วิเคราะห์โอกาสออกซ้ำของเลขล่าสุด
      const lastR2 = data[0].r2.padStart(2, '0');
      const repeat = analyzeRepeatProbability(data, lastR2, 100);
      setRepeatAnalysis(repeat);
    }

    setLoading(false);
  };

  const autoCalculate = () => {
    console.log('\n🔄 RE-ANALYZE Button Clicked!');
    console.log('   allData.length:', allData?.length);
    console.log('   bestPatternInfo:', bestPatternInfo);
    console.log('   stats:', stats);
    
    if (allData.length < 2 || !bestPatternInfo || !stats) {
      console.log('   ❌ Cannot calculate: Missing required data');
      console.log('   - allData.length < 2:', allData.length < 2);
      console.log('   - !bestPatternInfo:', !bestPatternInfo);
      console.log('   - !stats:', !stats);
      return;
    }

    console.log('   ✅ Starting calculation...');

    const lastResult = allData[0];
    const prevResult = allData[1];

    const prevR2 = parseInt(prevResult.r2, 10);
    const lastR2 = parseInt(lastResult.r2, 10);
    const lastR3 = lastResult.r3;
    const lastR4 = lastResult.r4;

    console.log('   lastResult:', lastResult);
    console.log('   prevResult:', prevResult);

    const activePattern = bestPatternInfo.pattern;
    console.log('   activePattern:', activePattern.name);

    // Predictions from ALL patterns for convergence check
    const allPredictions = PATTERNS.map(p => ({
      name: p.name,
      value: p.calc(prevR2, lastR2, lastR4, allData).toString().padStart(2, '0')
    }));

    console.log('   allPredictions:', allPredictions);

    const resPri = allPredictions.find(p => p.name === activePattern.name)?.value || allPredictions[0].value;
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

    console.log('   ✅ Setting manualRes:', {
      primary: resPri,
      mirror: mirrorStr,
      rhythm: ((parseInt(resPri[0]) + 5) % 10).toString() + ((parseInt(resPri[1]) + 3) % 10).toString(),
      triple: predictedH.toString() + resPri,
      confidence: combinedConfidence,
      formulaName: activePattern.name
    });

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
          <div className="bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 tracking-wider">ANALYSIS DEPTH</span>
            <input 
              type="number" 
              value={modeLimit} 
              onChange={e => setModeLimit(parseInt(e.target.value))} 
              className="w-12 bg-transparent border-none text-cyan-400 font-black text-center outline-none" 
            />
          </div>
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

            <div className="glass-card !border-t-4 !border-t-cyan-500">
              <p className="section-title text-cyan-500">
                 <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                 MASTER SELECTION (ชุดเด่น)
              </p>
              <div className="grid grid-cols-4 gap-3 mt-4">
                {stats?.master.map((n, i) => (
                  <div key={i} className="aspect-square flex items-center justify-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xl font-black text-white hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all cursor-default group">
                    <span className="group-hover:scale-110 transition-transform">{n}</span>
                  </div>
                ))}
              </div>
            </div>
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
                    {repeatAnalysis.repeatPercentage.toFixed(1)}%
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
                  <span>{repeatAnalysis.repeatPercentage.toFixed(1)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      repeatAnalysis.repeatPercentage > 20 ? 'bg-red-500' :
                      repeatAnalysis.repeatPercentage > 10 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(repeatAnalysis.repeatPercentage * 2, 100)}%` }}
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
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-tighter animate-pulse">
                                👑 Active Master
                              </span>
                            )}
                            {isQualified && !isBest && (
                              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded text-[9px] font-black uppercase tracking-tighter">
                                ✓ Stable
                              </span>
                            )}
                            {!isQualified && (
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-black uppercase tracking-tighter">
                                ✗ Unstable
                              </span>
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
            
            {/* HYBRID EXPLANATION */}
            <div className="mt-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px]">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-black">🟢</span>
                  <div>
                    <p className="font-black text-slate-400 uppercase">Active Master</p>
                    <p className="text-slate-600">เปลี่ยนเฉพาะเมื่อล้มเหลว หรือมีสูตรที่ดีกว่า 10%+</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-black">🔵</span>
                  <div>
                    <p className="font-black text-slate-400 uppercase">Stable</p>
                    <p className="text-slate-600">Max Consecutive ≥ 6 งวด มีความน่าเชื่อถือ</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-black">🔴</span>
                  <div>
                    <p className="font-black text-slate-400 uppercase">Unstable</p>
                    <p className="text-slate-600">Max Consecutive {'<'} 6 งวด ควรหลีกเลี่ยง</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

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
