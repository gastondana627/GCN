import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, MoveLeft, MoveRight, ArrowUp, Zap, Trophy, Timer, Swords, User, ChevronRight, Smartphone, Tablet as TabletIcon, Monitor, RefreshCw } from 'lucide-react';
import { generateDinerName } from '../App';
import { characterData } from '../data/characterData';

export const useVinylCrackle = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const startAudio = () => {
      if (audioCtxRef.current) return;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const bufferSize = 2 * audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        // White noise base
        let noise = Math.random() * 2 - 1;
        
        // Crackle spikes
        if (Math.random() > 0.9995) {
          noise += (Math.random() * 2 - 1) * 5;
        }
        
        output[i] = noise * 0.015; // Very subtle
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      whiteNoise.start();
    };

    const handleInteraction = () => {
      startAudio();
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      if (audioCtxRef.current) {
        try {
          const p = audioCtxRef.current.close();
          if (p && p.catch) p.catch(() => {});
        } catch (e) {}
        audioCtxRef.current = null;
      }
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);
};

const playDing = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {}
};

import { CharacterType } from '../types';

interface UIProps {
  status: 'start' | 'gameover' | 'win';
  score: number;
  onStart: () => void;
  onMenu?: () => void;
  onLevelSelect?: () => void;
  hasBeatenGame?: boolean;
  leaderboard: { name: string; score: number }[];
  playerName?: string;
  setPlayerName?: (name: string) => void;
  timePlayed?: number;
  selectedCharacter?: CharacterType;
  onSelectCharacter?: (char: CharacterType) => void;
}

