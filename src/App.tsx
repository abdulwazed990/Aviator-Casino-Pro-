/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  History, 
  Settings, 
  HelpCircle, 
  Menu, 
  User,
  TrendingUp,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type GameState = 'WAITING' | 'IN_FLIGHT' | 'CRASHED';

interface BetState {
  amount: number;
  isPlaced: boolean;
  isCashedOut: boolean;
  payout: number;
  autoCashOut: number | null;
  isAutoBet: boolean;
  isAutoCashOut: boolean;
}

// --- Constants ---
const INITIAL_BALANCE = 3000.00;
const COUNTDOWN_DURATION = 5; // seconds
const LOCKOUT_TIME = 3; // seconds before start
const PLANE_IMAGE_URL = "https://static.vecteezy.com/system/resources/previews/050/024/396/non_2x/3d-cartoon-happy-blue-and-yellow-jet-fighter-military-machine-illustration-for-children-vector.jpg";

export default function App() {
  // --- State ---
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [multiplier, setMultiplier] = useState(1.00);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [history, setHistory] = useState<number[]>([1.24, 4.56, 1.02, 12.45, 2.33, 1.88, 5.40]);
  const [cashOutPopup, setCashOutPopup] = useState<{amount: number, mult: number} | null>(null);
  const [shake, setShake] = useState(false);

  // Betting States for two panels
  const [bet1, setBet1] = useState<BetState>({ amount: 10.00, isPlaced: false, isCashedOut: false, payout: 0, autoCashOut: 2.00, isAutoBet: false, isAutoCashOut: false });
  const [bet2, setBet2] = useState<BetState>({ amount: 10.00, isPlaced: false, isCashedOut: false, payout: 0, autoCashOut: 2.00, isAutoBet: false, isAutoCashOut: false });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{x: number, y: number, size: number, life: number, type: 'exhaust' | 'fire' | 'smoke'}[]>([]);
  const cloudsRef = useRef<{x: number, y: number, scale: number, speed: number}[]>([]);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1.00);
  const crashTimeRef = useRef<number>(0);
  const processedCrashRef = useRef<boolean>(false);
  const planeImgRef = useRef<HTMLImageElement | null>(null);
  const offsetRef = useRef<number>(0);
  const cashedOutRef1 = useRef<boolean>(false);
  const cashedOutRef2 = useRef<boolean>(false);
  const betRef1 = useRef<BetState>(bet1);
  const betRef2 = useRef<BetState>(bet2);

  // Sync refs with state
  useEffect(() => { betRef1.current = bet1; }, [bet1]);
  useEffect(() => { betRef2.current = bet2; }, [bet2]);

  // Load images once
  useEffect(() => {
    const img = new Image();
    // Removing crossOrigin as it might be causing CORS issues with pngegg
    // Since we only draw to canvas and don't read pixels, a tainted canvas is fine.
    img.src = PLANE_IMAGE_URL;
    img.onload = () => { 
      planeImgRef.current = img; 
    };
    img.onerror = () => {
      console.error("Failed to load plane image. Using realistic fallback.");
    };
  }, []);

  // --- Game Logic ---

  // Generate a random crash point (weighted towards lower numbers)
  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.05) return 1.00; // Instant crash
    // Simple exponential distribution for multiplier
    return parseFloat((1 / (1 - Math.random() * 0.99)).toFixed(2));
  };

  const startGame = () => {
    crashPointRef.current = generateCrashPoint();
    processedCrashRef.current = false;
    crashTimeRef.current = 0;
    cashedOutRef1.current = false;
    cashedOutRef2.current = false;
    setGameState('IN_FLIGHT');
    setMultiplier(1.00);
    startTimeRef.current = Date.now();
    setCountdown(0);
  };

  const resetGame = () => {
    setGameState('WAITING');
    setCountdown(COUNTDOWN_DURATION);
    setMultiplier(1.00);
    cashedOutRef1.current = false;
    cashedOutRef2.current = false;
    
    // Handle Auto Bet safely
    if (bet1.isAutoBet && balance >= bet1.amount) {
      setBalance(b => b - bet1.amount);
      setBet1(prev => ({ ...prev, isPlaced: true, isCashedOut: false, payout: 0 }));
    } else {
      setBet1(prev => ({ ...prev, isPlaced: false, isCashedOut: false, payout: 0 }));
    }

    if (bet2.isAutoBet && balance >= bet2.amount) {
      setBalance(b => b - bet2.amount);
      setBet2(prev => ({ ...prev, isPlaced: true, isCashedOut: false, payout: 0 }));
    } else {
      setBet2(prev => ({ ...prev, isPlaced: false, isCashedOut: false, payout: 0 }));
    }
  };

  // Main Game Loop
  useEffect(() => {
    let animationFrame: number;
    
    if (gameState === 'IN_FLIGHT') {
      const update = () => {
        if (gameState !== 'IN_FLIGHT') return; // Safety check

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const currentMult = Math.pow(Math.E, 0.12 * elapsed);
        
        if (currentMult >= crashPointRef.current && !processedCrashRef.current) {
          processedCrashRef.current = true;
          crashTimeRef.current = Date.now();
          setGameState('CRASHED');
          setMultiplier(crashPointRef.current);
          setHistory(prev => [parseFloat(crashPointRef.current.toFixed(2)), ...prev].slice(0, 10));
          setShake(true);
          setTimeout(() => setShake(false), 500);
          
          // Auto-reset after crash
          setTimeout(resetGame, 3000);
          return;
        }

        setMultiplier(currentMult);

        // Auto Cash Out Logic - Use refs to prevent stale closures and multiple triggers
        const b1 = betRef1.current;
        const b2 = betRef2.current;

        if (b1.isPlaced && !cashedOutRef1.current && b1.isAutoCashOut && b1.autoCashOut && currentMult >= b1.autoCashOut) {
          handleCashOut(1, currentMult);
        }
        if (b2.isPlaced && !cashedOutRef2.current && b2.isAutoCashOut && b2.autoCashOut && currentMult >= b2.autoCashOut) {
          handleCashOut(2, currentMult);
        }

        animationFrame = requestAnimationFrame(update);
      };
      animationFrame = requestAnimationFrame(update);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [gameState]); // Only depend on gameState to avoid loop restarts

  // Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'WAITING' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 0.1) {
            startGame();
            return 0;
          }
          return parseFloat((prev - 0.1).toFixed(1));
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [gameState, countdown]);

  // --- Actions ---

  const handlePlaceBet = (panel: 1 | 2) => {
    if (gameState !== 'WAITING' || countdown <= LOCKOUT_TIME) return;
    
    const bet = panel === 1 ? bet1 : bet2;
    if (balance < bet.amount) return;

    setBalance(prev => prev - bet.amount);
    if (panel === 1) setBet1(prev => ({ ...prev, isPlaced: true }));
    else setBet2(prev => ({ ...prev, isPlaced: true }));
  };

  const handleCashOut = (panel: 1 | 2, forcedMult?: number) => {
    if (gameState !== 'IN_FLIGHT') return;
    
    const currentMultiplier = forcedMult || multiplier;
    const isCashedOutRef = panel === 1 ? cashedOutRef1 : cashedOutRef2;
    const bet = panel === 1 ? betRef1.current : betRef2.current;
    const setBet = panel === 1 ? setBet1 : setBet2;

    if (isCashedOutRef.current || !bet.isPlaced || bet.isCashedOut) return;
    
    isCashedOutRef.current = true;
    const winAmount = bet.amount * currentMultiplier;

    setBalance(prev => prev + winAmount);
    setCashOutPopup({ amount: winAmount, mult: currentMultiplier });
    setBet(prev => ({ ...prev, isCashedOut: true, payout: winAmount }));

    setTimeout(() => setCashOutPopup(null), 3000);
  };

  // --- Canvas Animation ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize clouds
    if (cloudsRef.current.length === 0) {
      cloudsRef.current = Array.from({ length: 8 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.8,
        scale: 0.5 + Math.random() * 1.5,
        speed: 0.2 + Math.random() * 0.5
      }));
    }

    let animationFrame: number;
    const trail: {x: number, y: number}[] = [];

    const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.arc(15, -10, 25, 0, Math.PI * 2);
      ctx.arc(35, 0, 20, 0, Math.PI * 2);
      ctx.arc(15, 10, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      
      // Sky Gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
      skyGradient.addColorStop(0, '#0ea5e9'); // sky-500
      skyGradient.addColorStop(1, '#38bdf8'); // sky-400
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (shake) {
        ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      }

      // Draw Clouds
      cloudsRef.current.forEach(cloud => {
        drawCloud(ctx, cloud.x, cloud.y, cloud.scale);
        if (gameState === 'IN_FLIGHT') {
          cloud.x -= cloud.speed * (multiplier * 2);
          if (cloud.x < -100) {
            cloud.x = w + 100;
            cloud.y = Math.random() * h * 0.8;
          }
        }
      });

      // Moving Grid Logic
      if (gameState === 'IN_FLIGHT') {
        offsetRef.current = (offsetRef.current + (2 * multiplier)) % 50;
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      
      for (let i = -offsetRef.current; i < w + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }
      for (let i = offsetRef.current; i < h + 50; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }

      if (gameState === 'IN_FLIGHT' || gameState === 'CRASHED') {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const takeoffDuration = 3.5; // Slightly longer takeoff
        const progress = Math.min(elapsed / takeoffDuration, 1);
        const targetX = w * 0.75;
        const targetY = h * 0.4;
        
        let x = 50 + (targetX - 50) * progress;
        // More dramatic takeoff curve
        let y = (h - 50) - (h - 50 - targetY) * Math.pow(progress, 2.2);

        if (progress >= 1) {
          // Infinity-like bobbing loop
          x += Math.sin(elapsed * 1.2) * 15;
          y += Math.cos(elapsed * 1.5) * 15;
        }

        // Add to trail
        if (gameState === 'IN_FLIGHT') {
          trail.push({x, y});
          if (trail.length > 50) trail.shift();
        }

        // Draw Trail
        if (trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(225, 29, 72, 0.3)';
          ctx.lineWidth = 3;
          ctx.moveTo(trail[0].x, trail[0].y);
          for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
          }
          ctx.stroke();
        }

        const angle = progress < 1 
          ? -Math.PI / 12 - (Math.PI / 10 * Math.pow(progress, 1.5)) 
          : -Math.PI / 20 + Math.sin(elapsed) * 0.03;

        // Draw Particles (Exhaust, Fire, Smoke)
        if (gameState === 'IN_FLIGHT') {
          // Position exhaust at the back of the plane (-50, 5)
          const rad = angle;
          const exX = x - Math.cos(rad) * 50;
          const exY = y - Math.sin(rad) * 50;
          particlesRef.current.push({ x: exX, y: exY, size: 2 + Math.random() * 4, life: 1, type: 'exhaust' });
        } else if (gameState === 'CRASHED') {
          const crashElapsed = (Date.now() - crashTimeRef.current) / 1000;
          if (crashElapsed < 1.5) {
            // Massive explosion effect
            for (let i = 0; i < 15; i++) {
              particlesRef.current.push({ 
                x: x + (Math.random() - 0.5) * 60, 
                y: y + (Math.random() - 0.5) * 60, 
                size: 10 + Math.random() * 20, 
                life: 1, 
                type: Math.random() > 0.4 ? 'fire' : 'smoke' 
              });
            }
            // Add some "sparks" or debris
            for (let i = 0; i < 8; i++) {
              particlesRef.current.push({ 
                x: x, 
                y: y, 
                size: 2 + Math.random() * 4, 
                life: 1.5, 
                type: 'fire' 
              });
            }
          }
        }
        
        particlesRef.current.forEach((p, i) => {
          if (p.type === 'exhaust') {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.4})`;
          } else if (p.type === 'fire') {
            // Glow effect for fire
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(249, 115, 22, 0.8)';
            ctx.fillStyle = `rgba(249, 115, 22, ${p.life})`; // orange-500
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(71, 85, 105, ${p.life * 0.8})`; // slate-600
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // Reset shadow
          
          if (p.type === 'exhaust') {
            p.x -= 2 * multiplier;
          } else {
            p.x += (Math.random() - 0.5) * 4;
            p.y -= Math.random() * 2;
          }
          
          p.life -= 0.02;
          if (p.life <= 0) particlesRef.current.splice(i, 1);
        });

        ctx.save();
        ctx.translate(x, y);
        if (gameState === 'CRASHED') {
          const crashElapsed = (Date.now() - crashTimeRef.current) / 1000;
          // The plane disappears quickly into the explosion
          if (crashElapsed > 0.15) {
            ctx.restore();
            animationFrame = requestAnimationFrame(render);
            return;
          }
          ctx.rotate(angle);
          // Brief flash/expansion effect
          const scale = 1 + crashElapsed * 3;
          ctx.scale(scale, scale);
          ctx.globalAlpha = Math.max(0, 1 - crashElapsed * 7);
        } else {
          ctx.rotate(angle);
        }

        if (planeImgRef.current && planeImgRef.current.complete) {
          // Draw the jet image (JPEG with white background)
          ctx.save();
          
          // Flip horizontally because the original image points left
          ctx.scale(-1, 1);
          
          // Use multiply to remove white background from the JPEG
          ctx.globalCompositeOperation = 'multiply';
          
          // Adjusting size and position for the blue/yellow jet fighter
          ctx.drawImage(planeImgRef.current, -80, -60, 160, 120);
          ctx.restore();
        } else {
          // High-quality Jet Fallback (if image fails to load)
          ctx.save();
          
          // Engine Glow (Back)
          const engineGrad = ctx.createRadialGradient(-45, 0, 0, -45, 0, 20);
          engineGrad.addColorStop(0, '#ff6600');
          engineGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = engineGrad;
          ctx.beginPath();
          ctx.arc(-45, 0, 20, 0, Math.PI * 2);
          ctx.fill();

          // Jet Body (Fuselage)
          const bodyGrad = ctx.createLinearGradient(0, -15, 0, 15);
          bodyGrad.addColorStop(0, '#f43f5e'); // rose-500
          bodyGrad.addColorStop(1, '#9f1239'); // rose-900
          ctx.fillStyle = bodyGrad;
          ctx.beginPath();
          ctx.moveTo(-50, 0);
          ctx.quadraticCurveTo(-45, -15, 0, -15);
          ctx.lineTo(40, -5);
          ctx.quadraticCurveTo(55, 0, 40, 5);
          ctx.lineTo(0, 15);
          ctx.quadraticCurveTo(-45, 15, -50, 0);
          ctx.fill();
          
          // Wings (Swept back)
          ctx.fillStyle = '#e11d48'; // rose-600
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-35, -35);
          ctx.lineTo(-15, -35);
          ctx.lineTo(15, 0);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-35, 35);
          ctx.lineTo(-15, 35);
          ctx.lineTo(15, 0);
          ctx.closePath();
          ctx.fill();
          
          // Tail Fin
          ctx.fillStyle = '#be123c'; // rose-700
          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.lineTo(-55, -25);
          ctx.lineTo(-40, -25);
          ctx.lineTo(-25, 0);
          ctx.closePath();
          ctx.fill();
          
          // Cockpit (Glass)
          const glassGrad = ctx.createLinearGradient(0, -10, 0, 0);
          glassGrad.addColorStop(0, '#bae6fd'); // sky-200
          glassGrad.addColorStop(1, '#0ea5e9'); // sky-500
          ctx.fillStyle = glassGrad;
          ctx.beginPath();
          ctx.ellipse(20, -4, 15, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        }
        ctx.restore();
      }

      ctx.restore();
      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, multiplier, shake]);

  const handleDownloadHTML = async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/aviator_final.html`);
      if (!response.ok) throw new Error('File not found');
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aviator_game.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again or use the "Export to ZIP" option in the settings menu.');
    }
  };

  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-white font-sans selection:bg-rose-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black italic text-xl sm:text-2xl tracking-tighter text-rose-500 uppercase">Aviator</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-end">
            <button 
              onClick={handleDownloadHTML}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-rose-500/20 flex items-center gap-2 border border-rose-400/30"
              title="Download 100% Working Game for GitHub"
            >
              <Download className="w-5 h-5 animate-bounce" />
              <span className="font-black uppercase tracking-tighter text-sm">Download for GitHub</span>
            </button>
            <span className="text-[10px] text-rose-400 font-bold mt-1 animate-pulse">100% WORKING SOLUTION</span>
          </div>
          <div className="bg-[#000] px-3 sm:px-4 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-2 shadow-inner shadow-emerald-500/10">
            <span className="text-emerald-400 font-bold text-sm sm:text-base tracking-tight">{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row p-1 sm:p-2 gap-1 sm:gap-2 max-w-[1400px] mx-auto w-full overflow-hidden pb-4">
        
        {/* Left Side: Stats (Desktop) */}
        <div className="hidden lg:flex flex-col w-72 bg-[#1b1b1b] rounded-xl border border-white/5 overflow-hidden">
          <div className="flex border-b border-white/5">
            {['All Bets', 'My Bets'].map((tab) => (
              <button key={tab} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider ${tab === 'All Bets' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-gray-500'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {Array.from({length: 12}).map((_, i) => (
              <div key={i} className="flex items-center justify-between text-[9px] bg-black/20 p-1.5 rounded border border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center text-[7px]">U</div>
                  <span className="text-gray-400">User_{Math.floor(Math.random()*999)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-500 font-bold">1.45x</span>
                  <span className="text-emerald-400">145.00</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Game Display */}
        <div className="flex-1 flex flex-col gap-1 sm:gap-2 overflow-hidden">
          {/* History Bar */}
          <div className="bg-[#141414] p-1.5 rounded-xl border border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <History className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            {history.map((val, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${val > 2 ? 'bg-violet-500/20 text-violet-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {val.toFixed(2)}x
              </span>
            ))}
          </div>

          {/* Canvas Area */}
          <div className="relative flex-1 bg-sky-400 rounded-xl sm:rounded-2xl border border-sky-600/30 overflow-hidden min-h-0">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={500} 
              className="w-full h-full bg-sky-400"
            />
            
            {/* Multiplier Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-20 sm:pb-32">
              {gameState === 'WAITING' ? (
                <div className="text-center">
                  <div className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Next Round In</div>
                  <div className="text-4xl sm:text-6xl font-black italic text-white drop-shadow-2xl">
                    {countdown.toFixed(1)}s
                  </div>
                </div>
              ) : gameState === 'CRASHED' ? (
                <div className="text-center animate-pulse">
                  <div className="text-rose-500 text-2xl sm:text-4xl font-black italic uppercase tracking-tighter mb-1 text-shadow-[0_0_20px_rgba(225,29,72,0.5)]">FLEW AWAY</div>
                  <div className="text-5xl sm:text-7xl font-black italic text-rose-500 drop-shadow-[0_0_30px_rgba(225,29,72,0.5)]">
                    {multiplier.toFixed(2)}x
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl sm:text-8xl font-black italic text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                    {multiplier.toFixed(2)}x
                  </div>
                </div>
              )}
            </div>

            {/* Cash Out Popups */}
            <AnimatePresence>
              {cashOutPopup && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.4)] flex flex-col items-center z-50"
                >
                  <div className="text-xs font-bold uppercase tracking-widest opacity-80">You Cashed Out!</div>
                  <div className="text-2xl font-black italic">{cashOutPopup.mult.toFixed(2)}x</div>
                  <div className="text-sm font-bold mt-1">+{cashOutPopup.amount.toFixed(2)} USD</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Betting Panels */}
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-1 sm:gap-2 shrink-0 pb-1 sm:pb-0">
            <BetPanel 
              bet={bet1} 
              setBet={setBet1} 
              onPlace={() => handlePlaceBet(1)} 
              onCashOut={() => handleCashOut(1)}
              gameState={gameState}
              countdown={countdown}
              multiplier={multiplier}
              quickAmounts={[100, 300, 700, 1000]}
            />
            <BetPanel 
              bet={bet2} 
              setBet={setBet2} 
              onPlace={() => handlePlaceBet(2)} 
              onCashOut={() => handleCashOut(2)}
              gameState={gameState}
              countdown={countdown}
              multiplier={multiplier}
              quickAmounts={[500, 1500, 2000, 2500, 5000]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function BetPanel({ bet, setBet, onPlace, onCashOut, gameState, countdown, multiplier, quickAmounts }: {
  bet: BetState;
  setBet: React.Dispatch<React.SetStateAction<BetState>>;
  onPlace: () => void;
  onCashOut: () => void;
  gameState: GameState;
  countdown: number;
  multiplier: number;
  quickAmounts: number[];
}) {
  const isLockout = gameState === 'WAITING' && countdown <= LOCKOUT_TIME;
  const canBet = gameState === 'WAITING' && !bet.isPlaced && !isLockout;
  const canCashOut = gameState === 'IN_FLIGHT' && bet.isPlaced && !bet.isCashedOut;

  return (
    <div className="bg-[#1b1b1b] p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 flex flex-col gap-2 sm:gap-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Amount Control */}
        <div className={`flex-1 flex flex-col gap-1.5 sm:gap-2 transition-opacity ${bet.isPlaced ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="bg-black/40 rounded-lg sm:rounded-xl p-0.5 sm:p-1 flex items-center justify-between border border-white/5">
            <button 
              disabled={bet.isPlaced}
              onClick={() => setBet(prev => ({ ...prev, amount: Math.max(0.1, prev.amount - 1) }))}
              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-50"
            >
              <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <input 
              type="number" 
              value={bet.amount} 
              disabled={bet.isPlaced}
              onChange={(e) => setBet(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className="bg-transparent text-center font-bold text-xs sm:text-sm w-full outline-none disabled:cursor-not-allowed"
            />
            <button 
              disabled={bet.isPlaced}
              onClick={() => setBet(prev => ({ ...prev, amount: prev.amount + 1 }))}
              className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-50"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
          
          <div className={`grid ${quickAmounts.length > 4 ? 'grid-cols-5 sm:grid-cols-3' : 'grid-cols-4 sm:grid-cols-2'} gap-1`}>
            {quickAmounts.map(amt => (
              <button 
                key={amt}
                disabled={bet.isPlaced}
                onClick={() => setBet(prev => ({ ...prev, amount: amt }))}
                className="bg-black/20 hover:bg-black/40 text-[8px] sm:text-[10px] font-bold py-1 rounded sm:rounded-lg border border-white/5 transition-colors disabled:opacity-50"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex-1 min-h-[40px] sm:min-h-[60px] flex flex-col gap-1">
          {canCashOut ? (
            <button 
              onClick={onCashOut}
              className="w-full h-full bg-orange-500 hover:bg-orange-600 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shadow-[0_2px_0_rgb(194,65,12)] sm:shadow-[0_4px_0_rgb(194,65,12)] active:translate-y-0.5 sm:active:translate-y-1 active:shadow-none transition-all"
            >
              <span className="text-[8px] sm:text-xs font-black uppercase italic tracking-tighter">Cash Out</span>
              <span className="text-sm sm:text-xl font-black italic">{(bet.amount * multiplier).toFixed(2)}</span>
            </button>
          ) : bet.isPlaced && !bet.isCashedOut && gameState === 'IN_FLIGHT' ? (
            <div className="w-full h-full bg-orange-500/50 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-not-allowed">
              <span className="text-[8px] sm:text-xs font-black uppercase italic tracking-tighter opacity-50">Waiting...</span>
            </div>
          ) : bet.isPlaced && gameState === 'WAITING' ? (
            <button 
              onClick={() => setBet(prev => ({ ...prev, isPlaced: false, isAutoBet: false }))}
              className="w-full h-full bg-rose-500/20 border border-rose-500/50 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center hover:bg-rose-500/30 transition-all"
            >
              <span className="text-[8px] sm:text-xs font-black uppercase italic tracking-tighter text-rose-500">Cancel</span>
            </button>
          ) : (
            <button 
              disabled={!canBet}
              onClick={onPlace}
              className={`w-full h-full rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all shadow-[0_2px_0_rgba(0,0,0,0.2)] sm:shadow-[0_4px_0_rgba(0,0,0,0.2)] active:translate-y-0.5 sm:active:translate-y-1 active:shadow-none ${
                canBet 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-700' 
                : 'bg-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="text-sm sm:text-xl font-black italic uppercase tracking-tighter">Bet</span>
              <span className="text-[8px] sm:text-xs font-bold">{bet.amount.toFixed(2)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Auto Options */}
      <div className="flex flex-col gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
        {/* Auto Bet Row */}
        <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Auto Bet</span>
            <span className="text-[8px] text-gray-400">Place bet automatically</span>
          </div>
          <button 
            onClick={() => setBet(prev => ({ ...prev, isAutoBet: !prev.isAutoBet }))}
            className={`w-10 h-5 rounded-full relative transition-all ${bet.isAutoBet ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${bet.isAutoBet ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* Auto Cash Out Section */}
        <div className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Auto Cash Out</span>
              <span className="text-[8px] text-gray-400">Cash out at multiplier</span>
            </div>
            <button 
              onClick={() => setBet(prev => ({ ...prev, isAutoCashOut: !prev.isAutoCashOut }))}
              className={`w-10 h-5 rounded-full relative transition-all ${bet.isAutoCashOut ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${bet.isAutoCashOut ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className={`flex flex-col gap-2 transition-all ${!bet.isAutoCashOut ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
            <div className="flex items-center bg-black/60 rounded-xl p-1 border border-white/10">
              <button 
                onClick={() => setBet(prev => ({ ...prev, autoCashOut: Math.max(1.01, parseFloat(((prev.autoCashOut || 2.00) - 0.1).toFixed(2))) }))}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-transform"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 flex items-center justify-center gap-1">
                <input 
                  type="number" 
                  step="0.01"
                  value={bet.autoCashOut || ''} 
                  placeholder="2.00"
                  onChange={(e) => setBet(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || null }))}
                  className="bg-transparent text-center font-black text-lg w-full outline-none text-emerald-400"
                />
                <span className="text-xs font-black text-emerald-500 italic">x</span>
              </div>
              <button 
                onClick={() => setBet(prev => ({ ...prev, autoCashOut: parseFloat(((prev.autoCashOut || 2.00) + 0.1).toFixed(2)) }))}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-transform"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Multipliers */}
            <div className="grid grid-cols-4 gap-1">
              {[1.5, 2.0, 5.0, 10.0].map(m => (
                <button 
                  key={m}
                  onClick={() => setBet(prev => ({ ...prev, autoCashOut: m }))}
                  className={`py-1.5 rounded-lg text-[10px] font-black transition-all border ${bet.autoCashOut === m ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/40 border-white/5 text-gray-400 hover:bg-black/60'}`}
                >
                  {m.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
