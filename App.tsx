
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
  PATTERNS
  } from './services/lottoService';
  import { LottoResult, PredictionResult, BacktestResult, Pattern } from './types';

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
      lastResult.r4
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
      const best = findBestPattern(data, 20);
      setBestPatternInfo(best);

      const allStats = PATTERNS.map(p => ({
        name: p.name,
        stats: backtestPattern(data, p, 20)
      })).sort((a, b) => b.stats.directAccuracy - a.stats.directAccuracy || b.stats.runningAccuracy - a.stats.runningAccuracy);
      setAllPatternStats(allStats);
    }

    setLoading(false);
  };

  const autoCalculate = () => {
    if (allData.length < 2 || !bestPatternInfo || !stats) return;

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
      value: p.calc(prevR2, lastR2, lastR4).toString().padStart(2, '0')
    }));

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

          {/* Leaderboard Section */}
          <section className="glass-card">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Algorithm Leaderboard</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">การจัดอันดับประสิทธิภาพ AI ENGINE รายงวด</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/60 rounded-full border border-slate-800">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">20 Rounds Live Test</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {allPatternStats.map((p, idx) => {
                const isBest = idx === 0;
                const accuracy = p.stats.directAccuracy;
                const running = p.stats.runningAccuracy;
                const combined = accuracy + (p.stats.runningHits / p.stats.totalRounds * 100);
                
                return (
                  <div 
                    key={p.name} 
                    className={`group relative flex flex-col md:flex-row items-center justify-between p-5 rounded-[1.5rem] border transition-all duration-500 ${
                      isBest 
                        ? 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40 shadow-xl shadow-emerald-500/10' 
                        : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-6 mb-4 md:mb-0 w-full md:w-auto">
                      <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl font-black text-xl transition-transform group-hover:scale-110 ${
                        isBest ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {idx + 1}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className={`text-lg font-black tracking-tight ${isBest ? 'text-white' : 'text-slate-300'}`}>
                            {p.name}
                          </h4>
                          {isBest && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-tighter">
                              Active Master
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Neural Stream</span>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ID: AX-{accuracy.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-8 border-t border-slate-800 md:border-t-0 pt-4 md:pt-0">
                      <div className="flex gap-8">
                        <div className="text-center md:text-right">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Direct</p>
                          <div className={`text-2xl font-black ${isBest ? 'text-emerald-400' : 'text-white'}`}>
                            {accuracy.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>
                        
                        <div className="text-center md:text-right">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Running</p>
                          <div className="text-2xl font-black text-slate-400">
                            {running.toFixed(1)}<span className="text-xs ml-0.5 opacity-50">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden lg:block w-32 ml-4">
                        <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase mb-2">
                          <span>Confidence</span>
                          <span>{combined.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ease-out ${isBest ? 'bg-emerald-500' : 'bg-slate-600'}`} 
                            style={{ width: `${combined}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
        </aside>
      </div>

      <footer className="text-center py-12 mt-12 border-t border-slate-900 text-[10px] font-black text-slate-600 tracking-[0.4em] uppercase">
        TKK STUDIO ENTERPRISE • QUANTUM ENGINE v3.8 • {new Date().toLocaleDateString('th-TH')}
      </footer>
    </div>
  );
};

export default App;