export const LandingScreen: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  useVinylCrackle();
  const [isRinging, setIsRinging] = React.useState(false);

  const handleRing = () => {
    setIsRinging(true);
    playDing();
    setTimeout(() => {
      onEnter();
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-8 bg-zinc-950 relative overflow-y-auto"
    >
      <div className="film-grain" />
      
      {/* Moody Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(230,126,34,0.03),transparent_80%)]" />
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-12 relative z-10"
      >
        <div className="space-y-4">
          <h2 className="text-zinc-600 font-mono text-[10px] md:text-xs tracking-[0.5em] md:tracking-[0.8em] uppercase bulb-flicker">
            EST. 1954 • THE SAUCE SYNDICATE
          </h2>
          <h1 className="text-2xl md:text-4xl font-serif italic text-zinc-400 opacity-50">
            "The diner is closed..."
          </h1>
        </div>

        {/* Service Bell */}
        <div className="relative group cursor-pointer scale-75 md:scale-100" onClick={handleRing}>
          <motion.div
            animate={isRinging ? { 
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            } : {}}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            {/* Bell Base */}
            <div className="w-48 h-12 bg-zinc-800 rounded-t-full border-b-4 border-zinc-900 shadow-2xl mx-auto" />
            {/* Bell Dome */}
            <div className="w-40 h-24 bg-zinc-700 rounded-t-full -mt-20 mx-auto border-t border-zinc-600 shadow-[inset_0_10px_20px_rgba(255,255,255,0.1)] relative bulb-flicker">
              {/* Bell Button */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-6 bg-zinc-600 rounded-t-md border-b-2 border-zinc-800" />
            </div>
            
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-orange-500/5 blur-3xl rounded-full group-hover:bg-orange-500/10 transition-colors" />
          </motion.div>

          <div className="mt-8 space-y-2">
            <p className="text-orange-500 font-black text-xl tracking-widest neon-flicker">
              RING FOR SERVICE
            </p>
            <p className="text-zinc-700 font-mono text-[10px] uppercase tracking-widest">
              EMPLOYEES ONLY BEYOND THIS POINT
            </p>
          </div>
        </div>

        <div className="pt-12">
          <div className="w-1 h-12 bg-zinc-800 mx-auto bulb-flicker" />
          <p className="text-zinc-800 font-mono text-[9px] mt-4 tracking-tighter">
            AUTHORIZED PERSONNEL ONLY • CASE FILE #442
          </p>
        </div>
      </motion.div>

      {/* Background Silhouettes */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent opacity-50" />
    </motion.div>
  );
};

export const StartScreen: React.FC<UIProps> = ({ onStart, onLevelSelect, hasBeatenGame, leaderboard, playerName, setPlayerName, selectedCharacter, onSelectCharacter }) => {
  useVinylCrackle();
  const [deviceType, setDeviceType] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  React.useEffect(() => {
    const checkDevice = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (!hasTouch) {
        setDeviceType('desktop');
      } else {
        // Simple breakpoint for tablet vs mobile
        setDeviceType(window.innerWidth >= 768 ? 'tablet' : 'mobile');
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-8 bg-zinc-950 relative overflow-y-auto"
    >
      {/* Film Grain Overlay */}
      <div className="film-grain" />

      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(230,126,34,0.05),transparent_70%)]" />
      
      {/* Decorative Neon Tubes */}
      <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/20 neon-flicker shadow-[0_0_15px_rgba(230,126,34,0.5)]" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500/20 neon-flicker shadow-[0_0_15px_rgba(230,126,34,0.5)]" />

      {/* Main Container with Checkered Border */}
      <div className="checkered-border p-1 w-full max-w-5xl relative z-10 shadow-2xl">
        <div className="bg-zinc-900/95 p-4 md:p-8 border-4 border-zinc-800 relative">
          {/* Chrome Trim Accent */}
          <div className="absolute -top-1 -left-1 -right-1 h-1 bg-gradient-to-r from-zinc-600 via-zinc-300 to-zinc-600" />
          <div className="absolute -bottom-1 -left-1 -right-1 h-1 bg-gradient-to-r from-zinc-600 via-zinc-300 to-zinc-600" />
          
          {/* Vintage Signage Title */}
          <div className="relative mb-8 md:mb-12 text-center">
            <div className="absolute -inset-4 bg-orange-600/10 blur-2xl rounded-full" />
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter italic text-orange-500 drop-shadow-[0_0_20px_rgba(230,126,34,0.6)] uppercase leading-none neon-flicker text-center">
              NUGGET<br/>FIGHT CLUB
            </h1>
            <div className="mt-4 flex items-center justify-center gap-4 bulb-flicker">
              <div className="h-[2px] w-8 md:w-16 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
              <p className="text-[10px] md:text-sm font-mono text-zinc-400 uppercase tracking-[0.3em] md:tracking-[0.5em]">
                WARRIOR DEMO - TRACK 1
              </p>
              <div className="h-[2px] w-8 md:w-16 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
            <div className="space-y-6 md:space-y-8">
              <div className="formica-texture diner-border p-4 md:p-8 bulb-flicker relative overflow-hidden">
                {/* Chrome Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-zinc-400/50" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-zinc-400/50" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-zinc-400/50" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-zinc-400/50" />
                
                <h2 className="text-xl md:text-2xl font-black mb-4 text-orange-400 flex items-center gap-3">
                  <Swords className="w-5 h-5" />
                  THE LAST CHANCE
                </h2>
                <p className="font-serif italic text-sm md:text-lg leading-relaxed text-zinc-300 relative mb-6 md:mb-8 pl-4 border-l-2 border-orange-500/30">
                  "The Sauce Syndicate has crossed the line. They've taken the family. 
                  It's time to show them what 'Nugget Strength' really means."
                </p>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-orange-500" />
                    <label className="block text-[10px] font-mono text-orange-500/70 uppercase tracking-widest">DEPLOYMENT OPERATIVE</label>
                  </div>
                  <button
                    onClick={() => onSelectCharacter?.(selectedCharacter || 'classic_og')}
                    className="w-full text-left p-4 border-2 border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs text-orange-500/80 font-mono mb-1">CURRENTLY SELECTED:</div>
                      <div className="text-lg font-black text-orange-400 uppercase">
                        {selectedCharacter ? characterData[selectedCharacter].name : 'THE OG'}
                      </div>
                    </div>
                    <div className="text-orange-500 text-sm font-mono uppercase tracking-widest border border-orange-500/50 px-3 py-1">
                      CHANGE {">"}
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-orange-500" />
                    <label className="block text-[10px] font-mono text-orange-500/70 uppercase tracking-widest">IDENTIFY MENU ITEM</label>
                  </div>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        value={playerName}
                        onChange={(e) => setPlayerName?.(e.target.value.toUpperCase().slice(0, 30))}
                        placeholder="E.G. CUDDLY CHICKEN NUGGET 42"
                        autoComplete="off"
                        spellCheck="false"
                        name="player-name"
                        className="w-full bg-black/60 border-2 border-zinc-800 p-3 md:p-4 font-mono text-orange-400 focus:outline-none focus:border-orange-600 transition-colors placeholder:text-zinc-800 uppercase text-sm md:text-base"
                      />
                      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                    </div>
                    <button
                      onClick={() => setPlayerName?.(generateDinerName())}
                      className="p-3 md:p-4 bg-zinc-900 border-2 border-zinc-800 hover:border-orange-500 hover:text-orange-400 text-zinc-500 transition-colors flex-shrink-0"
                      title="Generate new name"
                    >
                      <RefreshCw className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-orange-600 blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                <button
                  onClick={onStart}
                  className="w-full py-4 md:py-6 bg-orange-600 hover:bg-orange-500 text-white font-black text-xl md:text-3xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_15px_30px_rgba(0,0,0,0.5)] skew-x-[-6deg] border-b-4 border-orange-800 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className="relative flex items-center justify-center gap-3">
                    ENTER THE FRAY
                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                  </span>
                </button>
              </div>

              {hasBeatenGame && (
                <div className="relative group mt-4">
                  <div className="absolute -inset-1 bg-zinc-600 blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                  <button
                    onClick={onLevelSelect}
                    className="w-full py-3 md:py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-lg md:text-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_15px_30px_rgba(0,0,0,0.5)] skew-x-[-6deg] border-b-4 border-zinc-900 relative overflow-hidden"
                  >
                    <span className="relative flex items-center justify-center gap-3">
                      LEVEL SELECT
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="formica-texture diner-border p-4 md:p-8 bulb-flicker relative overflow-hidden">
              {/* Checkered Background Accent for Menu */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ 
                backgroundImage: 'linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)',
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px'
              }} />
              
              {/* Chrome Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-zinc-400/50" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-zinc-400/50" />
              
              {/* Menu Header */}
              <div className="text-center mb-6 md:mb-8">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  <h2 className="text-2xl md:text-3xl font-serif italic text-orange-500">Today's Specials</h2>
                </div>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <p className="text-[8px] md:text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-2">TOP MENU ITEMS ON DUTY</p>
              </div>

              <div className="space-y-4 md:space-y-6">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, i) => (
                    <div key={i} className="flex items-baseline gap-2 group">
                      <span className="text-zinc-500 font-mono text-[10px] md:text-xs">{i + 1}.</span>
                      <span className="text-zinc-300 font-serif italic text-base md:text-lg group-hover:text-white transition-colors truncate max-w-[100px] md:max-w-none">{entry.name}</span>
                      <div className="flex-grow border-b border-dotted border-zinc-800 mx-2 mb-1" />
                      <span className="text-orange-500 font-mono font-bold text-sm md:text-lg">${entry.score.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 md:py-12">
                    <p className="text-zinc-600 italic font-serif text-sm">No records found in the archives...</p>
                  </div>
                )}
              </div>

              {/* Menu Footer */}
              <div className="mt-12 pt-4 border-t border-zinc-800/50 text-center">
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">NO REFUNDS • NO SURRENDER</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adaptive Controls Section */}
      <div className="mt-8 md:mt-12 w-full max-w-5xl bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-lg space-y-4 relative z-10">
        <div className="flex items-center gap-2 text-orange-500/70">
          {deviceType === 'mobile' && <Smartphone className="w-4 h-4" />}
          {deviceType === 'tablet' && <TabletIcon className="w-4 h-4" />}
          {deviceType === 'desktop' && <Monitor className="w-4 h-4" />}
          <span className="text-[10px] font-mono uppercase tracking-widest">
            {deviceType === 'mobile' ? 'Mobile' : deviceType === 'tablet' ? 'Tablet' : 'Desktop'} Mission Controls
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {deviceType !== 'desktop' ? (
            // Touch Controls (Mobile & Tablet)
            <>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400">
                  <MoveLeft className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">{deviceType === 'tablet' ? 'LEFT THUMB' : 'LEFT SCREEN'}</div>
                  <div className="text-zinc-500 uppercase">Move Left</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400">
                  <MoveRight className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">{deviceType === 'tablet' ? 'RIGHT THUMB' : 'RIGHT SCREEN'}</div>
                  <div className="text-zinc-500 uppercase">Move Right</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400">
                  <ArrowUp className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">TOP HALF</div>
                  <div className="text-zinc-500 uppercase">Jump</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">TAP CENTER</div>
                  <div className="text-zinc-500 uppercase">Strike / Shoot</div>
                </div>
              </div>
            </>
          ) : (
            // Keyboard Controls
            <>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 font-mono text-xs">
                  WASD
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">KEYS</div>
                  <div className="text-zinc-500 uppercase">Movement</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 font-mono text-xs">
                  SPACE
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">KEY</div>
                  <div className="text-zinc-500 uppercase">Jump</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 font-mono text-xs">
                  F / J
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">KEYS</div>
                  <div className="text-zinc-500 uppercase">Strike</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded border border-zinc-800/30">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 font-mono text-xs">
                  K / L
                </div>
                <div className="text-[10px] font-mono">
                  <div className="text-zinc-300">KEYS</div>
                  <div className="text-zinc-500 uppercase">Blaster</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const GameOverScreen: React.FC<UIProps> = ({ score, onStart, onMenu }) => {
  useVinylCrackle();
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-8 bg-red-950/95 relative overflow-y-auto"
    >
      <div className="film-grain" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent_70%)]" />
      
      {/* Checkered Border Container */}
      <div className="checkered-border p-1 relative z-10 shadow-2xl w-full max-w-lg mx-4">
        <div className="bg-zinc-900/95 p-6 md:p-12 border-4 border-zinc-800 flex flex-col items-center relative overflow-hidden">
          {/* Chrome Trim Accent */}
          <div className="absolute -top-1 -left-1 -right-1 h-1 bg-gradient-to-r from-zinc-600 via-zinc-300 to-zinc-600" />
          
          <h1 className="text-6xl md:text-9xl font-black mb-2 text-red-600 italic tracking-tighter drop-shadow-2xl neon-flicker">DIPPED.</h1>
          <p className="text-sm md:text-xl mb-8 md:mb-12 font-mono tracking-[0.2em] md:tracking-[0.4em] text-red-200/40 bulb-flicker uppercase">OVERWHELMED BY THE SAUCE</p>
          
          <div className="relative mb-8 md:mb-12 w-full">
            {/* Chrome Trim Score Display */}
            <div className="chrome-trim px-8 md:px-16 py-6 md:py-8 text-center min-w-[200px] md:min-w-[300px] bulb-flicker relative overflow-hidden">
              {/* Internal Chrome Reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
              
              <div className="flex items-center justify-center gap-2 mb-2">
                <Timer className="w-3 h-3 text-zinc-500" />
                <div className="text-[8px] md:text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">FINAL SCORE ARCHIVE</div>
              </div>
              <div className="text-4xl md:text-7xl font-black text-zinc-900 drop-shadow-sm relative z-10">{score.toLocaleString()}</div>
            </div>
            {/* Decorative Screws */}
            <div className="absolute top-2 left-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner border border-zinc-600" />
            <div className="absolute top-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner border border-zinc-600" />
            <div className="absolute bottom-2 left-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner border border-zinc-600" />
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner border border-zinc-600" />
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full md:w-auto">
            <button
              onClick={onStart}
              className="px-8 md:px-12 py-4 md:py-5 bg-red-600 text-white font-black text-lg md:text-xl hover:bg-red-500 transition-all shadow-2xl skew-x-[-6deg] border-b-4 border-red-800 active:translate-y-1 active:border-b-0 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              RETRY MISSION
            </button>
            <button
              onClick={onMenu}
              className="px-8 md:px-12 py-4 md:py-5 border-2 border-zinc-700 text-zinc-400 font-black text-lg md:text-xl hover:bg-white/5 transition-all skew-x-[-6deg] active:translate-y-1"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom Quote */}
      <p className="mt-12 text-zinc-700 font-serif italic text-sm opacity-50">"The diner always wins in the end..."</p>
    </motion.div>
  );
};

export const WinScreen: React.FC<UIProps> = ({ score, onStart, onMenu, playerName, timePlayed = 0 }) => {
  useVinylCrackle();
  
  const minutes = Math.floor(timePlayed / 3600);
  const seconds = Math.floor((timePlayed % 3600) / 60);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const lorePatternSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><text x="0" y="20" font-size="20">🧆🥒🍅</text><text x="15" y="45" font-size="20">🥚🌶️👻</text><text x="0" y="70" font-size="20">🍅🧆🥒</text><text x="15" y="95" font-size="20">👻🥚🌶️</text><text x="0" y="120" font-size="20">🥒🍅🧆</text></svg>`;
  const lorePattern = `data:image/svg+xml,${encodeURIComponent(lorePatternSvg)}`;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-8 bg-zinc-950 relative overflow-y-auto"
    >
      <div className="film-grain" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(234,179,8,0.05),transparent_70%)]" />
      
      {/* Checkered Border Container */}
      <div className="checkered-border p-1 relative z-10 shadow-2xl w-full max-w-2xl mx-4">
        <div className="bg-zinc-900/95 p-6 md:p-12 border-4 border-zinc-800 flex flex-col items-center">
          
          <div className="relative mb-4">
            {/* Stroke/Shadow layer */}
            <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter absolute inset-0 text-yellow-600 blur-[2px] opacity-50">
              WINNER
            </h1>
            {/* Lore Pattern layer */}
            <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter drop-shadow-2xl relative" style={{
              backgroundImage: `url('${lorePattern}')`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '120px 120px'
            }}>
              WINNER
            </h1>
          </div>

          <p className="text-sm md:text-xl mb-8 md:mb-12 font-mono tracking-[0.2em] md:tracking-[0.4em] text-yellow-200/40 bulb-flicker uppercase text-center">THE FAMILY IS SAFE... FOR NOW</p>
          
          <div className="relative mb-8 md:mb-12 w-full">
            {/* Chrome Trim Score Display */}
            <div className="chrome-trim px-8 md:px-16 py-6 md:py-8 text-center min-w-[200px] md:min-w-[300px] bulb-flicker flex flex-col gap-4">
              <div>
                <div className="text-[10px] md:text-xs font-mono text-zinc-400 mb-1 uppercase tracking-[0.2em]">OPERATIVE</div>
                <div className="text-2xl md:text-4xl font-black text-zinc-900 drop-shadow-sm">{playerName || 'UNKNOWN'}</div>
              </div>
              <div className="w-full h-px bg-zinc-400/30 my-2" />
              <div>
                <div className="text-[10px] md:text-xs font-mono text-zinc-400 mb-1 uppercase tracking-[0.2em]">TOTAL SCORE</div>
                <div className="text-3xl md:text-5xl font-black text-zinc-900 drop-shadow-sm">{score.toLocaleString()}</div>
              </div>
              <div className="w-full h-px bg-zinc-400/30 my-2" />
              <div>
                <div className="text-[10px] md:text-xs font-mono text-zinc-400 mb-1 uppercase tracking-[0.2em]">TIME PLAYED</div>
                <div className="text-2xl md:text-4xl font-black text-zinc-900 drop-shadow-sm">{timeStr}</div>
              </div>
            </div>
            {/* Decorative Screws */}
            <div className="absolute top-2 left-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner" />
            <div className="absolute top-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner" />
            <div className="absolute bottom-2 left-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner" />
            <div className="absolute bottom-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-500 shadow-inner" />
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full md:w-auto">
            <button
              onClick={onStart}
              className="px-8 md:px-12 py-4 md:py-5 bg-yellow-500 text-black font-black text-lg md:text-xl hover:bg-yellow-400 transition-all shadow-2xl skew-x-[-6deg] border-b-4 border-yellow-800 active:translate-y-1 active:border-b-0"
            >
              PLAY AGAIN
            </button>
            {onMenu && (
              <button
                onClick={onMenu}
                className="px-8 md:px-12 py-4 md:py-5 border-2 border-yellow-500 text-yellow-500 font-black text-lg md:text-xl hover:bg-yellow-500/10 transition-all skew-x-[-6deg] active:translate-y-1"
              >
                MAIN MENU
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const LevelSelectScreen: React.FC<{ onSelectLevel: (index: number) => void, onMenu: () => void, unlockedLevels: boolean[] }> = ({ onSelectLevel, onMenu, unlockedLevels }) => {
  useVinylCrackle();

  const renderLevel = (index: number, title: string, description: string, children: React.ReactNode) => {
    const isUnlocked = unlockedLevels[index];
    return (
      <div 
        onClick={() => isUnlocked && onSelectLevel(index)}
        className={`formica-texture diner-border p-6 relative overflow-hidden ${isUnlocked ? 'cursor-pointer group hover:border-orange-500 transition-colors' : 'opacity-50 cursor-not-allowed grayscale'}`}
      >
        {isUnlocked && <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors" />}
        {!isUnlocked && (
           <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40">
             <div className="bg-red-900 text-white font-mono text-xs px-2 py-1 rounded shadow-lg border border-red-500">LOCKED</div>
           </div>
        )}
        <h2 className="text-xl font-black text-orange-400 mb-2 uppercase">{title}</h2>
        <p className="text-zinc-400 font-mono text-xs mb-6">{description}</p>
        
        <div className="flex justify-center items-center h-32 bg-black/50 rounded border border-zinc-800 relative z-10">
          {children}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-8 bg-zinc-950 relative overflow-y-auto"
    >
      <div className="film-grain" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(230,126,34,0.05),transparent_70%)]" />
      
      <div className="checkered-border p-1 w-full max-w-4xl relative z-10 shadow-2xl">
        <div className="bg-zinc-900/95 p-6 md:p-12 border-4 border-zinc-800 relative">
          <div className="absolute -top-1 -left-1 -right-1 h-1 bg-gradient-to-r from-zinc-600 via-zinc-300 to-zinc-600" />
          
          <h1 className="text-4xl md:text-6xl font-black mb-8 text-center text-orange-500 italic tracking-tighter drop-shadow-2xl neon-flicker">MISSION SELECT</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Level 1 */}
            {renderLevel(0, "LEVEL 1: HONEY MUSTARD WATERS", "Infiltrate the outer perimeter. Beware the Fry Monsters.", (
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 bg-[#e67e22] rounded-sm" />
                  <div className="absolute top-2 left-2 w-4 h-4 bg-white rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" /></div>
                  <div className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" /></div>
                  <div className="absolute bottom-3 left-3 right-3 h-2 bg-black rounded-full" />
                </div>
            ))}

            {/* Level 2 */}
            {renderLevel(1, "LEVEL 2: THE DEEP FRYER", "Descend into the heat. The Dill Slicers await.", (
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 bg-[#2ecc71] rounded-full border-4 border-[#27ae60] flex items-center justify-center">
                    <div className="w-10 h-10 bg-[#a8e6cf] rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-red-600 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
            ))}

            {/* Level 3 */}
            {renderLevel(2, "LEVEL 3: THE TOMATO SYNDICATE", "Face the wrath of the red sentinels. Tomato slices incoming.", (
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 bg-red-600 rounded-full border-4 border-red-800 flex items-center justify-center">
                    <div className="w-8 h-8 bg-red-400 rounded-full opacity-50 absolute top-2 left-2"></div>
                    <div className="w-4 h-4 bg-green-600 rounded-full absolute -top-2"></div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-white rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-black rounded-full" /></div>
                      <div className="w-2 h-2 bg-white rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-black rounded-full" /></div>
                    </div>
                  </div>
                </div>
            ))}

            {/* Level 4 */}
            {renderLevel(3, "LEVEL 4: THE EMULSION", "The Mayo Monster awaits. Prepare for a slippery battle.", (
                <div className="relative w-20 h-16">
                  <div className="absolute inset-0 bg-[#f5f5dc] rounded-full border-4 border-[#e0e0c0] flex items-center justify-center overflow-hidden">
                    <div className="absolute -bottom-2 left-2 w-4 h-6 bg-[#f5f5dc] rounded-full" />
                    <div className="absolute -bottom-3 right-4 w-5 h-8 bg-[#f5f5dc] rounded-full" />
                    <div className="flex gap-4 mt-2">
                      <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,0,0,0.8)]"><div className="w-1 h-1 bg-black rounded-full" /></div>
                      <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,0,0,0.8)]"><div className="w-1 h-1 bg-black rounded-full" /></div>
                    </div>
                  </div>
                </div>
            ))}

            {/* Level 5 */}
            {renderLevel(4, "LEVEL 5: THE HOT SAUCE BOTTLE", "The heart of the Sauce Syndicate. Extreme heat.", (
                <div className="relative w-12 h-20 bg-red-600 rounded-t-full border-4 border-red-800 flex flex-col items-center">
                  <div className="w-4 h-6 bg-green-600 absolute -top-6 rounded-t-sm border-2 border-green-800"></div>
                  <div className="w-8 h-4 bg-yellow-500 mt-4 flex items-center justify-center">
                    <div className="w-6 h-1 bg-red-600"></div>
                  </div>
                </div>
            ))}

            {/* Level 6 */}
            {renderLevel(5, "LEVEL 6: THE PHANTOM BUNS", "The invisible assassins. Use the lettuce stars to reveal them!", (
                <div className="relative w-16 h-20 flex">
                  <div className="w-6 h-full bg-[#e67e22] rounded-l-full border-y-4 border-l-4 border-[#873600]"></div>
                  <div className="w-10 h-full bg-[#d35400] rounded-r-full border-y-4 border-r-4 border-[#873600] relative overflow-hidden">
                    <div className="absolute top-2 left-2 w-1.5 h-1 bg-[#f5cba7] rounded-full transform rotate-45"></div>
                    <div className="absolute top-6 right-2 w-1.5 h-1 bg-[#f5cba7] rounded-full transform -rotate-45"></div>
                    <div className="absolute bottom-4 left-4 w-1.5 h-1 bg-[#f5cba7] rounded-full transform rotate-12"></div>
                    <div className="absolute top-6 left-2 w-4 h-4 bg-black rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                    </div>
                    <div className="absolute top-4 left-0 w-6 h-1 bg-black transform rotate-12"></div>
                    <div className="absolute bottom-6 left-2 w-6 h-4 bg-black rounded-full overflow-hidden">
                      <div className="absolute top-0 left-1 w-1 h-2 bg-white transform rotate-45"></div>
                      <div className="absolute top-0 right-1 w-1 h-2 bg-white transform -rotate-45"></div>
                    </div>
                  </div>
                </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={onMenu}
              className="px-8 py-3 border-2 border-zinc-700 text-zinc-400 font-black hover:bg-white/5 transition-all skew-x-[-6deg]"
            >
              BACK TO MENU
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
