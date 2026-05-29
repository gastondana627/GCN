import React, { useEffect, useRef, useState } from 'react';
import { MoveLeft, MoveRight, ArrowUp, Zap, Swords } from 'lucide-react';
import { Player, Enemy, Level, GameState, Platform, Spotlight, Collectible, Distraction, PowerUp, CharacterType, Particle } from '../types';
import { GRAVITY, JUMP_FORCE, MOVE_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT, COLORS, ATTACK_RANGE, ATTACK_COOLDOWN, PROJECTILE_SPEED, PROJECTILE_RADIUS, PROJECTILE_COOLDOWN } from '../constants';
import { applyPhysicsToPlayer } from '../physicsConfig';
import { characterData } from '../data/characterData';

interface GameProps {
  onGameOver: (score: number) => void;
  onWin: (score: number, timeElapsed: number) => void;
  onLevelComplete: (levelIndex: number) => void;
  onMenu: () => void;
  startingLevelIndex?: number;
  selectedCharacter?: CharacterType;
}

const Game: React.FC<GameProps> = ({ onGameOver, onWin, onLevelComplete, onMenu, startingLevelIndex = 0, selectedCharacter = 'classic_og' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const keys = useRef<{ [key: string]: boolean }>({});
  const bgmRef = useRef<{ ctx: AudioContext, osc: OscillatorNode, gain: GainNode, lfo: OscillatorNode } | null>(null);
  const previousLevelIndexRef = useRef<number>(startingLevelIndex);

  useEffect(() => {
    if (gameState && gameState.currentLevelIndex !== previousLevelIndexRef.current && gameState.currentLevelIndex > previousLevelIndexRef.current) {
      onLevelComplete(previousLevelIndexRef.current);
      previousLevelIndexRef.current = gameState.currentLevelIndex;
    }
  }, [gameState?.currentLevelIndex, onLevelComplete]);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const playerImageRef = useRef<HTMLImageElement | null>(null);
  const [playerImageLoaded, setPlayerImageLoaded] = useState(false);

  useEffect(() => {
    setPlayerImageLoaded(false);
    playerImageRef.current = null;

    const img = new window.Image();
    const activeChar = selectedCharacter || 'classic_og';
    const config = characterData[activeChar];
    if (config) {
      img.src = config.imageSrc;
      img.onload = () => {
        playerImageRef.current = img;
        setPlayerImageLoaded(true);
      };
      img.onerror = () => {
        console.warn('Failed to load character sprite: ', config.imageSrc);
        playerImageRef.current = null;
        setPlayerImageLoaded(false);
      };
    }
  }, [selectedCharacter]);

  const handlePointerDown = (code: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    keys.current[code] = true;
  };

  const handlePointerUp = (code: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    keys.current[code] = false;
  };

  const sharedAudioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!sharedAudioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtxRef.current = new AudioContextClass();
      }
    }
    // Resume context if it was suspended (browser policy)
    if (sharedAudioCtxRef.current && sharedAudioCtxRef.current.state === 'suspended') {
      try {
        const p = sharedAudioCtxRef.current.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
    return sharedAudioCtxRef.current;
  };

  useEffect(() => {
    if (gameState?.status === 'playing' && !gameState?.isPaused && !bgmRef.current) {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, ctx.currentTime); // A2
        
        // Simple LFO for rhythm
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(4, ctx.currentTime); // 4Hz
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        lfo.start();
        
        bgmRef.current = { ctx, osc, gain, lfo };
      } catch (e) {}
    } else if ((gameState?.status !== 'playing' || gameState?.isPaused) && bgmRef.current) {
      try {
        bgmRef.current.osc.stop();
        bgmRef.current.lfo.stop();
        // We do NOT close the shared context here anymore
      } catch (e) {}
      bgmRef.current = null;
    }

    return () => {
      if (bgmRef.current) {
        try {
          bgmRef.current.osc.stop();
          bgmRef.current.lfo.stop();
        } catch (e) {}
        bgmRef.current = null;
      }
    };
  }, [gameState?.status, gameState?.isPaused]);

  const playClang = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
      
      // Secondary high-pitched ring
      const ring = audioCtx.createOscillator();
      const ringGain = audioCtx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(1200, audioCtx.currentTime);
      ringGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      ringGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      ring.connect(ringGain);
      ringGain.connect(audioCtx.destination);
      ring.start();
      ring.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  const playCollect = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      
      // Slight pitch variation for "uniqueness"
      const pitchShift = 0.9 + Math.random() * 0.2;

      // Bright chime arpeggio
      const playTone = (freq: number, time: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * pitchShift, audioCtx.currentTime + time);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + time);
        osc.stop(audioCtx.currentTime + time + duration);
      };

      playTone(880, 0, 0.2); // A5
      playTone(1108.73, 0.05, 0.2); // C#6
      playTone(1318.51, 0.1, 0.3); // E6
    } catch (e) {}
  };

  const playLevelComplete = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      
      const playTone = (freq: number, time: number, duration: number, type: OscillatorType = 'sine') => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + time);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + time);
        osc.stop(audioCtx.currentTime + time + duration);
      };

      // Triumphant arpeggio
      playTone(440, 0, 0.2, 'square'); // A4
      playTone(554.37, 0.15, 0.2, 'square'); // C#5
      playTone(659.25, 0.3, 0.2, 'square'); // E5
      playTone(880, 0.45, 0.6, 'square'); // A5
    } catch (e) {}
  };

  const playJump = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  };

  const playAttack = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const playShoot = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const playDeath = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  };

  // Initialize Level 1: Honey Mustard Waters
  const initLevel1 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 6000, height: 50, type: 'normal' }, // Ground
        { x: 300, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 600, y: 300, width: 200, height: 20, type: 'normal' },
        { x: 900, y: 450, width: 300, height: 20, type: 'normal' },
        { x: 1300, y: 350, width: 200, height: 20, type: 'normal' },
        { x: 1600, y: 400, width: 400, height: 20, type: 'normal' },
        { x: 2100, y: 300, width: 300, height: 20, type: 'normal' },
        { x: 2500, y: 450, width: 400, height: 20, type: 'normal' },
        { x: 3100, y: 350, width: 300, height: 20, type: 'normal' },
        { x: 3500, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 3900, y: 400, width: 400, height: 20, type: 'normal' },
        { x: 4400, y: 300, width: 300, height: 20, type: 'normal' },
        { x: 4800, y: 450, width: 400, height: 20, type: 'normal' },
        { x: 5300, y: 350, width: 300, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 400, y: 530, width: 200, height: 20, type: 'mustard-water' },
        { x: 1000, y: 530, width: 300, height: 20, type: 'mustard-water' },
        { x: 1800, y: 530, width: 400, height: 20, type: 'mustard-water' },
        { x: 2400, y: 530, width: 500, height: 20, type: 'mustard-water' },
        { x: 3200, y: 530, width: 400, height: 20, type: 'mustard-water' },
        { x: 4000, y: 530, width: 600, height: 20, type: 'mustard-water' },
        { x: 5000, y: 530, width: 500, height: 20, type: 'mustard-water' },
      ],
      spotlights: [
        { x: 500, y: 300, radius: 100, speed: 0.02, range: 200, currentOffset: 0 },
        { x: 1100, y: 300, radius: 120, speed: 0.015, range: 300, currentOffset: 0 },
        { x: 1700, y: 300, radius: 150, speed: 0.01, range: 400, currentOffset: 0 },
        { x: 2300, y: 300, radius: 130, speed: 0.012, range: 350, currentOffset: 0 },
        { x: 3000, y: 300, radius: 140, speed: 0.018, range: 400, currentOffset: 0 },
        { x: 3800, y: 300, radius: 160, speed: 0.01, range: 500, currentOffset: 0 },
        { x: 4600, y: 300, radius: 120, speed: 0.014, range: 300, currentOffset: 0 },
        { x: 5400, y: 300, radius: 150, speed: 0.011, range: 450, currentOffset: 0 },
      ],
      nuggets: [
        { x: 350, y: 350, width: 20, height: 20, name: 'Nuggie', collected: false },
        { x: 650, y: 250, width: 20, height: 20, name: 'Pip', collected: false },
        { x: 950, y: 400, width: 20, height: 20, name: 'Tot', collected: false },
        { x: 1350, y: 300, width: 20, height: 20, name: 'Crumb', collected: false },
        { x: 1800, y: 350, width: 20, height: 20, name: 'Panko', collected: false },
        { x: 2200, y: 250, width: 20, height: 20, name: 'Bit', collected: false },
        { x: 2700, y: 400, width: 20, height: 20, name: 'Nano', collected: false },
        { x: 3200, y: 300, width: 20, height: 20, name: 'Sprout', collected: false },
        { x: 3600, y: 200, width: 20, height: 20, name: 'Morsel', collected: false },
        { x: 4000, y: 350, width: 20, height: 20, name: 'Chunk', collected: false },
        { x: 4500, y: 250, width: 20, height: 20, name: 'Speck', collected: false },
        { x: 4900, y: 400, width: 20, height: 20, name: 'Nibble', collected: false },
        { x: 5400, y: 300, width: 20, height: 20, name: 'Crisp', collected: false },
      ],
      powerUps: [
        { x: 700, y: 260, width: 24, height: 24, type: 'speed', collected: false, bobOffset: 0 },
        { x: 1500, y: 310, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 4 },
        { x: 2600, y: 410, width: 24, height: 24, type: 'attack', collected: false, bobOffset: Math.PI },
        { x: 4000, y: 360, width: 24, height: 24, type: 'grease-immunity', collected: false, bobOffset: Math.PI / 2 },
        { x: 4800, y: 410, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 3 },
      ],
      goal: { x: 5850, y: 450, width: 80, height: 100 },
    };
  };

  const initEnemies1 = (): Enemy[] => [
    { x: 400, y: 510, width: 40, height: 40, vx: 2, vy: 0, type: 'fry-monster', patrolRange: 200, startPoint: 400, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1200, y: 510, width: 40, height: 40, vx: 2, vy: 0, type: 'fry-monster', patrolRange: 300, startPoint: 1200, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 800, y: 260, width: 40, height: 40, vx: 1.5, vy: 0, type: 'fry-monster', patrolRange: 100, startPoint: 800, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 2000, y: 510, width: 40, height: 40, vx: 2.5, vy: 0, type: 'fry-monster', patrolRange: 400, startPoint: 2000, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 2800, y: 510, width: 40, height: 40, vx: 2, vy: 0, type: 'fry-monster', patrolRange: 300, startPoint: 2800, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 3500, y: 510, width: 40, height: 40, vx: 3, vy: 0, type: 'fry-monster', patrolRange: 500, startPoint: 3500, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 4200, y: 510, width: 40, height: 40, vx: 2, vy: 0, type: 'fry-monster', patrolRange: 300, startPoint: 4200, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 5000, y: 510, width: 40, height: 40, vx: 2.5, vy: 0, type: 'fry-monster', patrolRange: 400, startPoint: 5000, direction: 1, health: 3, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
  ];

  // Initialize Level 2: The Deep Fryer
  const initLevel2 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 6000, height: 50, type: 'normal' }, // Ground
        { x: 400, y: 400, width: 150, height: 20, type: 'normal' },
        { x: 700, y: 250, width: 150, height: 20, type: 'normal' },
        { x: 1100, y: 350, width: 200, height: 20, type: 'normal' },
        { x: 1500, y: 200, width: 150, height: 20, type: 'normal' },
        { x: 1900, y: 450, width: 300, height: 20, type: 'normal' },
        { x: 2400, y: 300, width: 200, height: 20, type: 'normal' },
        { x: 2800, y: 150, width: 150, height: 20, type: 'normal' },
        { x: 3300, y: 400, width: 250, height: 20, type: 'normal' },
        { x: 3800, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 4300, y: 450, width: 300, height: 20, type: 'normal' },
        { x: 4800, y: 300, width: 200, height: 20, type: 'normal' },
        { x: 5300, y: 150, width: 150, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 300, y: 530, width: 300, height: 20, type: 'mustard-water' },
        { x: 900, y: 530, width: 400, height: 20, type: 'mustard-water' },
        { x: 1600, y: 530, width: 500, height: 20, type: 'mustard-water' },
        { x: 2300, y: 530, width: 600, height: 20, type: 'mustard-water' },
        { x: 3100, y: 530, width: 500, height: 20, type: 'mustard-water' },
        { x: 3900, y: 530, width: 700, height: 20, type: 'mustard-water' },
        { x: 4900, y: 530, width: 600, height: 20, type: 'mustard-water' },
      ],
      spotlights: [
        { x: 600, y: 200, radius: 120, speed: 0.025, range: 250, currentOffset: 0 },
        { x: 1300, y: 200, radius: 140, speed: 0.02, range: 350, currentOffset: 0 },
        { x: 2100, y: 200, radius: 160, speed: 0.015, range: 450, currentOffset: 0 },
        { x: 2900, y: 200, radius: 130, speed: 0.022, range: 300, currentOffset: 0 },
        { x: 3700, y: 200, radius: 150, speed: 0.018, range: 400, currentOffset: 0 },
        { x: 4500, y: 200, radius: 170, speed: 0.012, range: 550, currentOffset: 0 },
        { x: 5300, y: 200, radius: 140, speed: 0.02, range: 350, currentOffset: 0 },
      ],
      nuggets: [
        { x: 450, y: 350, width: 20, height: 20, name: 'Fryer', collected: false },
        { x: 750, y: 200, width: 20, height: 20, name: 'Sizzle', collected: false },
        { x: 1200, y: 300, width: 20, height: 20, name: 'Batter', collected: false },
        { x: 1550, y: 150, width: 20, height: 20, name: 'Crunch', collected: false },
        { x: 2050, y: 400, width: 20, height: 20, name: 'Dip', collected: false },
        { x: 2500, y: 250, width: 20, height: 20, name: 'Sauce', collected: false },
        { x: 2850, y: 100, width: 20, height: 20, name: 'Spice', collected: false },
        { x: 3400, y: 350, width: 20, height: 20, name: 'Salt', collected: false },
        { x: 3900, y: 200, width: 20, height: 20, name: 'Pepper', collected: false },
        { x: 4450, y: 400, width: 20, height: 20, name: 'Zest', collected: false },
        { x: 4900, y: 250, width: 20, height: 20, name: 'Tang', collected: false },
        { x: 5350, y: 100, width: 20, height: 20, name: 'Glaze', collected: false },
      ],
      powerUps: [
        { x: 800, y: 210, width: 24, height: 24, type: 'grease-immunity', collected: false, bobOffset: 0 },
        { x: 1800, y: 410, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 4 },
        { x: 2600, y: 260, width: 24, height: 24, type: 'speed', collected: false, bobOffset: Math.PI },
        { x: 4200, y: 410, width: 24, height: 24, type: 'attack', collected: false, bobOffset: Math.PI / 2 },
        { x: 5000, y: 210, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 3 },
      ],
      goal: { x: 5850, y: 450, width: 80, height: 100 },
    };
  };

  const initEnemies2 = (): Enemy[] => [
    { x: 500, y: 200, width: 30, height: 10, vx: 3, vy: 0, type: 'flying-fry', patrolRange: 300, startPoint: 500, startY: 200, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1000, y: 480, width: 30, height: 30, vx: 2, vy: 0, type: 'dill-slicer', patrolRange: 250, startPoint: 1000, direction: 1, health: 4, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, rotation: 0, state: 'patrol', chargeCooldown: 0 },
    { x: 1400, y: 150, width: 30, height: 10, vx: 4, vy: 0, type: 'flying-fry', patrolRange: 400, startPoint: 1400, startY: 150, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1800, y: 480, width: 30, height: 30, vx: 2.5, vy: 0, type: 'dill-slicer', patrolRange: 300, startPoint: 1800, direction: 1, health: 4, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, rotation: 0, state: 'patrol', chargeCooldown: 0 },
    { x: 2200, y: 250, width: 30, height: 10, vx: 3.5, vy: 0, type: 'flying-fry', patrolRange: 350, startPoint: 2200, startY: 250, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 2600, y: 480, width: 30, height: 30, vx: 3, vy: 0, type: 'dill-slicer', patrolRange: 400, startPoint: 2600, direction: 1, health: 4, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, rotation: 0, state: 'patrol', chargeCooldown: 0 },
    { x: 3000, y: 100, width: 30, height: 10, vx: 5, vy: 0, type: 'flying-fry', patrolRange: 500, startPoint: 3000, startY: 100, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 3500, y: 480, width: 30, height: 30, vx: 2, vy: 0, type: 'dill-slicer', patrolRange: 200, startPoint: 3500, direction: 1, health: 4, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, rotation: 0, state: 'patrol', chargeCooldown: 0 },
    { x: 4000, y: 300, width: 30, height: 10, vx: 4, vy: 0, type: 'flying-fry', patrolRange: 450, startPoint: 4000, startY: 300, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 4600, y: 480, width: 30, height: 30, vx: 3.5, vy: 0, type: 'dill-slicer', patrolRange: 500, startPoint: 4600, direction: 1, health: 4, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, rotation: 0, state: 'patrol', chargeCooldown: 0 },
    { x: 5100, y: 150, width: 30, height: 10, vx: 4.5, vy: 0, type: 'flying-fry', patrolRange: 400, startPoint: 5100, startY: 150, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
  ];

  const initLevel3 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 6000, height: 50, type: 'normal' }, // Ground
        { x: 500, y: 450, width: 200, height: 20, type: 'normal' },
        { x: 900, y: 350, width: 200, height: 20, type: 'normal' },
        { x: 1300, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 1800, y: 400, width: 300, height: 20, type: 'normal' },
        { x: 2300, y: 300, width: 250, height: 20, type: 'normal' },
        { x: 2800, y: 200, width: 200, height: 20, type: 'normal' },
        { x: 3300, y: 450, width: 300, height: 20, type: 'normal' },
        { x: 3800, y: 350, width: 250, height: 20, type: 'normal' },
        { x: 4300, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 4800, y: 400, width: 300, height: 20, type: 'normal' },
        { x: 5300, y: 300, width: 250, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 400, y: 530, width: 400, height: 20, type: 'mustard-water' },
        { x: 1100, y: 530, width: 500, height: 20, type: 'mustard-water' },
        { x: 1900, y: 530, width: 600, height: 20, type: 'mustard-water' },
        { x: 2800, y: 530, width: 500, height: 20, type: 'mustard-water' },
        { x: 3600, y: 530, width: 700, height: 20, type: 'mustard-water' },
        { x: 4600, y: 530, width: 600, height: 20, type: 'mustard-water' },
      ],
      spotlights: [
        { x: 700, y: 200, radius: 130, speed: 0.03, range: 300, currentOffset: 0 },
        { x: 1500, y: 200, radius: 150, speed: 0.025, range: 400, currentOffset: 0 },
        { x: 2500, y: 200, radius: 140, speed: 0.02, range: 350, currentOffset: 0 },
        { x: 3500, y: 200, radius: 160, speed: 0.028, range: 450, currentOffset: 0 },
        { x: 4500, y: 200, radius: 130, speed: 0.035, range: 300, currentOffset: 0 },
      ],
      nuggets: [
        { x: 550, y: 400, width: 20, height: 20, name: 'Roma', collected: false },
        { x: 950, y: 300, width: 20, height: 20, name: 'Cherry', collected: false },
        { x: 1350, y: 200, width: 20, height: 20, name: 'Grape', collected: false },
        { x: 1850, y: 350, width: 20, height: 20, name: 'Plum', collected: false },
        { x: 2350, y: 250, width: 20, height: 20, name: 'Beef', collected: false },
        { x: 2850, y: 150, width: 20, height: 20, name: 'Steak', collected: false },
        { x: 3350, y: 400, width: 20, height: 20, name: 'Vine', collected: false },
        { x: 3850, y: 300, width: 20, height: 20, name: 'Juicy', collected: false },
        { x: 4350, y: 200, width: 20, height: 20, name: 'Red', collected: false },
        { x: 4850, y: 350, width: 20, height: 20, name: 'Round', collected: false },
        { x: 5350, y: 250, width: 20, height: 20, name: 'Sweet', collected: false },
      ],
      powerUps: [
        { x: 600, y: 410, width: 24, height: 24, type: 'attack', collected: false, bobOffset: 0 },
        { x: 1400, y: 210, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 4 },
        { x: 2400, y: 260, width: 24, height: 24, type: 'speed', collected: false, bobOffset: Math.PI },
        { x: 3400, y: 410, width: 24, height: 24, type: 'grease-immunity', collected: false, bobOffset: Math.PI / 2 },
        { x: 4400, y: 210, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 3 },
      ],
      goal: { x: 5800, y: 450, width: 100, height: 100 },
    };
  };

  const initEnemies3 = (): Enemy[] => [
    { x: 600, y: 410, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 600, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 0 },
    { x: 1000, y: 310, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 1000, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 60 },
    { x: 1400, y: 210, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 1400, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 120 },
    { x: 2000, y: 360, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 2000, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 30 },
    { x: 2500, y: 260, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 2500, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 90 },
    { x: 3000, y: 160, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 3000, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 150 },
    { x: 3500, y: 410, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 3500, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 0 },
    { x: 4000, y: 310, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 4000, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 60 },
    { x: 4500, y: 210, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 4500, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 120 },
    { x: 5000, y: 360, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 5000, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 30 },
    { x: 5500, y: 260, width: 40, height: 40, vx: 0, vy: 0, type: 'tomato-thrower', patrolRange: 0, startPoint: 5500, direction: -1, health: 5, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 90 },
  ];

  const initLevel4 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 2000, height: 50, type: 'normal' }, // Ground
        { x: 200, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 1600, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 500, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 1300, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 900, y: 150, width: 200, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 400, y: 530, width: 1200, height: 20, type: 'mayo-puddle' },
      ],
      spotlights: [
        { x: 1000, y: 100, radius: 200, speed: 0.05, range: 600, currentOffset: 0 },
      ],
      nuggets: [
        { x: 250, y: 350, width: 20, height: 20, name: 'Trapped 1', collected: false },
        { x: 1650, y: 350, width: 20, height: 20, name: 'Trapped 2', collected: false },
        { x: 550, y: 200, width: 20, height: 20, name: 'Trapped 3', collected: false },
        { x: 1350, y: 200, width: 20, height: 20, name: 'Trapped 4', collected: false },
        { x: 950, y: 100, width: 20, height: 20, name: 'Trapped 5', collected: false },
      ],
      powerUps: [
        { x: 100, y: 510, width: 24, height: 24, type: 'attack', collected: false, bobOffset: 0 },
        { x: 1850, y: 510, width: 24, height: 24, type: 'speed', collected: false, bobOffset: Math.PI },
        { x: 950, y: 510, width: 24, height: 24, type: 'sea-salt', collected: false, bobOffset: Math.PI / 2 },
        { x: 1000, y: 300, width: 30, height: 30, type: 'super-mustard', collected: false, bobOffset: 0 }
      ],
      goal: { x: 1800, y: 450, width: 100, height: 100 },
    };
  };

  const initEnemies4 = (): Enemy[] => [
    { x: 900, y: -200, width: 200, height: 200, vx: 1.5, vy: 0, type: 'mayo-monster', patrolRange: 800, startPoint: 900, direction: 1, health: 500, maxHealth: 500, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 0 },
    { x: 300, y: 200, width: 30, height: 10, vx: 3, vy: 0, type: 'flying-fry', patrolRange: 300, startPoint: 300, startY: 200, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1500, y: 200, width: 30, height: 10, vx: 3, vy: 0, type: 'flying-fry', patrolRange: 300, startPoint: 1500, startY: 200, direction: -1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
  ];

  const initLevel5 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 2000, height: 50, type: 'normal' }, // Ground
        { x: 200, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 1600, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 500, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 1300, y: 250, width: 200, height: 20, type: 'normal' },
        { x: 900, y: 150, width: 200, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 400, y: 530, width: 1200, height: 20, type: 'hot-sauce' },
      ],
      spotlights: [
        { x: 1000, y: 100, radius: 250, speed: 0.08, range: 600, currentOffset: 0 },
      ],
      nuggets: [
        { x: 250, y: 350, width: 20, height: 20, name: 'Spicy Nugget 1', collected: false },
        { x: 1650, y: 350, width: 20, height: 20, name: 'Spicy Nugget 2', collected: false },
        { x: 550, y: 200, width: 20, height: 20, name: 'Spicy Nugget 3', collected: false },
        { x: 1350, y: 200, width: 20, height: 20, name: 'Spicy Nugget 4', collected: false },
        { x: 950, y: 100, width: 20, height: 20, name: 'Spicy Nugget 5', collected: false },
      ],
      powerUps: [
        { x: 650, y: 300, width: 24, height: 24, type: 'health', collected: false, bobOffset: 0 },
        { x: 2050, y: 300, width: 24, height: 24, type: 'speed', collected: false, bobOffset: Math.PI },
        { x: 1250, y: 100, width: 30, height: 30, type: 'super-mustard', collected: false, bobOffset: 0 }
      ],
      goal: { x: 1850, y: 450, width: 100, height: 100 },
    };
  };

  const initEnemies5 = (): Enemy[] => [
    { x: 900, y: -200, width: 150, height: 200, vx: 2, vy: 0, type: 'chili-boss', patrolRange: 800, startPoint: 900, direction: 1, health: 800, maxHealth: 800, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 0 },
    { x: 300, y: 200, width: 30, height: 10, vx: 4, vy: 0, type: 'flying-fry', patrolRange: 300, startPoint: 300, startY: 200, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1500, y: 200, width: 30, height: 10, vx: 4, vy: 0, type: 'flying-fry', patrolRange: 300, startPoint: 1500, startY: 200, direction: -1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
  ];

  const initLevel6 = (): Level => {
    return {
      platforms: [
        { x: 0, y: 550, width: 2500, height: 50, type: 'normal' }, // Ground
        { x: 300, y: 400, width: 200, height: 20, type: 'normal' },
        { x: 700, y: 300, width: 200, height: 20, type: 'normal' },
        { x: 1100, y: 200, width: 200, height: 20, type: 'normal' },
        { x: 1500, y: 300, width: 200, height: 20, type: 'normal' },
        { x: 1900, y: 400, width: 200, height: 20, type: 'normal' },
      ],
      hazards: [
        { x: 500, y: 530, width: 200, height: 20, type: 'hot-sauce' },
        { x: 1300, y: 530, width: 200, height: 20, type: 'hot-sauce' },
      ],
      spotlights: [],
      nuggets: [
        { x: 350, y: 350, width: 20, height: 20, name: 'Bun Nugget 1', collected: false },
        { x: 750, y: 250, width: 20, height: 20, name: 'Bun Nugget 2', collected: false },
        { x: 1150, y: 150, width: 20, height: 20, name: 'Bun Nugget 3', collected: false },
        { x: 1550, y: 250, width: 20, height: 20, name: 'Bun Nugget 4', collected: false },
        { x: 1950, y: 350, width: 20, height: 20, name: 'Bun Nugget 5', collected: false },
      ],
      powerUps: [
        { x: 1150, y: 100, width: 24, height: 24, type: 'health', collected: false, bobOffset: 0 },
      ],
      goal: { x: 2300, y: 450, width: 100, height: 100 },
    };
  };

  const initEnemies6 = (): Enemy[] => [
    { x: 1200, y: -200, width: 120, height: 100, vx: 3, vy: 0, type: 'evil-bun', patrolRange: 600, startPoint: 1200, direction: 1, health: 1000, maxHealth: 1000, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0, throwCooldown: 0 },
    { x: 400, y: 200, width: 30, height: 10, vx: 5, vy: 0, type: 'flying-fry', patrolRange: 400, startPoint: 400, startY: 200, direction: 1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
    { x: 1800, y: 200, width: 30, height: 10, vx: 5, vy: 0, type: 'flying-fry', patrolRange: 400, startPoint: 1800, startY: 200, direction: -1, health: 2, isDead: false, flashTimer: 0, hitColorTimer: 0, knockbackX: 0, deathTimer: 0 },
  ];

  useEffect(() => {
    const level = startingLevelIndex === 5 ? initLevel6() : startingLevelIndex === 4 ? initLevel5() : startingLevelIndex === 3 ? initLevel4() : startingLevelIndex === 2 ? initLevel3() : startingLevelIndex === 1 ? initLevel2() : initLevel1();
    setGameState({
      player: applyPhysicsToPlayer({
        characterType: selectedCharacter,
        x: 50,
        y: 500,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        vx: 0,
        vy: 0,
        isJumping: false,
        jumpCount: 0,
        jumpKeyReleased: true,
        isStealth: false,
        isAttacking: false,
        attackCooldown: 0,
        projectileCooldown: 0,
        health: 100,
        nuggetsRescued: 0,
        kills: 0,
        facing: 1,
        isDead: false,
        deathTimer: 0,
        deathCause: '',
        debris: [],
        saltCount: 3,
        saltCooldown: 0,
        lettuceStars: startingLevelIndex === 5 ? Infinity : 0,
      }, selectedCharacter),
      enemies: startingLevelIndex === 5 ? initEnemies6() : startingLevelIndex === 4 ? initEnemies5() : startingLevelIndex === 3 ? initEnemies4() : startingLevelIndex === 2 ? initEnemies3() : startingLevelIndex === 1 ? initEnemies2() : initEnemies1(),
      projectiles: [],
      distractions: [],
      particles: [],
      collectionAnimations: [],
      floatingTexts: [],
      level,
      powerUps: level.powerUps || [],
      camera: { x: 0, y: 0 },
      status: startingLevelIndex === 5 ? 'level6-intro' : startingLevelIndex === 4 ? 'level5-intro' : startingLevelIndex === 3 ? 'level4-intro' : startingLevelIndex === 2 ? 'level3-intro' : startingLevelIndex === 1 ? 'level2-intro' : 'level1-intro',
      score: 0,
      timeElapsed: 0,
      timeLeft: 75 * 60,
      shakeIntensity: 0,
      frameCounter: 0,
      currentLevelIndex: startingLevelIndex,
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        setGameState(prev => {
          if (!prev || prev.status !== 'playing' || prev.player.isDead) return prev;
          return { ...prev, isPaused: !prev.isPaused };
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.status === 'gameover') {
      onGameOver(gameState.score);
    } else if (gameState.status === 'win') {
      onWin(gameState.score, gameState.timeElapsed);
    }
  }, [gameState?.status, onGameOver, onWin]);

  useEffect(() => {
    if (!gameState) return;

    let animationFrameId: number;

    const update = () => {
      setGameState((prev) => {
        if (!prev || (prev.status !== 'playing' && !prev.player.isDead) || prev.isPaused) return prev;

        const { player, enemies, level, camera, projectiles, particles, collectionAnimations, floatingTexts, powerUps, shakeIntensity } = prev;
        const newPlayer = { ...player };
        if (!newPlayer.activeBuffs) newPlayer.activeBuffs = {};
        if (newPlayer.activeBuffs.speed && newPlayer.activeBuffs.speed > 0) newPlayer.activeBuffs.speed--;
        if (newPlayer.activeBuffs.attack && newPlayer.activeBuffs.attack > 0) newPlayer.activeBuffs.attack--;
        if (newPlayer.activeBuffs.greaseImmunity && newPlayer.activeBuffs.greaseImmunity > 0) newPlayer.activeBuffs.greaseImmunity--;
        
        let newShakeIntensity = shakeIntensity * 0.9;
        if (newShakeIntensity < 0.1) newShakeIntensity = 0;

        // Handle Player Death Animation
        if (newPlayer.isDead) {
          newPlayer.deathTimer = (newPlayer.deathTimer || 0) - 1;
          
          // Smoke particles
          if (Math.random() > 0.6) {
            particles.push({
              x: newPlayer.x + Math.random() * newPlayer.width,
              y: newPlayer.y + Math.random() * newPlayer.height,
              vx: (Math.random() - 0.5) * 1,
              vy: -Math.random() * 2 - 0.5,
              life: 40 + Math.random() * 40,
              maxLife: 80,
              color: Math.random() > 0.5 ? '#333' : '#555',
              size: 4 + Math.random() * 8
            });
          }

          if (newPlayer.deathTimer <= 0) {
            return { ...prev, status: 'gameover' };
          }

          // Camera follow during death cam (zoom in slightly)
          const newCamera = {
            x: Math.max(0, newPlayer.x - CANVAS_WIDTH / 2),
            y: Math.max(0, newPlayer.y - CANVAS_HEIGHT / 2),
          };

          return { ...prev, player: newPlayer, particles, camera: newCamera, shakeIntensity: newShakeIntensity };
        }

        if (newPlayer.health <= 0) {
          newPlayer.isDead = true;
          newPlayer.deathTimer = 180; // Longer death cam (3 seconds)
          newPlayer.vx = 0;
          newPlayer.vy = 0;
          newShakeIntensity = 20; // Big impact shake
          
          // Determine death cause if not already set
          if (!newPlayer.deathCause) {
            newPlayer.deathCause = "UNKNOWN FATALITY";
          }
          
          playDeath();
          return { ...prev, player: newPlayer, shakeIntensity: newShakeIntensity };
        }

        // Update Particles
        const updatedParticles: Particle[] = particles.map(p => {
          let nextX = p.x + p.vx;
          let nextY = p.y + p.vy;
          
          if (p.type === 'curly-fry') {
            // Spiral movement
            const angle = (p.maxLife - p.life) * 0.2;
            nextX += Math.cos(angle) * 2;
            nextY += Math.sin(angle) * 2;
          }

          return {
            ...p,
            x: nextX,
            y: nextY,
            vy: (p.type === 'smoke' || p.type === 'oil') ? p.vy - 0.05 : p.vy + 0.2, // Smoke/oil floats up
            rotation: p.rotation !== undefined ? p.rotation + (p.rotationSpeed || 0) : undefined,
            life: p.life - 1
          };
        }).filter(p => p.life > 0);

        // Update Floating Texts
        const updatedFloatingTexts = floatingTexts.map(t => ({
          ...t,
          y: t.y - 1, // Float up
          life: t.life - 1
        })).filter(t => t.life > 0);

        // Horizontal Movement
        const healthFactor = Math.max(0.4, newPlayer.health / 100);
        let currentMoveSpeed = (newPlayer.maxSpeed ?? MOVE_SPEED) * healthFactor;
        
        // Check if in grease
        const inGrease = level.hazards.some(hazard => 
          newPlayer.x < hazard.x + hazard.width &&
          newPlayer.x + newPlayer.width > hazard.x &&
          newPlayer.y < hazard.y + hazard.height &&
          newPlayer.y + newPlayer.height > hazard.y
        );
        
        const hasGreaseImmunity = newPlayer.activeBuffs?.greaseImmunity && newPlayer.activeBuffs.greaseImmunity > 0;
        if (inGrease && !hasGreaseImmunity) {
          currentMoveSpeed *= 0.4;
        }
        
        if (newPlayer.activeBuffs?.speed && newPlayer.activeBuffs.speed > 0) {
          currentMoveSpeed *= 1.5;
        }

        if (newPlayer.slowTimer && newPlayer.slowTimer > 0) {
          currentMoveSpeed *= 0.5;
          newPlayer.slowTimer--;
        }
        
        const currentJumpForce = (newPlayer.jumpVelocity ?? JUMP_FORCE) * (0.8 + 0.2 * healthFactor);

        let newBossIntroTimer = prev.bossIntroTimer;
        if (newBossIntroTimer !== undefined && newBossIntroTimer > 0) {
          newBossIntroTimer--;
        }

        const isIntroActive = newBossIntroTimer !== undefined && newBossIntroTimer > 0;

        if (isIntroActive) {
          // Ignore player input during intro
          newPlayer.vx *= 0.8;
          newPlayer.jumpKeyReleased = true;
        } else {
          if (keys.current['ArrowLeft'] || keys.current['KeyA']) {
            newPlayer.vx = -currentMoveSpeed;
            newPlayer.facing = -1;
          } else if (keys.current['ArrowRight'] || keys.current['KeyD']) {
            newPlayer.vx = currentMoveSpeed;
            newPlayer.facing = 1;
          } else {
            newPlayer.vx *= 0.8;
          }
        }

        // Stagger/Limp effect at low health
        if (newPlayer.health < 30 && !newPlayer.isDead && !newPlayer.isJumping) {
          if (Math.abs(newPlayer.vx) > 0.1) {
            newPlayer.y += Math.sin(Date.now() * 0.01) * 2 * (1 - healthFactor);
          }
        }

        newPlayer.x += newPlayer.vx;

        // Vertical Movement (Gravity)
        newPlayer.vy += GRAVITY;
        newPlayer.y += newPlayer.vy;

        // Collision with Platforms
        newPlayer.isJumping = true;
        level.platforms.forEach((platform) => {
          if (
            newPlayer.x < platform.x + platform.width &&
            newPlayer.x + newPlayer.width > platform.x &&
            newPlayer.y + newPlayer.height > platform.y &&
            newPlayer.y + newPlayer.height < platform.y + platform.height + newPlayer.vy
          ) {
            newPlayer.y = platform.y - newPlayer.height;
            newPlayer.vy = 0;
            newPlayer.isJumping = false;
            newPlayer.jumpCount = 0;
          }
        });

        // If falling without jumping, consume the first jump
        if (newPlayer.isJumping && newPlayer.jumpCount === 0 && newPlayer.vy > 0) {
          newPlayer.jumpCount = 1;
        }

        // Jump
        const isJumpKeyPressed = (keys.current['ArrowUp'] || keys.current['KeyW'] || keys.current['Space']) && !isIntroActive;
        
        if (!isJumpKeyPressed) {
          newPlayer.jumpKeyReleased = true;
        }

        if (isJumpKeyPressed && newPlayer.jumpKeyReleased && newPlayer.jumpCount < 2) {
          newPlayer.vy = currentJumpForce;
          newPlayer.isJumping = true;
          newPlayer.jumpCount++;
          newPlayer.jumpKeyReleased = false;
          playJump();
          
          if (newPlayer.jumpCount === 2) {
            for (let i = 0; i < 8; i++) {
              updatedParticles.push({
                x: newPlayer.x + newPlayer.width / 2,
                y: newPlayer.y + newPlayer.height,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 2,
                life: 15 + Math.random() * 10,
                maxLife: 30,
                color: '#fff',
                size: 2 + Math.random() * 3,
                type: 'smoke'
              });
            }
          }
        }

        // Crumb particles (Wear and Tear)
        if (newPlayer.health < 80 && Math.random() > (newPlayer.health / 100)) {
          updatedParticles.push({
            x: newPlayer.x + Math.random() * newPlayer.width,
            y: newPlayer.y + Math.random() * newPlayer.height,
            vx: (Math.random() - 0.5) * 1,
            vy: Math.random() * 2,
            life: 20 + Math.random() * 20,
            maxLife: 40,
            color: COLORS.nuggetTexture,
            size: 2 + Math.random() * 3
          });
        }

        // World Boundaries
        if (newPlayer.x < 0) newPlayer.x = 0;
        if (newPlayer.x > 6000 - newPlayer.width) newPlayer.x = 6000 - newPlayer.width;
        if (newPlayer.y > CANVAS_HEIGHT) {
          newPlayer.health = 0; // Fall death
          newPlayer.deathCause = "FELL INTO THE ABYSS";
        }

        // Attack Logic
        if (newPlayer.attackCooldown > 0) {
          newPlayer.attackCooldown--;
        }

        const currentProjectiles = [...projectiles];
        const droppedPowerUps: PowerUp[] = [];

        const handleEnemyDeath = (enemy: Enemy) => {
          enemy.isDead = true;
          newPlayer.kills += 1;
          newPlayer.health = Math.min(100, newPlayer.health + 5);
          updatedFloatingTexts.push({ x: newPlayer.x, y: newPlayer.y - 20, text: '+5 HP', life: 45, maxLife: 45, color: '#2ecc71' });
          playDeath();

          if (enemy.type === 'mayo-monster' || enemy.type === 'chili-boss' || enemy.type === 'evil-bun') {
            enemy.deathTimer = 180;
            newShakeIntensity = Math.max(newShakeIntensity, 25);
            updatedFloatingTexts.push({
              x: enemy.x,
              y: enemy.y,
              text: '+5000',
              life: 60,
              maxLife: 60,
              color: '#e74c3c'
            });
            // Boss Death Explosion
            for (let i = 0; i < 100; i++) {
              let pColor = '#f5f5dc';
              let pType: 'mayo' | 'hot-sauce' | 'fry' = 'mayo';
              if (enemy.type === 'chili-boss') {
                pColor = '#e74c3c';
                pType = 'hot-sauce';
              } else if (enemy.type === 'evil-bun') {
                pColor = '#d35400';
                pType = 'fry';
              }
              updatedParticles.push({
                x: enemy.x + Math.random() * enemy.width,
                y: enemy.y + Math.random() * enemy.height,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 60 + Math.random() * 60,
                maxLife: 120,
                color: pColor,
                size: 5 + Math.random() * 20,
                type: pType
              });
            }
            droppedPowerUps.push({
              x: enemy.x + enemy.width / 2 - 15,
              y: enemy.y + enemy.height - 30,
              width: 30,
              height: 30,
              type: enemy.type === 'chili-boss' ? 'super-mustard' : 'grease-immunity',
              collected: false,
              bobOffset: 0
            });
          } else {
            enemy.deathTimer = 30;
            newShakeIntensity = Math.max(newShakeIntensity, 8);
            updatedFloatingTexts.push({
              x: enemy.x,
              y: enemy.y,
              text: '+500',
              life: 60,
              maxLife: 60,
              color: '#e74c3c'
            });
            
            // Death explosion particles
            for (let i = 0; i < 20; i++) {
              const fryType = Math.random();
              let color = COLORS.fry;
              let size = 3 + Math.random() * 3;
              let type: 'fry' | 'waffle-fry' | 'curly-fry' | 'pickle-juice' | 'tomato-juice' = 'fry';
              
              if (enemy.type === 'dill-slicer') {
                color = '#2ecc71';
                type = 'pickle-juice';
                size = 4 + Math.random() * 4;
              } else if (enemy.type === 'tomato-thrower') {
                color = '#e74c3c';
                type = 'tomato-juice';
                size = 4 + Math.random() * 4;
              } else {
                if (fryType > 0.8) {
                  type = 'waffle-fry';
                  size = 6 + Math.random() * 4;
                } else if (fryType > 0.6) {
                  type = 'curly-fry';
                  size = 4 + Math.random() * 4;
                }
                
                if (Math.random() > 0.8) color = COLORS.fryBox;
                if (Math.random() > 0.9) color = '#3d2b1f';
              }

              updatedParticles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                vx: (Math.random() - 0.5) * 15,
                vy: -Math.random() * 12 - 3,
                life: 50 + Math.random() * 50,
                maxLife: 100,
                color: color,
                size: size,
                type: type,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
              });
            }
            // Oily Smoke burst
            for (let i = 0; i < 15; i++) {
              const isOil = Math.random() > 0.4;
              updatedParticles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 4 - 2,
                life: 40 + Math.random() * 50,
                maxLife: 90,
                color: isOil ? 'rgba(20, 15, 5, 0.8)' : 'rgba(60, 60, 60, 0.5)',
                size: (isOil ? 8 : 15) + Math.random() * 12,
                type: isOil ? 'oil' : 'smoke'
              });
            }
          }
        };

        // Enemies Update & Collision
        const updatedEnemies = enemies.map((enemy, idx) => {
          const nextEnemy = { ...enemy };
          
          if (nextEnemy.isDead) {
            if (nextEnemy.deathTimer && nextEnemy.deathTimer > 0) {
              nextEnemy.deathTimer--;
            }
            return nextEnemy;
          }

          // Distraction logic
          let nearestDistraction: Distraction | null = null;
          let minDist = Infinity;
          gameState.distractions.forEach(d => {
            if (d.active) {
              const dist = Math.sqrt(Math.pow(d.x - nextEnemy.x, 2) + Math.pow(d.y - nextEnemy.y, 2));
              if (dist < 400 && dist < minDist) {
                minDist = dist;
                nearestDistraction = d;
              }
            }
          });

          if (nearestDistraction) {
            nextEnemy.state = 'distracted';
            const dx = (nearestDistraction as Distraction).x - nextEnemy.x;
            if (Math.abs(dx) > 10) {
              nextEnemy.direction = dx > 0 ? 1 : -1;
              nextEnemy.vx = nextEnemy.type === 'dill-slicer' ? 4 : 2; // Move towards distraction
            } else {
              nextEnemy.vx = 0; // Reached distraction
            }
          } else if (nextEnemy.state === 'distracted') {
            nextEnemy.state = 'patrol';
            nextEnemy.vx = nextEnemy.type === 'dill-slicer' ? 2.5 : 2;
          }
          
          // Update hit timers
          if (nextEnemy.flashTimer && nextEnemy.flashTimer > 0) nextEnemy.flashTimer--;
          if (nextEnemy.hitColorTimer && nextEnemy.hitColorTimer > 0) nextEnemy.hitColorTimer--;
          if (nextEnemy.knockbackX && Math.abs(nextEnemy.knockbackX) > 0.1) {
            nextEnemy.x += nextEnemy.knockbackX;
            nextEnemy.knockbackX *= 0.8; // Friction
          } else {
            nextEnemy.knockbackX = 0;
          }

          if (!(nextEnemy.type === 'mayo-monster' && isIntroActive)) {
            nextEnemy.x += nextEnemy.vx * nextEnemy.direction;
            
            let currentPatrolRange = nextEnemy.patrolRange;
            if (nextEnemy.type === 'dill-slicer' && nextEnemy.state === 'charge') {
              currentPatrolRange *= 2; // Can chase further
            }

            if (Math.abs(nextEnemy.x - nextEnemy.startPoint) > currentPatrolRange) {
              nextEnemy.direction *= -1;
              if (nextEnemy.type === 'dill-slicer' && nextEnemy.state === 'charge') {
                 // End charge when hitting the extended boundary
                 nextEnemy.state = 'patrol';
                 nextEnemy.vx = 2.5;
                 nextEnemy.chargeCooldown = 120;
              }
            }
          }

          if (nextEnemy.type === 'flying-fry' && nextEnemy.startY !== undefined) {
            nextEnemy.y = nextEnemy.startY + Math.sin(prev.timeElapsed * 0.05 + nextEnemy.startPoint) * 50;
          }

          if (nextEnemy.type === 'dill-slicer') {
            const dist = Math.abs(newPlayer.x - nextEnemy.x);
            const yDist = Math.abs(newPlayer.y - nextEnemy.y);
            
            if (nextEnemy.state !== 'charge' && nextEnemy.state !== 'distracted' && dist < 300 && yDist < 100 && (!nextEnemy.chargeCooldown || nextEnemy.chargeCooldown <= 0)) {
              nextEnemy.state = 'charge';
              nextEnemy.vx = 8; // Fast roll
              nextEnemy.direction = newPlayer.x > nextEnemy.x ? 1 : -1;
            }
            
            if (nextEnemy.state === 'charge') {
              nextEnemy.rotation = (nextEnemy.rotation || 0) + (nextEnemy.vx * nextEnemy.direction * 0.2);
              
              // End charge if player is far away
              if (dist > 400) {
                nextEnemy.state = 'patrol';
                nextEnemy.vx = 2.5;
                nextEnemy.chargeCooldown = 120;
              }
              
              if (Math.random() > 0.5) {
                updatedParticles.push({
                  x: nextEnemy.x + nextEnemy.width / 2,
                  y: nextEnemy.y + nextEnemy.height,
                  vx: -nextEnemy.direction * 2 + (Math.random() - 0.5),
                  vy: -Math.random() * 2,
                  life: 10 + Math.random() * 10,
                  maxLife: 20,
                  color: '#2ecc71',
                  size: 2 + Math.random() * 2,
                  type: 'pickle-juice'
                });
              }
            } else {
              nextEnemy.rotation = (nextEnemy.rotation || 0) + (nextEnemy.vx * nextEnemy.direction * 0.1);
              if (nextEnemy.chargeCooldown && nextEnemy.chargeCooldown > 0) {
                nextEnemy.chargeCooldown--;
              }
            }
          }

          // Steam particles from top of fryer basket (only for fry-monster)
          if (nextEnemy.type === 'fry-monster' && Math.random() > 0.9) {
            updatedParticles.push({
              x: nextEnemy.x + Math.random() * nextEnemy.width,
              y: nextEnemy.y,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -Math.random() * 1 - 0.5,
              life: 20 + Math.random() * 20,
              maxLife: 40,
              color: 'rgba(200, 200, 200, 0.2)',
              size: 2 + Math.random() * 4
            });
          }

          if (nextEnemy.type === 'tomato-thrower') {
            const dist = Math.abs(newPlayer.x - nextEnemy.x);
            const yDist = Math.abs(newPlayer.y - nextEnemy.y);
            
            // Face the player
            nextEnemy.direction = newPlayer.x > nextEnemy.x ? 1 : -1;

            if (nextEnemy.throwCooldown && nextEnemy.throwCooldown > 0) {
              nextEnemy.throwCooldown--;
            } else if (dist < 500 && yDist < 200) {
              nextEnemy.throwCooldown = 120; // 2 seconds cooldown
              currentProjectiles.push({
                x: nextEnemy.x + nextEnemy.width / 2,
                y: nextEnemy.y + 10,
                vx: nextEnemy.direction * 5,
                vy: -3,
                radius: 6,
                color: '#e74c3c',
                active: true,
                type: 'tomato-slice'
              });
            }
          }

          if (nextEnemy.type === 'mayo-monster' || nextEnemy.type === 'chili-boss' || nextEnemy.type === 'evil-bun') {
            // Intro Drop Logic
            if (isIntroActive) {
              if (nextEnemy.y < 350) {
                nextEnemy.vy += GRAVITY; // Fall
                nextEnemy.y += nextEnemy.vy;
                if (nextEnemy.y >= 350) {
                  nextEnemy.y = 350;
                  nextEnemy.vy = 0;
                  newShakeIntensity = 20; // Big thud
                  playClang(); // Sound effect for landing
                  
                  // Splash particles
                  for (let i = 0; i < 30; i++) {
                    updatedParticles.push({
                      x: nextEnemy.x + Math.random() * nextEnemy.width,
                      y: nextEnemy.y + nextEnemy.height,
                      vx: (Math.random() - 0.5) * 15,
                      vy: -Math.random() * 10,
                      life: 30 + Math.random() * 30,
                      maxLife: 60,
                      color: nextEnemy.type === 'chili-boss' ? '#e74c3c' : (nextEnemy.type === 'evil-bun' ? '#d35400' : '#f5f5dc'),
                      size: 5 + Math.random() * 15,
                      type: nextEnemy.type === 'chili-boss' ? 'hot-sauce' : (nextEnemy.type === 'evil-bun' ? 'fry' : 'mayo')
                    });
                  }
                }
              } else if (newBossIntroTimer !== undefined && newBossIntroTimer < 180 && newBossIntroTimer > 60) {
                // Roar shake
                newShakeIntensity = Math.max(newShakeIntensity, 5);
                if (newBossIntroTimer % 30 === 0) playAttack(); // Roar sound
              }
              // Don't do normal logic during intro
              return nextEnemy;
            }

            if (nextEnemy.frozenTimer && nextEnemy.frozenTimer > 0) {
              nextEnemy.frozenTimer--;
              // Spawn ice/freeze particles
              if (Math.random() > 0.5) {
                updatedParticles.push({
                  x: nextEnemy.x + Math.random() * nextEnemy.width,
                  y: nextEnemy.y + Math.random() * nextEnemy.height,
                  vx: (Math.random() - 0.5) * 2,
                  vy: -1 - Math.random() * 2,
                  life: 30,
                  maxLife: 30,
                  color: '#a0e6ff', // Ice blue
                  size: 4 + Math.random() * 4,
                  type: 'ice',
                  rotation: Math.random() * Math.PI * 2
                });
              }
              return nextEnemy; // Skip normal logic while frozen
            }

            const dist = Math.abs(newPlayer.x - nextEnemy.x);
            const yDist = Math.abs(newPlayer.y - nextEnemy.y);
            
            // Face the player
            nextEnemy.direction = newPlayer.x > nextEnemy.x ? 1 : -1;

            // Trail
            if (Math.random() > 0.8) {
              updatedParticles.push({
                x: nextEnemy.x + Math.random() * nextEnemy.width,
                y: nextEnemy.y + nextEnemy.height,
                vx: 0,
                vy: 0,
                life: 100 + Math.random() * 100,
                maxLife: 200,
                color: nextEnemy.type === 'chili-boss' ? '#e74c3c' : '#f5f5dc',
                size: 5 + Math.random() * 10,
                type: nextEnemy.type === 'chili-boss' ? 'hot-sauce' : 'mayo'
              });
            }

            if (nextEnemy.type === 'chili-boss') {
              // Apply gravity and movement for jumping
              nextEnemy.vy += GRAVITY;
              nextEnemy.x += nextEnemy.vx;
              nextEnemy.y += nextEnemy.vy;

              // Floor collision
              if (nextEnemy.y >= 350) {
                if (nextEnemy.vy > 0 && nextEnemy.y > 350) {
                  // Landed
                  newShakeIntensity = Math.max(newShakeIntensity, 10);
                  playClang(); // Sound effect for landing
                  // Splash particles on landing
                  for (let i = 0; i < 15; i++) {
                    updatedParticles.push({
                      x: nextEnemy.x + Math.random() * nextEnemy.width,
                      y: nextEnemy.y + nextEnemy.height,
                      vx: (Math.random() - 0.5) * 10,
                      vy: -Math.random() * 5,
                      life: 20 + Math.random() * 20,
                      maxLife: 40,
                      color: '#e74c3c',
                      size: 3 + Math.random() * 8,
                      type: 'hot-sauce'
                    });
                  }
                }
                nextEnemy.y = 350;
                nextEnemy.vy = 0;
                nextEnemy.vx *= 0.8; // Friction
                if (Math.abs(nextEnemy.vx) < 0.5) nextEnemy.vx = 0;
              }

              if (nextEnemy.chargeCooldown && nextEnemy.chargeCooldown > 0) {
                nextEnemy.chargeCooldown--;
              } else if (dist > 200 && dist < 800 && nextEnemy.y >= 350) {
                // Jump towards player
                nextEnemy.chargeCooldown = 180; // 3 seconds between jumps
                nextEnemy.vy = -12;
                nextEnemy.vx = nextEnemy.direction * 6;
                playJump(); // Sound effect for jumping
              }
            }

            if (nextEnemy.throwCooldown && nextEnemy.throwCooldown > 0) {
              nextEnemy.throwCooldown--;
            } else if (dist < 600 && yDist < 300) {
              nextEnemy.throwCooldown = nextEnemy.type === 'chili-boss' ? 90 : 150; // Chili boss attacks faster
              
              if (nextEnemy.type === 'chili-boss') {
                playShoot(); // Sound effect for shooting
                // Muzzle flash particles
                for (let i = 0; i < 10; i++) {
                  updatedParticles.push({
                    x: nextEnemy.x + nextEnemy.width / 2 + nextEnemy.direction * 20,
                    y: nextEnemy.y + nextEnemy.height / 2,
                    vx: nextEnemy.direction * (5 + Math.random() * 5),
                    vy: (Math.random() - 0.5) * 5,
                    life: 10 + Math.random() * 10,
                    maxLife: 20,
                    color: '#f39c12',
                    size: 2 + Math.random() * 4,
                    type: 'sparkle'
                  });
                }
                // Chili boss shoots a spread of fire
                for (let i = -1; i <= 1; i++) {
                  currentProjectiles.push({
                    x: nextEnemy.x + nextEnemy.width / 2,
                    y: nextEnemy.y + nextEnemy.height / 2,
                    vx: nextEnemy.direction * 6 + (Math.random() - 0.5) * 2,
                    vy: -2 + i * 1.5,
                    radius: 8,
                    color: '#e74c3c',
                    active: true,
                    type: 'chili-fire'
                  });
                }
              } else {
                currentProjectiles.push({
                  x: nextEnemy.x + nextEnemy.width / 2,
                  y: nextEnemy.y + nextEnemy.height / 2,
                  vx: nextEnemy.direction * 4,
                  vy: -2,
                  radius: 12,
                  color: '#f5f5dc',
                  active: true,
                  type: 'mayo-glob'
                });
              }
            }
          }

          // Collision with player
          if (
            !nextEnemy.isDead &&
            newPlayer.x < nextEnemy.x + nextEnemy.width &&
            newPlayer.x + newPlayer.width > nextEnemy.x &&
            newPlayer.y < nextEnemy.y + nextEnemy.height &&
            newPlayer.y + newPlayer.height > nextEnemy.y
          ) {
            // Contact damage always applies, but stealth prevents detection (if implemented)
            newPlayer.health -= 0.5;
            newShakeIntensity = Math.max(newShakeIntensity, 3);
              
              if (Math.random() > 0.9) {
                newPlayer.debris.push({
                  x: Math.random() * newPlayer.width,
                  y: Math.random() * newPlayer.height,
                  type: 'fry',
                  rotation: Math.random() * Math.PI * 2,
                  size: 4 + Math.random() * 8
                });
              }

              if (newPlayer.health <= 0) {
                if (nextEnemy.type === 'fry-monster') newPlayer.deathCause = "FRIED BY A FRY MONSTER";
                else if (nextEnemy.type === 'sauce-sentry') newPlayer.deathCause = "ZAPPED BY A SAUCE SENTRY";
                else if (nextEnemy.type === 'flying-fry') newPlayer.deathCause = "IMPALED BY A FLYING FRY";
                else if (nextEnemy.type === 'dill-slicer') newPlayer.deathCause = "SLICED BY A DILL SLICER";
                else if (nextEnemy.type === 'tomato-thrower') newPlayer.deathCause = "SQUASHED BY A TOMATO";
              }
            }
          return nextEnemy;
        });

        // Melee Attack
        if ((keys.current['KeyF'] || keys.current['KeyJ']) && newPlayer.attackCooldown === 0 && !isIntroActive) {
          newPlayer.isAttacking = true;
          newPlayer.attackCooldown = ATTACK_COOLDOWN;
          playAttack();
          
          updatedEnemies.forEach((enemy) => {
            if (!enemy.isDead) {
              const attackX = newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x - ATTACK_RANGE;
              if (
                attackX < enemy.x + enemy.width &&
                attackX + ATTACK_RANGE > enemy.x &&
                newPlayer.y < enemy.y + enemy.height &&
                newPlayer.y + newPlayer.height > enemy.y
              ) {
                const damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 2 : 1;
                enemy.health -= damage;
                enemy.flashTimer = 10;
                enemy.knockbackX = newPlayer.facing * 8;
                
                if (enemy.health <= 0) {
                  handleEnemyDeath(enemy);
                }
              }
            }
          });
        }

        if (newPlayer.attackCooldown < ATTACK_COOLDOWN - 10) {
          newPlayer.isAttacking = false;
        }

        // Projectile Logic (Blaster & Custom Weapons)
        if (newPlayer.projectileCooldown > 0) {
          newPlayer.projectileCooldown--;
        } else if ((keys.current['KeyK'] || keys.current['KeyL']) && !isIntroActive) {
          playShoot();
          
          let projType: 'mustard' | 'super-mustard' | 'lettuce-star' | 'crumb' | 'salt-bullet' | 'hot-sauce' = 'mustard';
          let projColor = COLORS.mustard;
          let projRadius = PROJECTILE_RADIUS;
          let projSpeed = PROJECTILE_SPEED;
          
          // Override if power-ups are active
          if (newPlayer.lettuceStars && newPlayer.lettuceStars > 0) {
            newPlayer.projectileCooldown = PROJECTILE_COOLDOWN;
            projType = 'lettuce-star';
            projColor = '#2ecc71'; // Green for lettuce
            projRadius = PROJECTILE_RADIUS * 1.2;
            if (newPlayer.lettuceStars !== Infinity) {
              newPlayer.lettuceStars--;
            }
            currentProjectiles.push({
              x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
              y: newPlayer.y + newPlayer.height / 2,
              vx: newPlayer.facing * projSpeed,
              vy: 0,
              radius: projRadius,
              color: projColor,
              active: true,
              type: projType
            });
          } else if (newPlayer.superMustardShots && newPlayer.superMustardShots > 0) {
            newPlayer.projectileCooldown = PROJECTILE_COOLDOWN;
            projType = 'super-mustard';
            projColor = '#ffd700'; // Gold color for super mustard
            projRadius = PROJECTILE_RADIUS * 1.5;
            newPlayer.superMustardShots--;
            currentProjectiles.push({
              x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
              y: newPlayer.y + newPlayer.height / 2,
              vx: newPlayer.facing * projSpeed,
              vy: 0,
              radius: projRadius,
              color: projColor,
              active: true,
              type: projType
            });
          } else {
            // Base character weapons
            const activeChar = newPlayer.characterType || 'classic_og';
            
            if (activeChar === 'crispy_p') {
              // Crumb Shotgun: fires 3 spreading crumbs in a cone
              newPlayer.projectileCooldown = 35; // Slower reload speed
              const startX = newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x;
              const startY = newPlayer.y + newPlayer.height / 2;
              
              const vxs = [newPlayer.facing * 10, newPlayer.facing * 10, newPlayer.facing * 10];
              const vys = [0, -2.5, 2.5];
              
              for (let i = 0; i < 3; i++) {
                currentProjectiles.push({
                  x: startX,
                  y: startY,
                  vx: vxs[i],
                  vy: vys[i],
                  radius: 3,
                  color: '#e67e22',
                  active: true,
                  type: 'crumb'
                });
              }
            } else if (activeChar === 'chicken_fries') {
              // Salt SMG: rapid fire salt bullets with tiny vertical spread
              newPlayer.projectileCooldown = 8; // Very high rate of fire
              currentProjectiles.push({
                x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
                y: newPlayer.y + newPlayer.height / 2,
                vx: newPlayer.facing * 16, // Very fast bullets
                vy: (Math.random() - 0.5) * 1.5,
                radius: 2,
                color: '#ffffff',
                active: true,
                type: 'salt-bullet'
              });
            } else if (activeChar === 'spicy_nuggs') {
              // Hot Sauce Launcher: heavy launcher firing slow explosive blobs
              newPlayer.projectileCooldown = 45; // Slow rate of fire
              currentProjectiles.push({
                x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
                y: newPlayer.y + newPlayer.height / 2,
                vx: newPlayer.facing * 8, // Slower velocity
                vy: 0,
                radius: 8, // Large hit radius
                color: '#c0392b',
                active: true,
                type: 'hot-sauce'
              });
            } else {
              // classic_og - Honey Mustard Blaster (Standard)
              newPlayer.projectileCooldown = PROJECTILE_COOLDOWN;
              currentProjectiles.push({
                x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
                y: newPlayer.y + newPlayer.height / 2,
                vx: newPlayer.facing * PROJECTILE_SPEED,
                vy: 0,
                radius: PROJECTILE_RADIUS,
                color: COLORS.mustard,
                active: true,
                type: 'mustard'
              });
            }
          }
        }

        // Salt Throwing Logic
        if (newPlayer.saltCooldown > 0) {
          newPlayer.saltCooldown--;
        } else if (keys.current['KeyE'] && newPlayer.saltCount > 0 && !isIntroActive) {
          newPlayer.saltCooldown = 60; // 1 second cooldown
          newPlayer.saltCount--;
          playShoot(); // Reuse shoot sound for now
          currentProjectiles.push({
            x: newPlayer.facing === 1 ? newPlayer.x + newPlayer.width : newPlayer.x,
            y: newPlayer.y + 10,
            vx: newPlayer.facing * 8, // Throw forward
            vy: -6, // Arc upwards
            radius: 4,
            color: '#ffffff',
            active: true,
            type: 'salt'
          });
        }

        // Update Projectiles & Handle Enemy Hits
        const updatedDistractions = [...gameState.distractions];
        const finalProjectiles = currentProjectiles.map(p => ({ ...p })).filter((p) => {
          if (!p.active) return false;
          
          if (p.type === 'salt' || p.type === 'tomato-slice' || p.type === 'mayo-glob') {
            p.vy += GRAVITY;
          }
          
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > 6000) return false;

          // Check platform collision for salt, tomato-slice, and mayo-glob
          if (p.type === 'salt' || p.type === 'tomato-slice' || p.type === 'mayo-glob') {
            let hitPlatform = false;
            level.platforms.forEach((plat) => {
              if (
                p.x > plat.x && p.x < plat.x + plat.width &&
                p.y + p.radius > plat.y && p.y - p.radius < plat.y + plat.height
              ) {
                hitPlatform = true;
                p.y = plat.y - p.radius;
              }
            });
            if (hitPlatform) {
              if (p.type === 'salt') {
                updatedDistractions.push({
                  x: p.x,
                  y: p.y,
                  life: 300, // 5 seconds
                  maxLife: 300,
                  active: true
                });
              }
              return false; // Remove projectile
            }
          }

          // Check collision with player for tomato-slice and mayo-glob
          if (p.type === 'tomato-slice' || p.type === 'mayo-glob') {
            if (
              !newPlayer.isDead &&
              p.x > newPlayer.x && p.x < newPlayer.x + newPlayer.width &&
              p.y > newPlayer.y && p.y < newPlayer.y + newPlayer.height
            ) {
              if (p.type === 'tomato-slice') {
                newPlayer.health -= 10;
                newPlayer.deathCause = "SQUASHED BY A TOMATO";
                newShakeIntensity = Math.max(newShakeIntensity, 5);
                playDeath(); // Reuse death sound for getting hit
              } else if (p.type === 'mayo-glob') {
                newPlayer.health -= 5;
                newPlayer.deathCause = "DROWNED IN MAYO";
                newPlayer.slowTimer = 120; // 2 seconds of slow
                newShakeIntensity = Math.max(newShakeIntensity, 3);
              } else if (p.type === 'chili-fire') {
                newPlayer.health -= 15;
                newPlayer.deathCause = "INCINERATED BY CHILI FIRE";
                newShakeIntensity = Math.max(newShakeIntensity, 8);
                playDeath();
              }
              return false; // Remove projectile
            }
            return true; // These projectiles don't hit enemies
          }

          let hit = false;
          updatedEnemies.forEach((enemy) => {
            if (!enemy.isDead && !hit) {
              if (
                p.x > enemy.x && p.x < enemy.x + enemy.width &&
                p.y > enemy.y && p.y < enemy.y + enemy.height
              ) {
                let damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 2 : 1;
                
                if (enemy.type === 'mayo-monster' || enemy.type === 'chili-boss' || enemy.type === 'evil-bun') {
                  // Specific damage scaling for Bosses
                  let bossDamage = 0;
                  if (p.type === 'lettuce-star') {
                    bossDamage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 100 : 50;
                  } else if (p.type === 'super-mustard') {
                    bossDamage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 50 : 25;
                    enemy.superMustardHits = (enemy.superMustardHits || 0) + 1;
                    if (enemy.superMustardHits >= 3) {
                      enemy.frozenTimer = 180; // 3 seconds at 60fps
                      enemy.superMustardHits = 0;
                      updatedFloatingTexts.push({ x: enemy.x + enemy.width / 2, y: enemy.y, text: 'FROZEN!', life: 60, maxLife: 60, color: '#a0e6ff' });
                    }
                  } else if (p.type === 'crumb' || p.type === 'salt-bullet') {
                    bossDamage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 10 : 5;
                  } else if (p.type === 'hot-sauce') {
                    bossDamage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 40 : 20;
                  } else {
                    bossDamage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 20 : 10;
                  }
                  enemy.health -= bossDamage;
                  
                  // Hit marker for Boss
                  updatedFloatingTexts.push({
                    x: p.x,
                    y: p.y - 10,
                    text: `-${bossDamage}`,
                    life: 40,
                    maxLife: 40,
                    color: p.type === 'super-mustard' ? '#ffd700' : (p.type === 'lettuce-star' ? '#2ecc71' : '#ffcc00'),
                    fontSize: p.type === 'super-mustard' || p.type === 'lettuce-star' ? 24 : 16
                  });
                } else {
                  if (p.type === 'lettuce-star') {
                    damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 10 : 5;
                  } else if (p.type === 'super-mustard') {
                    damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 4 : 2;
                  } else if (p.type === 'crumb') {
                    damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 1.0 : 0.5;
                  } else if (p.type === 'salt-bullet') {
                    damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 1.0 : 0.5;
                  } else if (p.type === 'hot-sauce') {
                    damage = (newPlayer.activeBuffs?.attack && newPlayer.activeBuffs.attack > 0) ? 4 : 2;
                  }
                  enemy.health -= damage;
                }
                
                enemy.hitColorTimer = 15;
                hit = true;

                // Spawn splatter particles
                for (let i = 0; i < 8; i++) {
                  let particleColor = COLORS.fry;
                  let particleType: 'fry' | 'smoke' | 'sparkle' | 'oil' | 'waffle-fry' | 'curly-fry' | 'pickle-juice' | 'tomato-juice' | 'mayo' | 'hot-sauce' = 'fry';
                  
                  if (p.type === 'hot-sauce') {
                    particleColor = '#c0392b';
                    particleType = 'hot-sauce';
                  } else if (p.type === 'crumb') {
                    particleColor = '#e67e22';
                    particleType = 'fry';
                  } else if (p.type === 'salt-bullet') {
                    particleColor = '#ffffff';
                    particleType = 'sparkle';
                  } else if (enemy.type === 'fry-monster') {
                    particleColor = Math.random() > 0.5 ? COLORS.fry : COLORS.fryBox;
                  } else if (enemy.type === 'flying-fry') {
                    particleColor = COLORS.fry;
                  } else if (enemy.type === 'dill-slicer') {
                    particleColor = '#2ecc71';
                    particleType = 'pickle-juice';
                  } else if (enemy.type === 'tomato-thrower') {
                    particleColor = '#e74c3c';
                    particleType = 'tomato-juice';
                  } else if (enemy.type === 'mayo-monster') {
                    particleColor = '#f5f5dc';
                    particleType = 'mayo';
                  } else if (enemy.type === 'chili-boss') {
                    particleColor = '#e74c3c';
                    particleType = 'hot-sauce';
                  } else if (enemy.type === 'evil-bun') {
                    particleColor = '#d35400';
                    particleType = 'fry';
                  }

                  updatedParticles.push({
                    x: p.x,
                    y: p.y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6 - 2,
                    life: 20 + Math.random() * 20,
                    maxLife: 40,
                    color: p.type === 'super-mustard' ? '#ffd700' : particleColor,
                    size: 2 + Math.random() * 3,
                    type: particleType
                  });
                }

                if (enemy.health <= 0) {
                  handleEnemyDeath(enemy);
                }
              }
            }
          });
          return !hit;
        });

        // Update Distractions
        const finalDistractions = updatedDistractions.filter(d => {
          if (!d.active) return false;
          d.life--;
          if (d.life <= 0) return false;
          return true;
        });

        // Stealth Logic (Check if in spotlight)
        let inSpotlight = false;
        const nextSpotlights = level.spotlights.map((spot) => {
          const nextSpot = { ...spot, currentOffset: spot.currentOffset + spot.speed };
          const spotX = nextSpot.x + Math.sin(nextSpot.currentOffset) * nextSpot.range;
          const dist = Math.sqrt(Math.pow(newPlayer.x + newPlayer.width / 2 - spotX, 2) + Math.pow(newPlayer.y + newPlayer.height / 2 - spot.y, 2));
          if (dist < nextSpot.radius) inSpotlight = true;
          return nextSpot;
        });
        newPlayer.isStealth = !inSpotlight;

        if (inSpotlight) {
          newPlayer.health -= prev.currentLevelIndex === 4 ? 0.3 : 0.1; // Heat lamps in level 5
          newShakeIntensity = Math.max(newShakeIntensity, prev.currentLevelIndex === 4 ? 2 : 1);
          if (newPlayer.health <= 0 && !newPlayer.deathCause) {
            newPlayer.deathCause = prev.currentLevelIndex === 4 ? "ROASTED BY HEAT LAMP" : "EXPOSED BY SECURITY SPOTLIGHT";
          }
        }

        // Hazards
        level.hazards.forEach((hazard) => {
          if (
            newPlayer.x < hazard.x + hazard.width &&
            newPlayer.x + newPlayer.width > hazard.x &&
            newPlayer.y < hazard.y + hazard.height &&
            newPlayer.y + newPlayer.height > hazard.y
          ) {
            if (hazard.type === 'mustard-water') {
              if (!hasGreaseImmunity) {
                newPlayer.health -= 0.5;
                newShakeIntensity = Math.max(newShakeIntensity, 2);

                if (Math.random() > 0.9) {
                  newPlayer.debris.push({
                    x: Math.random() * newPlayer.width,
                    y: Math.random() * newPlayer.height,
                    type: 'mustard',
                    rotation: Math.random() * Math.PI * 2,
                    size: 6 + Math.random() * 10
                  });
                }

                if (newPlayer.health <= 0) {
                  newPlayer.deathCause = "DROWNED IN MUSTARD WATER";
                }
              }
            } else if (hazard.type === 'mayo-puddle') {
              if (!hasGreaseImmunity) {
                newPlayer.slowTimer = 10; // Apply slow while in puddle
                if (Math.random() > 0.9) {
                  updatedParticles.push({
                    x: newPlayer.x + Math.random() * newPlayer.width,
                    y: newPlayer.y + newPlayer.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 2,
                    life: 20 + Math.random() * 20,
                    maxLife: 40,
                    color: '#f5f5dc',
                    size: 3 + Math.random() * 3,
                    type: 'mayo'
                  });
                }
              }
            } else if (hazard.type === 'hot-sauce') {
              if (!hasGreaseImmunity) {
                newPlayer.health -= 1.0; // Hot sauce hurts more
                newShakeIntensity = Math.max(newShakeIntensity, 3);

                if (Math.random() > 0.8) {
                  updatedParticles.push({
                    x: newPlayer.x + Math.random() * newPlayer.width,
                    y: newPlayer.y + newPlayer.height,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -Math.random() * 4 - 1,
                    life: 30 + Math.random() * 30,
                    maxLife: 60,
                    color: '#ff3300',
                    size: 4 + Math.random() * 4,
                  });
                }

                if (newPlayer.health <= 0) {
                  newPlayer.deathCause = "INCINERATED BY HOT SAUCE";
                }
              }
            }
          }
        });

        // Collectibles & Animations
        const updatedAnimations = collectionAnimations.map(anim => ({
          ...anim,
          timer: anim.timer + 1
        }));

        const remainingAnimations = updatedAnimations.filter((anim) => {
          if (anim.timer === 80) {
            playClang();
          }
          if (anim.timer >= anim.maxTimer) {
            return false;
          }
          return true;
        });

        let nuggetsChanged = false;
        const newNuggets = level.nuggets.map((nugget) => {
          if (
            !nugget.collected &&
            newPlayer.x < nugget.x + nugget.width &&
            newPlayer.x + newPlayer.width > nugget.x &&
            newPlayer.y < nugget.y + nugget.height &&
            newPlayer.y + newPlayer.height > nugget.y
          ) {
            nuggetsChanged = true;
            newPlayer.nuggetsRescued += 1;
            playCollect();
            
            // Add floating score text
            updatedFloatingTexts.push({
              x: nugget.x,
              y: nugget.y,
              text: '+200',
              life: 60,
              maxLife: 60,
              color: '#f1c40f'
            });

            // Add "You saved [name]!" text
            updatedFloatingTexts.push({
              x: nugget.x,
              y: nugget.y - 20,
              text: `You saved ${nugget.name}!`,
              life: 90,
              maxLife: 90,
              color: '#fff',
              fontSize: 12
            });
            
            // Spawn collection crumbs & sparkles
            for (let i = 0; i < 20; i++) {
              const isSparkle = Math.random() > 0.6;
              updatedParticles.push({
                x: nugget.x + nugget.width / 2,
                y: nugget.y + nugget.height / 2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                color: isSparkle ? '#fff' : (Math.random() > 0.3 ? COLORS.nugget : COLORS.nuggetTexture),
                size: isSparkle ? 1 + Math.random() * 2 : 3 + Math.random() * 4
              });
            }
            
            // Extra burst of golden light
            for (let i = 0; i < 8; i++) {
              updatedParticles.push({
                x: nugget.x + nugget.width / 2,
                y: nugget.y + nugget.height / 2,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 20,
                maxLife: 20,
                color: 'rgba(255, 255, 255, 0.4)',
                size: 15 + Math.random() * 10
              });
            }

            remainingAnimations.push({
              x: nugget.x,
              y: nugget.y,
              timer: 0,
              maxTimer: 120, // Increased for a longer, cuter animation
              type: 'nugget',
            });
            return { ...nugget, collected: true };
          }
          return nugget;
        });

        let powerUpsChanged = false;
        const newPowerUps = [...(level.powerUps || []).map((pu) => {
          if (
            !pu.collected &&
            newPlayer.x < pu.x + pu.width &&
            newPlayer.x + newPlayer.width > pu.x &&
            newPlayer.y < pu.y + pu.height &&
            newPlayer.y + newPlayer.height > pu.y
          ) {
            powerUpsChanged = true;
            playCollect(); // Reuse collect sound
            
            // Apply buff
            if (pu.type === 'speed') {
              newPlayer.activeBuffs!.speed = 600; // 10 seconds
              updatedFloatingTexts.push({ x: pu.x, y: pu.y, text: 'SPEED BOOST!', life: 60, maxLife: 60, color: '#00ffff' });
            } else if (pu.type === 'attack') {
              newPlayer.activeBuffs!.attack = 600; // 10 seconds
              updatedFloatingTexts.push({ x: pu.x, y: pu.y, text: 'ATTACK UP!', life: 60, maxLife: 60, color: '#ff0000' });
            } else if (pu.type === 'grease-immunity') {
              newPlayer.activeBuffs!.greaseImmunity = 600; // 10 seconds
              updatedFloatingTexts.push({ x: pu.x, y: pu.y, text: 'GREASE IMMUNITY!', life: 60, maxLife: 60, color: '#00ff00' });
            } else if (pu.type === 'sea-salt') {
              newPlayer.saltCount += 3;
              updatedFloatingTexts.push({ x: pu.x, y: pu.y, text: '+3 SEA SALT!', life: 60, maxLife: 60, color: '#ffffff' });
            } else if (pu.type === 'super-mustard') {
              newPlayer.superMustardShots = 3;
              updatedFloatingTexts.push({ x: pu.x, y: pu.y, text: 'SUPER MUSTARD GUN!', life: 60, maxLife: 60, color: '#ffd700' });
            }

            // Particles
            for (let i = 0; i < 15; i++) {
              updatedParticles.push({
                x: pu.x + pu.width / 2,
                y: pu.y + pu.height / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color: pu.type === 'speed' ? '#00ffff' : pu.type === 'attack' ? '#ff0000' : pu.type === 'sea-salt' ? '#ffffff' : pu.type === 'super-mustard' ? '#ffd700' : '#00ff00',
                size: 3 + Math.random() * 4
              });
            }

            remainingAnimations.push({
              x: pu.x,
              y: pu.y,
              timer: 0,
              maxTimer: 60, // Faster animation for powerups
              type: 'powerup',
              powerUpType: pu.type
            });

            return { ...pu, collected: true };
          }
          return pu;
        }), ...droppedPowerUps];

        const nextLevel = { ...level, nuggets: newNuggets, spotlights: nextSpotlights, powerUps: newPowerUps };

        // Camera follow
        let targetCameraX = Math.max(0, newPlayer.x - CANVAS_WIDTH / 2);
        
        if (isIntroActive) {
          const boss = updatedEnemies.find(e => e.type === 'mayo-monster');
          if (boss) {
            targetCameraX = Math.max(0, boss.x - CANVAS_WIDTH / 2);
          }
        }

        // Smooth camera movement
        const newCamera = {
          x: camera.x + (targetCameraX - camera.x) * 0.1,
          y: 0,
        };

        const newTimeElapsed = prev.timeElapsed + 1;
        const newTimeLeft = Math.max(0, prev.timeLeft - 1);
        const timeBonus = Math.max(0, 10000 - Math.floor(newTimeElapsed / 60) * 10);
        const baseScore = newPlayer.nuggetsRescued * 200 + newPlayer.kills * 500;

        if (newTimeLeft <= 0 && !newPlayer.isDead) {
          newPlayer.isDead = true;
          newPlayer.deathTimer = 180;
          newPlayer.vx = 0;
          newPlayer.vy = 0;
          newShakeIntensity = 15;
          newPlayer.deathCause = "TIME EXPIRED - MISSION FAILED";
          return { ...prev, player: newPlayer, shakeIntensity: newShakeIntensity, timeLeft: 0 };
        }

        const isBossDead = updatedEnemies.every(e => (e.type !== 'mayo-monster' && e.type !== 'chili-boss' && e.type !== 'evil-bun') || e.isDead);

        let newLevelTransitionTimer = prev.levelTransitionTimer;

        if (
          newPlayer.x < level.goal.x + level.goal.width &&
          newPlayer.x + newPlayer.width > level.goal.x &&
          newPlayer.y < level.goal.y + level.goal.height &&
          newPlayer.y + newPlayer.height > level.goal.y &&
          ((prev.currentLevelIndex !== 3 && prev.currentLevelIndex !== 4 && prev.currentLevelIndex !== 5) || isBossDead)
        ) {
          if (newLevelTransitionTimer === undefined) {
            newLevelTransitionTimer = 60;
            keys.current = {}; // Clear keys to prevent stuck movement on next level
            playLevelComplete();
          }
        }

        if (newLevelTransitionTimer !== undefined) {
          if (newLevelTransitionTimer > 0) {
            newLevelTransitionTimer--;
          } else {
            if (prev.currentLevelIndex === 0) {
              const nextLevelData = initLevel2();
              return {
                ...prev,
                status: 'level2-intro',
                level: nextLevelData,
                currentLevelIndex: 1,
                player: {
                  ...newPlayer,
                  x: 50,
                  y: 500,
                  vx: 0,
                  vy: 0,
                  debris: [],
                  health: Math.min(100, newPlayer.health + 50), // Heal between levels
                },
                enemies: initEnemies2(),
                powerUps: nextLevelData.powerUps || [],
                projectiles: [],
                distractions: [],
                particles: [],
                collectionAnimations: [],
                floatingTexts: [],
                camera: { x: 0, y: 0 },
                score: baseScore + timeBonus + 500,
                timeElapsed: newTimeElapsed,
                timeLeft: 75 * 60,
                shakeIntensity: 0,
                levelTransitionTimer: undefined,
              };
            } else if (prev.currentLevelIndex === 1) {
              const nextLevelData = initLevel3();
              return {
                ...prev,
                status: 'level3-intro',
                level: nextLevelData,
                currentLevelIndex: 2,
                player: {
                  ...newPlayer,
                  x: 50,
                  y: 500,
                  vx: 0,
                  vy: 0,
                  debris: [],
                  health: Math.min(100, newPlayer.health + 50), // Heal between levels
                },
                enemies: initEnemies3(),
                powerUps: nextLevelData.powerUps || [],
                projectiles: [],
                distractions: [],
                particles: [],
                collectionAnimations: [],
                floatingTexts: [],
                camera: { x: 0, y: 0 },
                score: baseScore + timeBonus + 500,
                timeElapsed: newTimeElapsed,
                timeLeft: 75 * 60,
                shakeIntensity: 0,
                levelTransitionTimer: undefined,
              };
            } else if (prev.currentLevelIndex === 2) {
              const nextLevelData = initLevel4();
              return {
                ...prev,
                status: 'level4-intro',
                level: nextLevelData,
                currentLevelIndex: 3,
                player: {
                  ...newPlayer,
                  x: 50,
                  y: 500,
                  vx: 0,
                  vy: 0,
                  debris: [],
                  health: Math.min(100, newPlayer.health + 50), // Heal between levels
                },
                enemies: initEnemies4(),
                powerUps: nextLevelData.powerUps || [],
                projectiles: [],
                distractions: [],
                particles: [],
                collectionAnimations: [],
                floatingTexts: [],
                camera: { x: 0, y: 0 },
                score: baseScore + timeBonus + 500,
                timeElapsed: newTimeElapsed,
                timeLeft: 75 * 60,
                shakeIntensity: 0,
                levelTransitionTimer: undefined,
              };
            } else if (prev.currentLevelIndex === 3) {
              const nextLevelData = initLevel5();
              return {
                ...prev,
                status: 'level5-intro',
                level: nextLevelData,
                currentLevelIndex: 4,
                player: {
                  ...newPlayer,
                  x: 50,
                  y: 500,
                  vx: 0,
                  vy: 0,
                  debris: [],
                  health: Math.min(100, newPlayer.health + 50), // Heal between levels
                },
                enemies: initEnemies5(),
                powerUps: nextLevelData.powerUps || [],
                projectiles: [],
                distractions: [],
                particles: [],
                collectionAnimations: [],
                floatingTexts: [],
                camera: { x: 0, y: 0 },
                score: baseScore + timeBonus + 500,
                timeElapsed: newTimeElapsed,
                timeLeft: 75 * 60,
                shakeIntensity: 0,
                levelTransitionTimer: undefined,
              };
            } else if (prev.currentLevelIndex === 4) {
              const nextLevelData = initLevel6();
              return {
                ...prev,
                status: 'level6-intro',
                level: nextLevelData,
                currentLevelIndex: 5,
                player: {
                  ...newPlayer,
                  x: 50,
                  y: 500,
                  vx: 0,
                  vy: 0,
                  debris: [],
                  health: Math.min(100, newPlayer.health + 50), // Heal between levels
                  lettuceStars: Infinity, // Give lettuce stars automatically
                },
                enemies: initEnemies6(),
                powerUps: nextLevelData.powerUps || [],
                projectiles: [],
                distractions: [],
                particles: [],
                collectionAnimations: [],
                floatingTexts: [],
                camera: { x: 0, y: 0 },
                score: baseScore + timeBonus + 500,
                timeElapsed: newTimeElapsed,
                timeLeft: 75 * 60,
                shakeIntensity: 0,
                levelTransitionTimer: undefined,
              };
            } else {
              return { ...prev, status: 'win', score: baseScore + timeBonus + 500, levelTransitionTimer: undefined };
            }
          }
        }

        return {
          ...prev,
          player: newPlayer,
          enemies: updatedEnemies,
          projectiles: finalProjectiles,
          distractions: finalDistractions,
          particles: updatedParticles,
          collectionAnimations: remainingAnimations,
          floatingTexts: updatedFloatingTexts,
          level: nextLevel,
          powerUps: nextLevel.powerUps || [],
          camera: newCamera,
          score: baseScore,
          timeElapsed: newTimeElapsed,
          timeLeft: newTimeLeft,
          shakeIntensity: newShakeIntensity,
          frameCounter: prev.frameCounter + 1,
          bossIntroTimer: newBossIntroTimer,
          levelTransitionTimer: newLevelTransitionTimer,
        };
      });
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState?.status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { player, level, camera, enemies, particles, shakeIntensity } = gameState;

      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Clear
      ctx.fillStyle = gameState.currentLevelIndex === 4 ? '#1a0505' : '#0a0a0a'; // Reddish tint for level 5
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Distant Industrial Silhouettes (Parallax-ish)
      ctx.save();
      ctx.translate(-camera.x * 0.3, 0);
      ctx.fillStyle = gameState.currentLevelIndex === 4 ? '#2a0a0a' : '#0d0d0d';
      for(let i = 0; i < 15; i++) {
        // Use deterministic heights based on index to avoid flickering
        const h = 150 + ((i * 73) % 200); 
        const w = 100 + ((i * 37) % 100);
        ctx.fillRect(i * 300, CANVAS_HEIGHT - h, w, h);
        
        // Chimneys with stable smoke
        const chimneyX = i * 300 + w/2 - 15;
        const chimneyH = h + 40;
        ctx.fillRect(chimneyX, CANVAS_HEIGHT - chimneyH, 30, 40);
        
        // Subtle smoke particles
        ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
        for(let j = 0; j < 3; j++) {
          const smokeY = CANVAS_HEIGHT - chimneyH - 20 - (j * 30) - ((Date.now() / 50 + i * 10) % 30);
          const smokeX = chimneyX + 15 + Math.sin(Date.now() / 1000 + i + j) * 10;
          ctx.beginPath();
          ctx.arc(smokeX, smokeY, 10 + j * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#0d0d0d'; // Reset for next building
      }
      ctx.restore();

      // Atmospheric Fog Layer
      const fogGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      fogGradient.addColorStop(0, 'transparent');
      fogGradient.addColorStop(0.7, 'rgba(10, 10, 10, 0)');
      fogGradient.addColorStop(1, 'rgba(20, 15, 5, 0.4)'); // Mustard-tinted fog at bottom
      ctx.fillStyle = fogGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Pipes leaking mustard (Mid-ground)
      ctx.save();
      ctx.translate(-camera.x * 0.6, 0);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 12;
      for(let i = 0; i < 15; i++) {
        const px = i * 600 + 100;
        const py = 50 + ((i * 13) % 100);
        ctx.beginPath();
        ctx.moveTo(px, -50);
        ctx.lineTo(px, py);
        ctx.lineTo(px + 150, py);
        ctx.stroke();
        
        // Drip effect
        const dripY = py + ((Date.now() / 10 + i * 100) % 400);
        ctx.fillStyle = COLORS.mustard;
        ctx.beginPath();
        ctx.arc(px + 130, dripY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Constant stream
        ctx.globalAlpha = 0.3;
        ctx.fillRect(px + 128, py, 4, CANVAS_HEIGHT);
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();

      ctx.save();
      if (player.isDead) {
        const zoom = 1.5;
        const centerX = player.x + player.width / 2;
        const centerY = player.y + player.height / 2;
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-centerX, -centerY);
      } else {
        ctx.translate(-camera.x, -camera.y);
      }

      // Draw Platforms
      level.platforms.forEach((p) => {
        ctx.fillStyle = p.type === 'mustard' ? COLORS.mustard : (gameState.currentLevelIndex === 4 ? '#3a1a1a' : '#222');
        ctx.fillRect(p.x, p.y, p.width, p.height);
        // Platform edge
        ctx.strokeStyle = gameState.currentLevelIndex === 4 ? '#5a2a2a' : '#444';
        ctx.strokeRect(p.x, p.y, p.width, p.height);
      });

      // Draw Hazards
      level.hazards.forEach((h) => {
        if (h.type === 'mustard-water') {
          ctx.fillStyle = COLORS.mustard;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(h.x, h.y, h.width, h.height);
          ctx.globalAlpha = 1.0;
          // Bubbles
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.2;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(h.x + (Date.now() / 20 + i * 40) % h.width, h.y + 10, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1.0;
        } else if (h.type === 'mayo-puddle') {
          ctx.fillStyle = '#f5f5dc';
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.ellipse(h.x + h.width / 2, h.y + h.height / 2, h.width / 2, h.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        } else if (h.type === 'hot-sauce') {
          ctx.fillStyle = '#ff3300';
          ctx.globalAlpha = 0.7;
          ctx.fillRect(h.x, h.y, h.width, h.height);
          ctx.globalAlpha = 1.0;
          // Bubbles
          ctx.fillStyle = '#ff9900';
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(h.x + (Date.now() / 15 + i * 30) % h.width, h.y + 10 + Math.sin(Date.now() / 100 + i) * 5, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1.0;
        }
      });

      // Draw Nuggets (Collectibles)
      level.nuggets.forEach((n, idx) => {
        if (!n.collected) {
          ctx.save();
          
          // Pulse and float effect
          const float = Math.sin(Date.now() / 300 + idx) * 4;
          const pulse = Math.sin(Date.now() / 200 + idx) * 1.5;
          const nx = n.x - pulse / 2;
          const ny = n.y - pulse / 2 + float;
          const nw = n.width + pulse;
          const nh = n.height + pulse;

          ctx.fillStyle = COLORS.nugget;
          ctx.strokeStyle = COLORS.nuggetDark;
          ctx.lineWidth = 2;
          
          // Mini nugget shape
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(nx, ny, nw, nh, 6);
          } else {
            ctx.rect(nx, ny, nw, nh);
          }
          ctx.fill();
          ctx.stroke();
          
          // Texture dots
          ctx.fillStyle = COLORS.nuggetTexture;
          ctx.beginPath();
          ctx.arc(nx + nw * 0.25, ny + nh * 0.25, 2, 0, Math.PI * 2);
          ctx.arc(nx + nw * 0.6, ny + nh * 0.7, 2, 0, Math.PI * 2);
          ctx.fill();

          // CUTE FACE
          ctx.fillStyle = '#000';
          // Eyes (blinking)
          const isBlinking = (Date.now() + idx * 500) % 4000 < 150;
          if (!isBlinking) {
            ctx.beginPath();
            ctx.arc(nx + nw * 0.3, ny + nh * 0.4, 1.5, 0, Math.PI * 2);
            ctx.arc(nx + nw * 0.7, ny + nh * 0.4, 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(nx + nw * 0.2, ny + nh * 0.4, 3, 1);
            ctx.fillRect(nx + nw * 0.6, ny + nh * 0.4, 3, 1);
          }
          // Tiny mouth
          ctx.beginPath();
          ctx.arc(nx + nw * 0.5, ny + nh * 0.65, 2, 0, Math.PI);
          ctx.stroke();

          // Glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = COLORS.nugget;
          ctx.stroke();
          ctx.restore();
        }
      });

      // Draw Power-Ups
      (level.powerUps || []).forEach((pu, idx) => {
        if (!pu.collected) {
          ctx.save();
          
          const float = Math.sin(Date.now() / 200 + idx) * 5;
          const px = pu.x;
          const py = pu.y + float;
          
          let color = '#fff';
          let icon = '?';
          if (pu.type === 'speed') {
            color = '#00ffff';
            icon = '⚡';
          } else if (pu.type === 'attack') {
            color = '#ff0000';
            icon = '⚔️';
          } else if (pu.type === 'grease-immunity') {
            color = '#00ff00';
            icon = '🛡️';
          } else if (pu.type === 'sea-salt') {
            color = '#ffffff';
            icon = '🧂';
          } else if (pu.type === 'super-mustard') {
            color = '#ffd700';
            icon = '🔫';
          }

          // Outer glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          
          // Background circle
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px + pu.width / 2, py + pu.height / 2, pu.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          // Icon
          ctx.shadowBlur = 0;
          ctx.fillStyle = color;
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, px + pu.width / 2, py + pu.height / 2);
          
          ctx.restore();
        }
      });

      // Draw Goal (Extraction Door)
      const goal = level.goal;
      const isBossDead = gameState.enemies.every(e => (e.type !== 'mayo-monster' && e.type !== 'chili-boss' && e.type !== 'evil-bun') || e.isDead);
      const isLocked = (gameState.currentLevelIndex === 3 || gameState.currentLevelIndex === 4 || gameState.currentLevelIndex === 5) && !isBossDead;

      ctx.save();
      
      // Door Frame
      ctx.fillStyle = COLORS.doorFrame;
      ctx.fillRect(goal.x - 10, goal.y - 10, goal.width + 20, goal.height + 10);
      
      // Inner Door
      ctx.fillStyle = isLocked ? '#555' : COLORS.doorPanel;
      ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
      
      // Door Details (Lines/Panels)
      ctx.strokeStyle = '#1A252F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(goal.x + goal.width / 2, goal.y);
      ctx.lineTo(goal.x + goal.width / 2, goal.y + goal.height);
      ctx.stroke();
      
      // Horizontal panels
      for(let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(goal.x, goal.y + (goal.height / 4) * i);
        ctx.lineTo(goal.x + goal.width, goal.y + (goal.height / 4) * i);
        ctx.stroke();
      }
      
      // Status Lights
      const lightOn = (Date.now() / 500) % 2 > 1;
      ctx.fillStyle = isLocked ? '#e74c3c' : (lightOn ? COLORS.doorLight : '#1E8449');
      ctx.beginPath();
      ctx.arc(goal.x + goal.width / 2, goal.y - 20, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow for light
      if (lightOn) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.doorLight;
        ctx.stroke();
      }
      
      // "EXTRACTION" Sign
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('EXTRACTION', goal.x + goal.width / 2, goal.y - 35);
      
      // Warning stripes
      ctx.fillStyle = '#F1C40F';
      for(let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(goal.x - 10 + i * 20, goal.y + goal.height);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(0, 0, 10, 30);
        ctx.restore();
      }
      
      ctx.restore();

      // Draw Particles
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        
        if (p.type === 'fry') {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size, p.size * 3); // Rectangular fry
        } else if (p.type === 'waffle-fry') {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation);
          // Draw a grid-like waffle fry
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size/3); ctx.lineTo(p.size, -p.size/3);
          ctx.moveTo(-p.size, p.size/3); ctx.lineTo(p.size, p.size/3);
          ctx.moveTo(-p.size/3, -p.size); ctx.lineTo(-p.size/3, p.size);
          ctx.moveTo(p.size/3, -p.size); ctx.lineTo(p.size/3, p.size);
          ctx.stroke();
        } else if (p.type === 'curly-fry') {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation);
          // Draw a spiral-like curly fry
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size / 2;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 1.5);
          ctx.stroke();
        } else if (p.type === 'smoke' || p.type === 'oil' || p.type === 'pickle-juice' || p.type === 'tomato-juice') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'sparkle') {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.type === 'ice') {
          ctx.translate(p.x, p.y);
          if (p.rotation !== undefined) ctx.rotate(p.rotation + (p.maxLife - p.life) * 0.1);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size / 2, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size / 2, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        
        ctx.restore();
      });

      // Draw Floating Texts
      gameState.floatingTexts.forEach((t) => {
        ctx.save();
        ctx.globalAlpha = t.life / t.maxLife;
        ctx.fillStyle = t.color;
        ctx.font = `bold ${t.fontSize || 16}px "Courier New"`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x - camera.x, t.y - camera.y);
        ctx.restore();
      });

      // Draw Enemies
      enemies.forEach((e, idx) => {
        if (!e.isDead) {
          ctx.save();
          
          if (e.type === 'fry-monster') {
            // Clanking/Bobbing animation
            const bob = Math.sin(Date.now() / 150 + idx) * 3;
            const tilt = Math.sin(Date.now() / 300 + idx) * 0.05;
            
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
            ctx.rotate(tilt);
            ctx.translate(-(e.x + e.width / 2), -(e.y + e.height / 2));

            // Fry Basket
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d'; // Bright red for damage
            } else {
              ctx.fillStyle = COLORS.fryBox;
            }
            ctx.fillRect(e.x, e.y + 10 + bob, e.width, e.height - 10);
            
            // Basket mesh texture
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            for(let i = 1; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(e.x, e.y + 10 + bob + (e.height - 10) / 4 * i);
              ctx.lineTo(e.x + e.width, e.y + 10 + bob + (e.height - 10) / 4 * i);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(e.x + e.width / 4 * i, e.y + 10 + bob);
              ctx.lineTo(e.x + e.width / 4 * i, e.y + e.height + bob);
              ctx.stroke();
            }

            // Fries sticking out (Tentacle-like wiggle)
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ffcc00'; // Bright yellow for damage
            } else {
              ctx.fillStyle = COLORS.fry;
            }
            for (let i = 0; i < 8; i++) {
              const fryH = 15 + Math.sin(Date.now() / 200 + i) * 5;
              ctx.fillRect(e.x + i * 5, e.y + bob - fryH + 10, 4, fryH);
            }

            // Angry Eyes (Blinking)
            const isBlinking = (Date.now() + idx * 1000) % 3000 < 150;
            ctx.fillStyle = '#fff';
            if (!isBlinking) {
              ctx.fillRect(e.x + 8, e.y + 15 + bob, 10, 10);
              ctx.fillRect(e.x + 22, e.y + 15 + bob, 10, 10);
              ctx.fillStyle = '#000';
              // Pupils follow player slightly
              const dx = player.x - e.x;
              const dy = player.y - e.y;
              const angle = Math.atan2(dy, dx);
              const px = Math.cos(angle) * 2;
              const py = Math.sin(angle) * 2;
              ctx.fillRect(e.x + 11 + px, e.y + 18 + bob + py, 4, 4);
              ctx.fillRect(e.x + 25 + px, e.y + 18 + bob + py, 4, 4);
            } else {
              // Blink line
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(e.x + 8, e.y + 20 + bob);
              ctx.lineTo(e.x + 18, e.y + 20 + bob);
              ctx.moveTo(e.x + 22, e.y + 20 + bob);
              ctx.lineTo(e.x + 32, e.y + 20 + bob);
              ctx.stroke();
            }
            
            // Teeth
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(e.x + 8, e.y + 30 + bob);
            ctx.lineTo(e.x + 13, e.y + 38 + bob);
            ctx.lineTo(e.x + 18, e.y + 30 + bob);
            ctx.lineTo(e.x + 23, e.y + 38 + bob);
            ctx.lineTo(e.x + 28, e.y + 30 + bob);
            ctx.lineTo(e.x + 33, e.y + 38 + bob);
            ctx.lineTo(e.x + 38, e.y + 30 + bob);
            ctx.fill();
          } else if (e.type === 'tomato-thrower') {
            // Tomato Thrower Rendering
            const bob = Math.sin(Date.now() / 200 + idx) * 4;
            
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bob);
            
            // Tomato Body
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else {
              ctx.fillStyle = '#e74c3c';
            }
            
            ctx.beginPath();
            ctx.arc(0, 0, e.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(-e.width / 4, -e.height / 4, e.width / 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Stem
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.moveTo(0, -e.height / 2);
            ctx.lineTo(-5, -e.height / 2 - 10);
            ctx.lineTo(5, -e.height / 2 - 10);
            ctx.fill();
            
            // Leaves
            for(let i = 0; i < 3; i++) {
              ctx.save();
              ctx.rotate((i - 1) * 0.5);
              ctx.beginPath();
              ctx.ellipse(0, -e.height / 2 - 2, 8, 4, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            
            // Angry Eyes
            ctx.fillStyle = '#fff';
            const eyeX = e.direction === 1 ? 8 : -8;
            ctx.beginPath();
            ctx.arc(eyeX - 8, -5, 5, 0, Math.PI * 2);
            ctx.arc(eyeX + 8, -5, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(eyeX - 8 + e.direction * 2, -5, 2, 0, Math.PI * 2);
            ctx.arc(eyeX + 8 + e.direction * 2, -5, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Angry Brows
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(eyeX - 14, -12);
            ctx.lineTo(eyeX - 2, -8);
            ctx.moveTo(eyeX + 14, -12);
            ctx.lineTo(eyeX + 2, -8);
            ctx.stroke();
            
          } else if (e.type === 'mayo-monster') {
            // Mayo Monster Rendering
            const isFrozen = e.frozenTimer && e.frozenTimer > 0;
            const bob = isFrozen ? 0 : Math.sin(Date.now() / 300 + idx) * 10;
            const wobble = isFrozen ? 0 : Math.cos(Date.now() / 200) * 5;
            
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2 + bob);
            
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else if (isFrozen) {
              ctx.fillStyle = '#a0e6ff'; // Ice blue when frozen
            } else {
              ctx.fillStyle = '#f5f5dc'; // Beige/Mayo
            }
            
            // Gelatinous Body
            ctx.beginPath();
            ctx.ellipse(0, 0, e.width / 2 + wobble, e.height / 2 - wobble, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlights to make it look gooey (or icy)
            ctx.fillStyle = isFrozen ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.ellipse(-e.width / 4, -e.height / 4, Math.abs(e.width / 6), Math.abs(e.height / 8), Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            
            // If frozen, draw some ice crystals
            if (isFrozen) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              for (let i = 0; i < 5; i++) {
                ctx.save();
                ctx.rotate((Math.PI * 2 / 5) * i);
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 3);
                ctx.lineTo(-10, -e.height / 2);
                ctx.lineTo(10, -e.height / 2);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
              }
            }
            
            // Eyes
            ctx.fillStyle = '#000';
            const eyeX = e.direction === 1 ? 20 : -20;
            ctx.beginPath();
            ctx.arc(eyeX - 30, -20, 10, 0, Math.PI * 2);
            ctx.arc(eyeX + 30, -20, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(eyeX - 30 + e.direction * 5, -20, 3, 0, Math.PI * 2);
            ctx.arc(eyeX + 30 + e.direction * 5, -20, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Mouth (drooling)
            const isRoaring = gameState.bossIntroTimer !== undefined && gameState.bossIntroTimer > 0 && gameState.bossIntroTimer < 180 && gameState.bossIntroTimer > 60;
            const mouthOpen = isFrozen ? 10 : (isRoaring ? 40 : 20 + wobble);
            
            ctx.fillStyle = '#8b0000'; // Dark red/brown inside mouth
            ctx.beginPath();
            ctx.ellipse(eyeX, 30, 40, mouthOpen, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (isRoaring && !isFrozen) {
              // Sound waves
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.lineWidth = 3;
              for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(eyeX, 30, 40 + i * 20 + (Date.now() / 20) % 20, -Math.PI/4, Math.PI/4);
                ctx.stroke();
              }
            }
            
            // Drool
            ctx.fillStyle = isFrozen ? '#a0e6ff' : '#f5f5dc';
            ctx.beginPath();
            ctx.arc(eyeX - 10, 30 + mouthOpen, 10, 0, Math.PI);
            ctx.arc(eyeX + 10, 30 + mouthOpen, 15, 0, Math.PI);
            ctx.fill();
            
            // Icy Shell Overlay
            if (isFrozen) {
              ctx.fillStyle = 'rgba(160, 230, 255, 0.4)'; // Translucent ice blue
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              
              ctx.beginPath();
              // Draw a slightly larger, crystalline shape around the monster
              ctx.ellipse(0, 0, e.width / 2 + 15, e.height / 2 + 15, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              
              // Add some frost lines on the shell
              ctx.beginPath();
              ctx.moveTo(-e.width/2 - 10, -e.height/2 - 10);
              ctx.lineTo(-e.width/3, -e.height/3);
              ctx.moveTo(e.width/2 + 10, -e.height/2 - 10);
              ctx.lineTo(e.width/3, -e.height/3);
              ctx.moveTo(-e.width/2 - 10, e.height/2 + 10);
              ctx.lineTo(-e.width/3, e.height/3);
              ctx.moveTo(e.width/2 + 10, e.height/2 + 10);
              ctx.lineTo(e.width/3, e.height/3);
              ctx.stroke();
            }

            // Health Bar
            if (e.maxHealth && e.health > 0) {
              const barWidth = 120;
              const barHeight = 12;
              const healthPercent = Math.max(0, e.health / e.maxHealth);
              
              const barX = -barWidth / 2;
              const barY = -e.height / 2 - 40; // Above the monster
              
              // Background
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(barX, barY, barWidth, barHeight);
              
              // Fill
              ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f1c40f' : '#e74c3c';
              ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
              
              // Border
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

          } else if (e.type === 'chili-boss') {
            // Chili Boss Rendering
            const wobble = Math.sin(Date.now() / 150 + idx) * 5;
            const isFrozen = e.frozenTimer && e.frozenTimer > 0;
            
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
            
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else if (isFrozen) {
              ctx.fillStyle = '#a0e6ff';
            } else {
              ctx.fillStyle = '#e74c3c'; // Hot red
            }
            
            // Bottle Body
            ctx.beginPath();
            ctx.moveTo(-e.width / 2 + 20, e.height / 2); // Bottom left
            ctx.lineTo(e.width / 2 - 20, e.height / 2); // Bottom right
            ctx.lineTo(e.width / 2 - 10, -e.height / 4); // Top right shoulder
            ctx.lineTo(e.width / 4, -e.height / 2 + 20); // Neck right
            ctx.lineTo(-e.width / 4, -e.height / 2 + 20); // Neck left
            ctx.lineTo(-e.width / 2 + 10, -e.height / 4); // Top left shoulder
            ctx.closePath();
            ctx.fill();
            
            // Bottle Cap
            ctx.fillStyle = isFrozen ? '#80c0ff' : '#2ecc71'; // Green cap
            ctx.fillRect(-e.width / 4 - 5, -e.height / 2 - 10, e.width / 2 + 10, 30);
            
            // Label
            ctx.fillStyle = isFrozen ? '#e0f7fa' : '#f1c40f'; // Yellow label
            ctx.fillRect(-e.width / 2 + 15, -10, e.width - 30, 60);
            
            // Label Text/Design
            ctx.fillStyle = '#c0392b';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('XXX', 0, 20);
            ctx.fillText('HOT', 0, 40);

            // Eyes
            ctx.fillStyle = '#000';
            const eyeX = e.direction === 1 ? 10 : -10;
            ctx.beginPath();
            ctx.arc(eyeX - 20, -e.height / 4 + 10, 8, 0, Math.PI * 2);
            ctx.arc(eyeX + 20, -e.height / 4 + 10, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Angry Eyebrows
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(eyeX - 30, -e.height / 4 - 5);
            ctx.lineTo(eyeX - 10, -e.height / 4 + 5);
            ctx.moveTo(eyeX + 30, -e.height / 4 - 5);
            ctx.lineTo(eyeX + 10, -e.height / 4 + 5);
            ctx.stroke();

            // Pupils
            ctx.fillStyle = '#e74c3c'; // Red glowing pupils
            ctx.beginPath();
            ctx.arc(eyeX - 20 + e.direction * 3, -e.height / 4 + 10, 3, 0, Math.PI * 2);
            ctx.arc(eyeX + 20 + e.direction * 3, -e.height / 4 + 10, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Mouth
            const isRoaring = gameState.bossIntroTimer !== undefined && gameState.bossIntroTimer > 0 && gameState.bossIntroTimer < 180 && gameState.bossIntroTimer > 60;
            const mouthOpen = isFrozen ? 5 : (isRoaring ? 30 : 10 + wobble);
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(eyeX, -e.height / 4 + 40, 20, mouthOpen, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Fire breath if roaring
            if (isRoaring && !isFrozen) {
              ctx.fillStyle = '#f39c12';
              ctx.beginPath();
              ctx.moveTo(eyeX - 15, -e.height / 4 + 40);
              ctx.lineTo(eyeX + 15, -e.height / 4 + 40);
              ctx.lineTo(eyeX + e.direction * 60, -e.height / 4 + 80 + Math.random() * 20);
              ctx.fill();
              
              ctx.fillStyle = '#e74c3c';
              ctx.beginPath();
              ctx.moveTo(eyeX - 10, -e.height / 4 + 40);
              ctx.lineTo(eyeX + 10, -e.height / 4 + 40);
              ctx.lineTo(eyeX + e.direction * 40, -e.height / 4 + 70 + Math.random() * 20);
              ctx.fill();
            }

            // Icy Shell Overlay
            if (isFrozen) {
              ctx.fillStyle = 'rgba(160, 230, 255, 0.4)';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              
              ctx.beginPath();
              ctx.ellipse(0, 0, e.width / 2 + 15, e.height / 2 + 15, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            
            // Health Bar
            if (e.maxHealth && e.health > 0) {
              const barWidth = 120;
              const barHeight = 12;
              const healthPercent = Math.max(0, e.health / e.maxHealth);
              
              const barX = -barWidth / 2;
              const barY = -e.height / 2 - 40; // Above the monster
              
              // Background
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(barX, barY, barWidth, barHeight);
              
              // Fill
              ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f1c40f' : '#e74c3c';
              ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
              
              // Border
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

          } else if (e.type === 'flying-fry') {
            // Flying Fry Rendering
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else {
              ctx.fillStyle = COLORS.fry;
            }
            
            // Wavy shape
            ctx.beginPath();
            ctx.moveTo(e.x, e.y + e.height / 2);
            ctx.quadraticCurveTo(e.x + e.width / 4, e.y - 5, e.x + e.width / 2, e.y + e.height / 2);
            ctx.quadraticCurveTo(e.x + e.width * 0.75, e.y + e.height + 5, e.x + e.width, e.y + e.height / 2);
            ctx.lineTo(e.x + e.width, e.y + e.height);
            ctx.lineTo(e.x, e.y + e.height);
            ctx.fill();

            // Evil red eye
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(e.x + e.width / 2, e.y + e.height / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (e.type === 'dill-slicer') {
            // Dill Slicer Rendering
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
            ctx.rotate(e.rotation || 0);
            
            // Draw buzzsaw blades (sharp pickle edges)
            ctx.fillStyle = '#1e8449'; // Darker green for outer rind/blades
            ctx.beginPath();
            const numBlades = 16;
            for (let i = 0; i < numBlades; i++) {
              const angle = (i / numBlades) * Math.PI * 2;
              const radius = (e.width / 2) + (i % 2 === 0 ? 6 : -2); // Sharp points
              const px = Math.cos(angle) * radius;
              const py = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else {
              ctx.fillStyle = '#2ecc71'; // Pickle green inner
            }

            // Inner pickle slice
            ctx.beginPath();
            ctx.arc(0, 0, e.width / 2 - 2, 0, Math.PI * 2);
            ctx.fill();

            // Pickle seeds/texture (arranged in a star/slice pattern)
            ctx.fillStyle = '#27ae60';
            for (let i = 0; i < 3; i++) {
              const angle = (i / 3) * Math.PI * 2;
              ctx.beginPath();
              ctx.ellipse(Math.cos(angle) * 6, Math.sin(angle) * 6, 4, 2, angle, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // Angry eye in the center
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = e.state === 'charge' ? '#ff0000' : '#000'; // Red eye when charging
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (e.type === 'evil-bun') {
            // Evil Bun Rendering
            const wobble = Math.sin(Date.now() / 150 + idx) * 5;
            const isFrozen = e.frozenTimer && e.frozenTimer > 0;
            const isRoaring = gameState.bossIntroTimer !== undefined && gameState.bossIntroTimer > 0 && gameState.bossIntroTimer < 180 && gameState.bossIntroTimer > 60;
            const isIntroActive = gameState.bossIntroTimer !== undefined && gameState.bossIntroTimer > 0;
            
            // Invisibility logic (Phantom Bun)
            let bunAlpha = 0.08; // Almost invisible
            if (isIntroActive) bunAlpha = 1;
            else if (e.flashTimer && e.flashTimer > 0) bunAlpha = 1;
            else if (e.hitColorTimer && e.hitColorTimer > 0) bunAlpha = 0.8;
            else if (isFrozen) bunAlpha = 0.9;
            
            ctx.globalAlpha = bunAlpha;
            
            ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
            
            if (e.flashTimer && e.flashTimer > 0) {
              ctx.fillStyle = '#fff';
            } else if (e.hitColorTimer && e.hitColorTimer > 0) {
              ctx.fillStyle = '#ff4d4d';
            } else if (isFrozen) {
              ctx.fillStyle = '#a0e6ff';
            } else {
              ctx.fillStyle = '#d35400'; // Dark orange/brown bun color
            }
            
            // Draw the two halves of the vertical bun
            // Top bun half (curved)
            ctx.beginPath();
            if (e.direction === 1) {
              // Facing right, top bun is on the right
              ctx.ellipse(5, 0, e.width / 2 - 15, e.height / 2, 0, -Math.PI/2, Math.PI/2);
            } else {
              // Facing left, top bun is on the left
              ctx.ellipse(-5, 0, e.width / 2 - 15, e.height / 2, 0, Math.PI/2, -Math.PI/2);
            }
            ctx.fill();
            
            // Bottom bun half (flatter)
            ctx.fillStyle = (e.flashTimer && e.flashTimer > 0) ? '#fff' : (e.hitColorTimer && e.hitColorTimer > 0) ? '#ff4d4d' : isFrozen ? '#a0e6ff' : '#e67e22';
            ctx.beginPath();
            if (e.direction === 1) {
              // Bottom bun on the left
              ctx.ellipse(-5, 0, 20, e.height / 2 - 2, 0, Math.PI/2, -Math.PI/2);
            } else {
              // Bottom bun on the right
              ctx.ellipse(5, 0, 20, e.height / 2 - 2, 0, -Math.PI/2, Math.PI/2);
            }
            ctx.fill();
            
            // Dark line between them (the cut)
            ctx.strokeStyle = '#873600';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(0, -e.height / 2 + 5);
            ctx.lineTo(0, e.height / 2 - 5);
            ctx.stroke();
            
            // Sesame Seeds on the top bun
            ctx.fillStyle = '#f5f5dc';
            // We use fixed positions so they don't jitter
            const seedPositions = [
              {x: 20, y: -20}, {x: 35, y: -10}, {x: 25, y: 10}, {x: 40, y: 20},
              {x: 15, y: 30}, {x: 30, y: -35}, {x: 45, y: 5}
            ];
            seedPositions.forEach(pos => {
              ctx.beginPath();
              const sx = e.direction === 1 ? pos.x : -pos.x;
              ctx.ellipse(sx, pos.y, 3, 1.5, e.direction === 1 ? Math.PI/4 : -Math.PI/4, 0, Math.PI * 2);
              ctx.fill();
            });
            
            // Eyes
            ctx.fillStyle = '#000';
            const eyeX = e.direction === 1 ? 25 : -25;
            ctx.beginPath();
            ctx.arc(eyeX - 10, -15, 8, 0, Math.PI * 2);
            ctx.arc(eyeX + 10, -15, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Angry Eyebrows
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(eyeX - 20, -25);
            ctx.lineTo(eyeX - 5, -20);
            ctx.moveTo(eyeX + 20, -25);
            ctx.lineTo(eyeX + 5, -20);
            ctx.stroke();

            // Pupils
            ctx.fillStyle = '#e74c3c'; // Red glowing pupils
            ctx.beginPath();
            ctx.arc(eyeX - 10 + e.direction * 3, -15, 3, 0, Math.PI * 2);
            ctx.arc(eyeX + 10 + e.direction * 3, -15, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Mouth
            const mouthOpen = isFrozen ? 5 : (isRoaring ? 25 : 10 + wobble);
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(eyeX, 15, 15, mouthOpen, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Sharp Teeth
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(eyeX - 12, 15 - mouthOpen);
            ctx.lineTo(eyeX - 6, 15 - mouthOpen + 8);
            ctx.lineTo(eyeX, 15 - mouthOpen);
            ctx.lineTo(eyeX + 6, 15 - mouthOpen + 8);
            ctx.lineTo(eyeX + 12, 15 - mouthOpen);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(eyeX - 12, 15 + mouthOpen);
            ctx.lineTo(eyeX - 6, 15 + mouthOpen - 8);
            ctx.lineTo(eyeX, 15 + mouthOpen);
            ctx.lineTo(eyeX + 6, 15 + mouthOpen - 8);
            ctx.lineTo(eyeX + 12, 15 + mouthOpen);
            ctx.fill();

            // Icy Shell Overlay
            if (isFrozen) {
              ctx.fillStyle = 'rgba(160, 230, 255, 0.4)';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              
              ctx.beginPath();
              ctx.ellipse(0, 0, e.width / 2 + 15, e.height / 2 + 15, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            
            // Health Bar
            if (e.maxHealth && e.health > 0) {
              const barWidth = 120;
              const barHeight = 12;
              const healthPercent = Math.max(0, e.health / e.maxHealth);
              
              const barX = -barWidth / 2;
              const barY = -e.height / 2 - 40; // Above the monster
              
              // Background
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(barX, barY, barWidth, barHeight);
              
              // Fill
              ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f1c40f' : '#e74c3c';
              ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
              
              // Border
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.strokeRect(barX, barY, barWidth, barHeight);
            }
            
            // Restore translation
            ctx.translate(-(e.x + e.width / 2), -(e.y + e.height / 2));
          }
          
          ctx.restore();
        } else {
          // Dead enemy (fry mess / collapsed)
          ctx.save();
          
          const maxDeathTimer = (e.type === 'mayo-monster' || e.type === 'chili-boss' || e.type === 'evil-bun') ? 180 : 30;
          const deathProgress = e.deathTimer ? Math.max(0, Math.min(1, (maxDeathTimer - e.deathTimer) / maxDeathTimer)) : 1;
          const collapseScale = 1 - (deathProgress * 0.8);
          const opacity = 1 - (deathProgress * 0.5);
          
          ctx.globalAlpha = opacity;
          ctx.translate(e.x + e.width / 2, e.y + e.height);
          ctx.scale(1 + deathProgress * 0.5, collapseScale);
          ctx.translate(-(e.x + e.width / 2), -(e.y + e.height));
          
          if (e.type === 'fry-monster') {
            // Collapsed basket
            ctx.fillStyle = COLORS.fryBox;
            ctx.fillRect(e.x, e.y + e.height - 10, e.width + 10, 10);
            
            // Scattered fries (static mess)
            ctx.fillStyle = COLORS.fry;
            for (let i = 0; i < 12; i++) {
              ctx.save();
              ctx.translate(e.x + i * 4 - 5, e.y + e.height - 5);
              ctx.rotate(Math.PI / 2 + (i % 3 - 1) * 0.5);
              ctx.fillRect(0, 0, 3, 15);
              ctx.restore();
            }
          } else if (e.type === 'flying-fry') {
             ctx.fillStyle = COLORS.fry;
             ctx.fillRect(e.x, e.y + e.height - 5, e.width, 5);
          } else if (e.type === 'dill-slicer') {
             ctx.fillStyle = '#2ecc71';
             ctx.beginPath();
             ctx.ellipse(e.x + e.width / 2, e.y + e.height - 5, e.width / 2, 5, 0, 0, Math.PI * 2);
             ctx.fill();
          } else if (e.type === 'mayo-monster') {
             // Melting mayo puddle
             ctx.fillStyle = '#f5f5dc';
             ctx.beginPath();
             // Width expands, height flattens
             ctx.ellipse(e.x + e.width / 2, e.y + e.height - 5, e.width * (0.5 + deathProgress), 15 - deathProgress * 10, 0, 0, Math.PI * 2);
             ctx.fill();
             
             // Bubbles popping in the puddle
             ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
             for (let i = 0; i < 5; i++) {
               const bx = e.x + Math.random() * e.width;
               const by = e.y + e.height - Math.random() * 10;
               const br = Math.random() * 5 * (1 - deathProgress);
               if (br > 0) {
                 ctx.beginPath();
                 ctx.arc(bx, by, br, 0, Math.PI * 2);
                 ctx.fill();
               }
             }
          } else if (e.type === 'chili-boss') {
             // Shattered bottle puddle
             ctx.fillStyle = '#e74c3c';
             ctx.beginPath();
             ctx.ellipse(e.x + e.width / 2, e.y + e.height - 5, e.width * (0.5 + deathProgress), 15 - deathProgress * 10, 0, 0, Math.PI * 2);
             ctx.fill();
             
             // Glass shards
             ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
             for (let i = 0; i < 8; i++) {
               const bx = e.x + Math.random() * e.width;
               const by = e.y + e.height - Math.random() * 10;
               ctx.beginPath();
               ctx.moveTo(bx, by);
               ctx.lineTo(bx + 5, by + 5);
               ctx.lineTo(bx + 2, by + 8);
               ctx.fill();
             }
          } else if (e.type === 'evil-bun') {
             // Shattered bun puddle
             ctx.fillStyle = '#d35400';
             ctx.beginPath();
             ctx.ellipse(e.x + e.width / 2, e.y + e.height - 5, e.width * (0.5 + deathProgress), 15 - deathProgress * 10, 0, 0, Math.PI * 2);
             ctx.fill();
          }
          ctx.restore();
        }
      });

      // Draw Projectiles
      gameState.projectiles.forEach((p) => {
        if (!p.active) return;
        
        if (p.type === 'salt') {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#ffffff';
          
          // Draw a cluster of small squares for salt
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Date.now() * 0.01);
          ctx.fillRect(-2, -2, 2, 2);
          ctx.fillRect(1, 1, 2, 2);
          ctx.fillRect(-2, 1, 2, 2);
          ctx.restore();
          
          ctx.shadowBlur = 0;
        } else if (p.type === 'tomato-slice') {
          // Tomato Slice Rendering
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Date.now() * 0.01 * (p.vx > 0 ? 1 : -1));
          
          // Outer ring
          ctx.fillStyle = '#c0392b';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner flesh
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          
          // Seeds
          ctx.fillStyle = '#f1c40f';
          for(let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate(i * Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(p.radius * 0.4, 0, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          
          ctx.restore();
        } else if (p.type === 'mayo-glob') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = '#f5f5dc';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius, p.radius * 0.8, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.beginPath();
          ctx.ellipse(-p.radius / 3, -p.radius / 4, p.radius / 3, p.radius / 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'chili-fire') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#c0392b';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner core
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'super-mustard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = p.color;
          
          // Draw a larger, glowing oval for super mustard
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius, p.radius * 0.6, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
          
          // Inner bright core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 0.5, p.radius * 0.3, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        } else if (p.type === 'lettuce-star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Date.now() * 0.01 * (p.vx > 0 ? 1 : -1));
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#27ae60';
          
          // Draw a 5-pointed star
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * p.radius,
                       -Math.sin((18 + i * 72) / 180 * Math.PI) * p.radius);
            ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * (p.radius * 0.5),
                       -Math.sin((54 + i * 72) / 180 * Math.PI) * (p.radius * 0.5));
          }
          ctx.closePath();
          ctx.fill();
          
          // Inner detail
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        } else if (p.type === 'crumb') {
          // Irregular small crumb shape
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.x + p.y) * 0.05);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.radius, -p.radius);
          ctx.lineTo(p.radius, -p.radius * 0.5);
          ctx.lineTo(p.radius * 0.8, p.radius * 0.8);
          ctx.lineTo(-p.radius * 0.5, p.radius);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'salt-bullet') {
          // Sharp white crystal
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.x + p.y) * 0.1);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#ffffff';
          ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
          ctx.restore();
        } else if (p.type === 'hot-sauce') {
          // Splashy red teardrop shape
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#c0392b';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0.5 * Math.PI, 1.5 * Math.PI);
          ctx.lineTo(p.radius * 1.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Trail effect
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(p.x - p.vx * 0.5, p.y, p.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      // Draw Distractions
      gameState.distractions.forEach((d) => {
        if (!d.active) return;
        
        ctx.save();
        ctx.translate(d.x, d.y);
        
        // Draw pile of salt
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(0, -6);
        ctx.lineTo(8, 0);
        ctx.fill();
        
        // Draw sound waves
        const waveRadius = (300 - d.life) % 40;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - waveRadius / 40})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      });

      // Draw Collection Animations
      gameState.collectionAnimations.forEach((anim) => {
        const progress = anim.timer / anim.maxTimer;
        
        if (anim.type === 'powerup') {
          // Powerup animation: Fly directly to HUD
          const targetX = gameState.camera.x + 20; // HUD left edge
          const targetY = gameState.camera.y + 100; // HUD powerup area
          
          const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          const currentX = anim.x + (targetX - anim.x) * easeProgress;
          const currentY = anim.y + (targetY - anim.y) * easeProgress;
          
          ctx.save();
          ctx.translate(currentX, currentY);
          
          // Spin while flying
          ctx.rotate(progress * Math.PI * 4);
          
          // Draw powerup icon based on type
          ctx.fillStyle = anim.powerUpType === 'speed' ? '#00ffff' : 
                         anim.powerUpType === 'attack' ? '#ff0000' : 
                         anim.powerUpType === 'sea-salt' ? '#ffffff' : 
                         anim.powerUpType === 'super-mustard' ? '#ffd700' : '#00ff00';
          
          ctx.shadowBlur = 15;
          ctx.shadowColor = ctx.fillStyle;
          
          // Simple diamond shape for powerup
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.lineTo(12, 0);
          ctx.lineTo(0, 12);
          ctx.lineTo(-12, 0);
          ctx.closePath();
          ctx.fill();
          
          // Inner detail
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Trail
          ctx.globalAlpha = 1 - progress;
          for (let i = 1; i <= 3; i++) {
            const trailX = anim.x + (targetX - anim.x) * Math.max(0, easeProgress - i * 0.1);
            const trailY = anim.y + (targetY - anim.y) * Math.max(0, easeProgress - i * 0.1);
            ctx.beginPath();
            ctx.arc(trailX - currentX, trailY - currentY, 8 - i * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
          return;
        }

        // Nugget animation (existing)
        const scoopDuration = 80; // Slow, cute jump phase
        const scoopProgress = Math.min(1, anim.timer / scoopDuration); 
        const flyProgress = Math.max(0, (anim.timer - scoopDuration) / (anim.maxTimer - scoopDuration)); 

        // Target is top left UI area (40, 50) relative to camera
        const targetX = gameState.camera.x + 40; 
        const targetY = gameState.camera.y + 50;

        // Initial position is where it was collected
        const startY = anim.y + 40;
        const basketY = startY - (40 * scoopProgress);
        
        // After scooping, it flies to target
        const zipProgress = Math.pow(flyProgress, 2);
        let currentX = anim.x + (targetX - anim.x) * zipProgress;
        let currentY = (flyProgress > 0) ? (basketY + (targetY - basketY) * zipProgress) : basketY;

        // Add a slight shake during scooping
        if (scoopProgress > 0 && flyProgress === 0) {
          currentX += Math.sin(anim.timer * 0.5) * 2;
        }

        const size = 20;
        const basketSize = 34;

        ctx.save();
        
        // Trail of crumbs
        if (flyProgress > 0 && flyProgress < 0.9) {
          ctx.fillStyle = COLORS.nuggetTexture;
          for(let i = 0; i < 2; i++) {
            ctx.globalAlpha = 0.5 * (1 - flyProgress);
            ctx.fillRect(currentX + (Math.random() - 0.5) * 10, currentY + (Math.random() - 0.5) * 10, 2, 2);
          }
          ctx.globalAlpha = 1.0;
        }

        // Steam Effect (Diner Noir Lore)
        if (scoopProgress > 0.2) {
          ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
          for (let i = 0; i < 4; i++) {
            const steamX = currentX + Math.sin(anim.timer * 0.1 + i) * 15;
            const steamY = currentY - 10 - (i * 10) - ((anim.timer * 0.5) % 20);
            const steamSize = 8 + Math.sin(anim.timer * 0.05 + i) * 4;
            ctx.beginPath();
            ctx.arc(steamX, steamY, steamSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Grease Splatters
        if (scoopProgress > 0.5 && flyProgress < 0.5) {
          ctx.fillStyle = '#1a0f00'; // Dark grease color
          for (let i = 0; i < 6; i++) {
            const gx = currentX + Math.cos(i * 1.2) * 25 * scoopProgress;
            const gy = currentY + Math.sin(i * 1.2) * 25 * scoopProgress;
            ctx.beginPath();
            ctx.arc(gx, gy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Draw Fryer Basket (Diner Noir Aesthetic: Worn Chrome/Steel)
        ctx.strokeStyle = '#4a4a4a'; // Worn steel
        ctx.lineWidth = 2;
        
        // Basket body (wire mesh)
        ctx.beginPath();
        ctx.strokeRect(currentX - basketSize/2, currentY - 5, basketSize, basketSize/2);
        
        // Gritty Mesh Pattern
        ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
        ctx.lineWidth = 1;
        for(let i = -2; i <= 2; i++) {
          ctx.moveTo(currentX + i * 6, currentY - 5);
          ctx.lineTo(currentX + i * 6, currentY + 12);
        }
        for(let i = 0; i < 3; i++) {
          ctx.moveTo(currentX - basketSize/2, currentY - 5 + i * 6);
          ctx.lineTo(currentX + basketSize/2, currentY - 5 + i * 6);
        }
        ctx.stroke();

        // Main Frame
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.5;
        
        // Dented appearance (slightly irregular frame)
        ctx.beginPath();
        const bx = currentX - basketSize/2;
        const by = currentY - 5;
        const bw = basketSize;
        const bh = basketSize/2;
        
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw * 0.4, by);
        ctx.lineTo(bx + bw * 0.45, by + 2); // Small dent
        ctx.lineTo(bx + bw * 0.5, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx, by + bh);
        ctx.closePath();
        ctx.stroke();
        
        // Rust Spots
        ctx.fillStyle = '#8B4513'; // Rust color
        ctx.globalAlpha = 0.6;
        const rustSeed = (anim.x + anim.y) % 100;
        for(let i = 0; i < 3; i++) {
          const rx = bx + ((rustSeed * (i + 1)) % bw);
          const ry = by + ((rustSeed * (i + 2)) % bh);
          ctx.beginPath();
          ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        
        // Basket handle (Noir style: Heavy iron)
        ctx.strokeStyle = '#1c1c1c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(currentX - basketSize/2, currentY + 5);
        ctx.lineTo(currentX - basketSize/2 - 18, currentY - 12);
        ctx.stroke();
        
        // Handle grip
        ctx.fillStyle = '#3d2b1f'; // Dark wood/rubber grip
        ctx.fillRect(currentX - basketSize/2 - 22, currentY - 15, 8, 4);

        // Draw the Baby Nugget
        if (flyProgress > 0) {
          // Inside the basket during flight
          ctx.fillStyle = COLORS.nugget;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.mustard;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(currentX - size/2, currentY - 5, size, size * 0.8, 4);
          } else {
            ctx.rect(currentX - size/2, currentY - 5, size, size * 0.8);
          }
          ctx.fill();

          // Face on the rescued nugget
          ctx.fillStyle = '#000';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(currentX - 3, currentY - 1, 1.5, 0, Math.PI * 2);
          ctx.arc(currentX + 3, currentY - 1, 1.5, 0, Math.PI * 2);
          ctx.fill();
          // Happy mouth
          ctx.beginPath();
          ctx.arc(currentX, currentY + 1, 2, 0, Math.PI);
          ctx.stroke();
        } else {
          // Cute jump into the basket
          const jumpHeight = 30;
          const jumpProgress = scoopProgress;
          const jumpY = anim.y - (Math.sin(jumpProgress * Math.PI) * jumpHeight);
          
          ctx.fillStyle = COLORS.nugget;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.mustard;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(anim.x - size/2, jumpY, size, size * 0.8, 4);
          } else {
            ctx.rect(anim.x - size/2, jumpY, size, size * 0.8);
          }
          ctx.fill();
          
          // Little eyes for the baby nugget
          ctx.fillStyle = '#000';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(anim.x - 4, jumpY + 6, 2, 0, Math.PI * 2);
          ctx.arc(anim.x + 4, jumpY + 6, 2, 0, Math.PI * 2);
          ctx.fill();
          // Surprised mouth
          ctx.beginPath();
          ctx.arc(anim.x, jumpY + 10, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Sparkles (only during flight or end of scoop)
        if (scoopProgress > 0.8) {
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = 0;
          for (let i = 0; i < 3; i++) {
            const ox = Math.cos(Date.now() / 100 + i * 10) * 10 * (1 - flyProgress);
            const oy = Math.sin(Date.now() / 100 + i * 10) * 10 * (1 - flyProgress);
            ctx.beginPath();
            ctx.arc(currentX + ox, currentY + oy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        ctx.restore();
      });

      // Draw Player (Nugget Warrior)
      ctx.save();
      
      if (player.isDead) {
        const deathProgress = (120 - (player.deathTimer || 0)) / 120;
        
        ctx.save();
        if (player.facing === -1) {
          ctx.scale(-1, 1);
          ctx.translate(-player.x * 2 - player.width, 0);
        }

        if (player.deathCause === 'DROWNED IN MAYO' || player.deathCause === 'INCINERATED BY CHILI FIRE') {
          // Translucent, gooey mayo texture or fiery texture
          ctx.fillStyle = player.deathCause === 'INCINERATED BY CHILI FIRE' ? 'rgba(231, 76, 60, 0.85)' : 'rgba(245, 245, 220, 0.85)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4, 14);
          } else {
            ctx.rect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
          }
          ctx.fill();

          // Gooey drips
          ctx.fillStyle = player.deathCause === 'INCINERATED BY CHILI FIRE' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(245, 245, 220, 0.9)';
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(player.x + 10 + i * 10, player.y + player.height + Math.sin(Date.now() / 200 + i) * 8, 5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Floating particles around the body
          ctx.fillStyle = player.deathCause === 'INCINERATED BY CHILI FIRE' ? 'rgba(241, 196, 15, 0.7)' : 'rgba(245, 245, 220, 0.7)';
          for (let i = 0; i < 12; i++) {
            const px = player.x + (Math.sin(i * 123) * 0.5 + 0.5) * player.width;
            const py = player.y + (Math.cos(i * 321) * 0.5 + 0.5) * player.height - deathProgress * 40;
            ctx.beginPath();
            ctx.arc(px, py + Math.sin(Date.now() / 150 + i) * 10, 2 + (i % 4), 0, Math.PI * 2);
            ctx.fill();
          }

          // Dead Eyes (X X) - Darker for contrast
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 2;
          const eyeSize = 6;
          // Left Eye X
          ctx.beginPath();
          ctx.moveTo(player.x + 15 - eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 15 + eyeSize, player.y + 20 + eyeSize);
          ctx.moveTo(player.x + 15 + eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 15 - eyeSize, player.y + 20 + eyeSize);
          ctx.stroke();
          // Right Eye X
          ctx.beginPath();
          ctx.moveTo(player.x + 45 - eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 45 + eyeSize, player.y + 20 + eyeSize);
          ctx.moveTo(player.x + 45 + eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 45 - eyeSize, player.y + 20 + eyeSize);
          ctx.stroke();

        } else {
          // Charcoal effect
          const charcoalColor = `rgb(${Math.max(20, 230 - deathProgress * 210)}, ${Math.max(20, 126 - deathProgress * 106)}, ${Math.max(20, 34 - deathProgress * 14)})`;
          
          // Toasted Body
          ctx.fillStyle = charcoalColor;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(player.x, player.y, player.width, player.height, 12);
          } else {
            ctx.rect(player.x, player.y, player.width, player.height);
          }
          ctx.fill();

          // Burnt Texture
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          for(let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(player.x + 10 + i * 10, player.y + 10 + (i * 7) % 40, 5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Dead Eyes (X X)
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          const eyeSize = 6;
          // Left Eye X
          ctx.beginPath();
          ctx.moveTo(player.x + 15 - eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 15 + eyeSize, player.y + 20 + eyeSize);
          ctx.moveTo(player.x + 15 + eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 15 - eyeSize, player.y + 20 + eyeSize);
          ctx.stroke();
          // Right Eye X
          ctx.beginPath();
          ctx.moveTo(player.x + 45 - eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 45 + eyeSize, player.y + 20 + eyeSize);
          ctx.moveTo(player.x + 45 + eyeSize, player.y + 20 - eyeSize);
          ctx.lineTo(player.x + 45 - eyeSize, player.y + 20 + eyeSize);
          ctx.stroke();
        }

        ctx.restore();

        // Dropped Mustard Gun
        const gunFallProgress = Math.min(1, deathProgress * 2);
        const gunX = player.x + (player.facing === 1 ? 40 : -10) + gunFallProgress * 40 * player.facing;
        const gunY = player.y + 25 + gunFallProgress * 150;
        const gunRotation = deathProgress * Math.PI * 2;

        ctx.save();
        ctx.translate(gunX + 15, gunY + 10);
        ctx.rotate(gunRotation);
        ctx.translate(-(gunX + 15), -(gunY + 10));
        
        ctx.fillStyle = '#444';
        ctx.fillRect(gunX, gunY, 30, 15); // Barrel
        ctx.fillStyle = COLORS.mustard;
        ctx.fillRect(gunX + 5, gunY + 3, 20, 9); // Mustard core
        ctx.fillStyle = '#222';
        ctx.fillRect(gunX - 10, gunY - 5, 15, 25); // Grip
        ctx.restore();

      } else {
        if (player.facing === -1) {
          ctx.scale(-1, 1);
          ctx.translate(-player.x * 2 - player.width, 0);
        }

        // Performance Slowdown (Visual Lag)
        const skipFrames = Math.floor((100 - player.health) / 20);
        if (skipFrames > 0 && gameState.frameCounter % (skipFrames + 1) !== 0) {
          ctx.globalAlpha = 0.4; // Ghosting effect
        }

        // Body
        ctx.fillStyle = player.isStealth ? COLORS.nuggetDark : COLORS.nugget;
        
        // Jitter at low health
        const jitter = player.health < 25 ? (Math.random() - 0.5) * 2 : 0;
        const px = player.x + jitter;
        const py = player.y + jitter;

        // Buff Auras
        if (player.activeBuffs) {
          ctx.save();
          if (player.activeBuffs.speed && player.activeBuffs.speed > 0) {
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 15 + Math.sin(Date.now() / 100) * 5;
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px - 2, py - 2, player.width + 4, player.height + 4);
          }
          if (player.activeBuffs.attack && player.activeBuffs.attack > 0) {
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 15 + Math.sin(Date.now() / 100) * 5;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px - 4, py - 4, player.width + 8, player.height + 8);
          }
          if (player.activeBuffs.greaseImmunity && player.activeBuffs.greaseImmunity > 0) {
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 15 + Math.sin(Date.now() / 100) * 5;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px - 6, py - 6, player.width + 12, player.height + 12);
          }
          ctx.restore();
        }

        const cx = px + player.width / 2;
        const cy = py + player.height / 2;
        
        ctx.beginPath();

        // Helper to draw the unified face (angry eyes, pupils looking right)
        const drawFace = (faceCyOffset = 0) => {
          const fcy = cy + faceCyOffset;
          // White eyes
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx - 5.25, fcy - 1.5, 3.75, 0, Math.PI * 2);
          ctx.arc(cx + 5.25, fcy - 1.5, 3.75, 0, Math.PI * 2);
          ctx.fill();
          
          // Pupils looking right
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(cx - 3.75, fcy - 1.5, 1.5, 0, Math.PI * 2);
          ctx.arc(cx + 6.75, fcy - 1.5, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Angry eyebrows
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - 9.75, fcy - 6);
          ctx.lineTo(cx - 2.25, fcy - 3);
          ctx.moveTo(cx + 9.75, fcy - 6);
          ctx.lineTo(cx + 2.25, fcy - 3);
          ctx.stroke();

          // Small mouth
          ctx.fillStyle = '#000000';
          ctx.fillRect(cx - 2.25, fcy + 6, 4.5, 1.5);
        };

        let drawnWithSprite = false;
        if (playerImageRef.current && playerImageLoaded) {
          try {
            ctx.drawImage(playerImageRef.current, px, py, player.width, player.height);
            drawnWithSprite = true;
          } catch (e) {
            console.error('Error drawing player sprite', e);
          }
        }

        if (!drawnWithSprite) {
          if (player.characterType === 'chicken_fries') {
            // Tall, vertical aerodynamic strip
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(cx - 10.5, cy - 22.5, 21, 45, 7.5);
            else ctx.rect(cx - 10.5, cy - 22.5, 21, 45);
            ctx.fill();

            // Blue and white retro sweatband
            ctx.fillStyle = '#3498db';
            ctx.fillRect(cx - 10.5, cy - 13.5, 21, 7.5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 10.5, cy - 11.25, 21, 3);

            drawFace(3.75);
          } else if (player.characterType === 'spicy_nuggs') {
            // Dark crimson, jagged/bumpy core
            ctx.fillStyle = '#922b21'; // darker bumps
            for (let i = 0; i < 8; i++) {
              ctx.beginPath();
              ctx.arc(cx + Math.cos(i * Math.PI/4) * 13.5, cy + Math.sin(i * Math.PI/4) * 13.5, 3.75, 0, Math.PI * 2);
              ctx.fill();
            }
            
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.arc(cx, cy, 14.25, 0, Math.PI * 2);
            ctx.fill();

            drawFace(0);
          } else if (player.characterType === 'crispy_p') {
            // Round body
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
            ctx.fill();

            // Solid red headband
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(cx - 12.75, cy - 10.5, 25.5, 5.25);
            // Headband knot
            ctx.beginPath();
            ctx.moveTo(cx - 12, cy - 7.5);
            ctx.lineTo(cx - 18, cy - 10.5);
            ctx.lineTo(cx - 16.5, cy - 4.5);
            ctx.fill();

            drawFace(0);
          } else {
            // Classic OG: Perfectly square, boxy orange body
            ctx.fillStyle = '#e67e22';
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.rect(cx - 13.5, cy - 13.5, 27, 27);
            ctx.fill();
            ctx.stroke();

            drawFace(0);
          }
        }

        // Grease Stains (Wear and Tear)
        if (player.health < 70) {
          ctx.fillStyle = 'rgba(40, 20, 0, 0.4)';
          const stainCount = Math.floor((100 - player.health) / 10);
          for (let i = 0; i < stainCount; i++) {
            const sx = px + (Math.sin(i * 1.5) * 0.5 + 0.5) * player.width;
            const sy = py + (Math.cos(i * 2.1) * 0.5 + 0.5) * player.height;
            ctx.beginPath();
            ctx.arc(sx, sy, 5 + Math.sin(i) * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw Debris (Stuck Fries/Mustard)
        player.debris.forEach(d => {
          ctx.save();
          ctx.translate(px + d.x, py + d.y);
          ctx.rotate(d.rotation);
          if (d.type === 'fry') {
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(-d.size/2, -2, d.size, 4);
          } else if (d.type === 'mustard') {
            ctx.fillStyle = COLORS.mustard;
            ctx.beginPath();
            ctx.arc(0, 0, d.size/2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });

        // Weapon Rendering (Custom based on character)
        const charType = player.characterType || 'classic_og';
        
        ctx.save();
        ctx.translate(px, py);
        
        if (charType === 'crispy_p') {
          // Crumb Shotgun (Chunky double-barrel)
          ctx.fillStyle = '#5c4033'; // Wooden stock/grip
          ctx.fillRect(30, 24, 12, 16); 
          ctx.fillStyle = '#7f8c8d'; // Double barrels
          ctx.fillRect(42, 23, 26, 6);
          ctx.fillRect(42, 30, 26, 6);
          ctx.fillStyle = '#2c3e50'; // Steel frame
          ctx.fillRect(36, 32, 6, 12);
        } else if (charType === 'chicken_fries') {
          // Salt SMG (Futuristic white/blue)
          ctx.fillStyle = '#ecf0f1'; // White body
          ctx.fillRect(30, 22, 22, 14);
          ctx.fillStyle = '#3498db'; // Glowing blue energy core
          ctx.fillRect(34, 25, 26, 4);
          ctx.fillStyle = '#bdc3c7'; // Barrel tip
          ctx.fillRect(52, 21, 10, 8);
          ctx.fillStyle = '#2c3e50'; // Grip
          ctx.fillRect(28, 28, 6, 16);
        } else if (charType === 'spicy_nuggs') {
          // Hot Sauce Launcher (Bulky bazooka)
          ctx.fillStyle = '#111'; // Bulk bazooka body
          ctx.fillRect(26, 16, 22, 22);
          ctx.fillStyle = '#c0392b'; // Deep red barrel
          ctx.fillRect(48, 18, 22, 16);
          ctx.fillStyle = '#27ae60'; // Green stripe
          ctx.fillRect(44, 16, 4, 22);
          ctx.fillStyle = '#2c3e50'; // Grip
          ctx.fillRect(32, 34, 8, 14);
        } else {
          // classic_og - Honey Mustard Blaster (Standard)
          ctx.fillStyle = '#444';
          ctx.fillRect(40, 25, 30, 15); // Barrel
          ctx.fillStyle = COLORS.mustard;
          ctx.fillRect(45, 28, 20, 9); // Mustard core
          ctx.fillStyle = '#222';
          ctx.fillRect(30, 20, 15, 25); // Grip/Body
        }
        
        ctx.restore();

        // Muscle/Texture, Scars, Angry Eyes, and Eyebrows are skipped if we draw using the PNG sprite
        if (!drawnWithSprite) {
          // Muscle/Texture
          ctx.fillStyle = COLORS.nuggetTexture;
          ctx.beginPath();
          ctx.arc(px + 15, py + 40, 8, 0, Math.PI * 2);
          ctx.arc(px + 45, py + 40, 8, 0, Math.PI * 2);
          ctx.fill();

          // Scars (Increases with damage)
          ctx.strokeStyle = COLORS.blood;
          ctx.lineWidth = 3;
          const scarCount = Math.max(1, Math.floor((100 - player.health) / 15));
          for (let i = 0; i < scarCount; i++) {
            ctx.beginPath();
            ctx.moveTo(px + 10 + i * 5, py + 15 + i * 2);
            ctx.lineTo(px + 25 + i * 5, py + 30 + i * 2);
            ctx.stroke();
          }

          // Angry Eyes (Change with health)
          const eyeColor = player.health < 30 ? '#ffcccc' : '#fff';
          ctx.fillStyle = eyeColor;
          ctx.beginPath();
          ctx.arc(px + 20, py + 20, 8, 0, Math.PI * 2);
          ctx.arc(px + 45, py + 20, 8, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#000';
          const pupilSize = player.health < 30 ? 4 : 3;
          ctx.beginPath();
          ctx.arc(px + 22, py + 20, pupilSize, 0, Math.PI * 2);
          ctx.arc(px + 47, py + 20, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          
          // Eyebrows (Angry/Pained)
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (player.health < 30) {
            // Pained eyebrows
            ctx.moveTo(px + 15, py + 18);
            ctx.lineTo(px + 25, py + 12);
            ctx.moveTo(px + 50, py + 18);
            ctx.lineTo(px + 40, py + 12);
          } else {
            // Angry eyebrows
            ctx.moveTo(px + 15, py + 12);
            ctx.lineTo(px + 25, py + 18);
            ctx.moveTo(px + 50, py + 12);
            ctx.lineTo(px + 40, py + 18);
          }
          ctx.stroke();
        }

        // Attack Swing
        if (player.isAttacking) {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(px + player.width + 10, py + player.height / 2, 20, -Math.PI / 2, Math.PI / 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      ctx.restore();

      // Draw Spotlights
      level.spotlights.forEach((s) => {
        const spotX = s.x + Math.sin(s.currentOffset) * s.range;
        const gradient = ctx.createRadialGradient(spotX, s.y, 0, spotX, s.y, s.radius);
        const spotlightColor = gameState.currentLevelIndex === 4 ? 'rgba(255, 100, 0, 0.3)' : COLORS.spotlight;
        gradient.addColorStop(0, spotlightColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(spotX, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // UI Overlay (Scoring Area)
      if (player.health < 20 && gameState.frameCounter % 10 < 2) {
        ctx.restore();
        return; // HUD Glitch: Skip rendering HUD occasionally
      }
      ctx.save();
      
      // HUD Glitch: Offset rendering
      if (player.health < 30 && Math.random() > 0.9) {
        ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
      }
      
      // Main Panel Background (Formica Texture)
      const hudWidth = 300;
      const hudHeight = 130;
      const hudX = 20;
      const hudY = 20;

      // Draw Formica Panel
      ctx.fillStyle = '#111';
      ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
      
      // Subtle Formica Pattern
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for(let i = 0; i < hudWidth; i += 20) {
        for(let j = 0; j < hudHeight; j += 20) {
          ctx.beginPath();
          ctx.arc(hudX + i + 2, hudY + j + 2, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Panel Border
      ctx.strokeStyle = COLORS.uiBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);
      
      // Outer Glow
      ctx.strokeStyle = 'rgba(230, 126, 34, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hudX - 2, hudY - 2, hudWidth + 4, hudHeight + 4);
      
      // Vintage Signage Header
      ctx.fillStyle = COLORS.uiAccent;
      ctx.font = 'bold 10px "Courier New"';
      ctx.fillText('PROPERTY OF THE SAUCE SYNDICATE', hudX + 10, hudY + 15);
      
      // Vitality Bar
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Courier New"';
      ctx.fillText('VITALITY', hudX + 20, hudY + 40);
      
      const barWidth = 160;
      const barHeight = 12;
      ctx.fillStyle = '#222';
      ctx.fillRect(hudX + 110, hudY + 28, barWidth, barHeight);
      
      const healthWidth = (player.health / 100) * barWidth;
      const healthColor = player.health > 50 ? '#2ecc71' : player.health > 25 ? '#f1c40f' : '#e74c3c';
      ctx.fillStyle = healthColor;
      ctx.fillRect(hudX + 110, hudY + 28, healthWidth, barHeight);
      
      // Nuggets & Intel
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Courier New"';
      ctx.fillText(`NUGGETS: ${player.nuggetsRescued}/13`, hudX + 20, hudY + 65);
      ctx.fillText(`INTEL: ${gameState.score.toString().padStart(6, '0')}`, hudX + 20, hudY + 85);
      
      // Sea Salt
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Courier New"';
      ctx.fillText(`🧂 SALT: ${player.saltCount}`, hudX + 160, hudY + 65);
      
      // Lettuce Stars
      if (player.lettuceStars !== undefined) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillText(`🥬 STARS: ${player.lettuceStars === Infinity ? '∞' : player.lettuceStars}`, hudX + 160, hudY + 85);
      }
      
      // Timer
      const minutes = Math.floor(gameState.timeElapsed / 3600);
      const seconds = Math.floor((gameState.timeElapsed % 3600) / 60);
      const centis = Math.floor((gameState.timeElapsed % 60) * 1.66);
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
      
      ctx.fillStyle = COLORS.uiAccent;
      ctx.font = 'bold 14px "Courier New"';
      ctx.fillText(`TIME: ${timeStr}`, hudX + 20, hudY + 105);
      
      // Countdown Timer
      const countdownSecs = Math.ceil(gameState.timeLeft / 60);
      const countdownColor = countdownSecs <= 10 ? '#e74c3c' : COLORS.uiAccent;
      ctx.fillStyle = countdownColor;
      ctx.font = 'bold 24px "Courier New"';
      ctx.textAlign = 'right';
      ctx.fillText(`${countdownSecs}s`, hudX + 380, hudY + 65);
      ctx.textAlign = 'left';
      
      // Stealth Status
      if (player.isStealth) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText('» STEALTH ACTIVE «', hudX + 160, hudY + 105);
      } else {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText('» EXPOSED «', hudX + 160, hudY + 105);
      }

      // Boss Intro Overlay
      if (gameState.bossIntroTimer !== undefined && gameState.bossIntroTimer > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (gameState.bossIntroTimer > 60) {
          ctx.font = 'bold 60px "Courier New"';
          ctx.fillStyle = '#e74c3c';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#e74c3c';
          ctx.fillText('WARNING: BOSS DETECTED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);
          
          const isChiliBoss = gameState.enemies.some(e => e.type === 'chili-boss');
          
          ctx.font = 'bold 40px "Courier New"';
          ctx.fillStyle = isChiliBoss ? '#e74c3c' : '#f5f5dc';
          ctx.shadowColor = isChiliBoss ? '#e74c3c' : '#f5f5dc';
          ctx.fillText(isChiliBoss ? 'THE DON' : 'THE EMULSION', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
        } else {
          ctx.font = 'bold 80px "Courier New"';
          ctx.fillStyle = '#e74c3c';
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#e74c3c';
          ctx.fillText('FIGHT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        }
        
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      
      // Active Buffs
      let buffOffset = 0;
      ctx.textAlign = 'right';
      if (player.activeBuffs?.speed && player.activeBuffs.speed > 0) {
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText(`⚡ SPEED (${Math.ceil(player.activeBuffs.speed / 60)}s)`, hudX + 380, hudY + 85 + buffOffset);
        buffOffset += 15;
      }
      if (player.activeBuffs?.attack && player.activeBuffs.attack > 0) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText(`⚔️ ATTACK (${Math.ceil(player.activeBuffs.attack / 60)}s)`, hudX + 380, hudY + 85 + buffOffset);
        buffOffset += 15;
      }
      if (player.activeBuffs?.greaseImmunity && player.activeBuffs.greaseImmunity > 0) {
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText(`🛡️ GREASE IMMUNITY (${Math.ceil(player.activeBuffs.greaseImmunity / 60)}s)`, hudX + 380, hudY + 85 + buffOffset);
        buffOffset += 15;
      }
      ctx.textAlign = 'left';

      ctx.restore();

      // Film Grain Effect (Canvas)
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = Math.random() * CANVAS_HEIGHT;
        const size = Math.random() * 2;
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore();

      // Controls hint at bottom
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
      ctx.fillStyle = '#666';
      ctx.font = '11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('WASD: MOVE | F/J: STRIKE | K/L: BLASTER | SPACE: JUMP | E: THROW SALT', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
      ctx.restore();
      
      // Death Cam Overlay
      if (player.isDead) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Vignette
        const vignette = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 1.5);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Death Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px "Courier New"';
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 20;
        ctx.fillText('MISSION FAILED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
        
        ctx.font = 'bold 24px "Courier New"';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(player.deathCause || 'UNKNOWN FATALITY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
        
        // Glitch effect
        if (Math.random() > 0.8) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(0, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, 2);
        }
        
        ctx.restore();
      }

      if (gameState.levelTransitionTimer !== undefined && gameState.levelTransitionTimer > 0) {
        const opacity = gameState.levelTransitionTimer / 60;
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - opacity})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      ctx.restore(); // Restore from screen shake
    };

    render();
  }, [gameState, playerImageLoaded, selectedCharacter]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full border-4 border-zinc-800 shadow-2xl rounded-lg bg-black cursor-none object-contain"
      />
      
      {gameState?.status === 'playing' && !gameState.isPaused && (
        <button
          onClick={() => setGameState(prev => prev ? { ...prev, isPaused: true } : null)}
          className="absolute top-4 right-4 z-40 p-2 bg-zinc-900/80 border-2 border-zinc-700 text-zinc-300 rounded hover:bg-zinc-800 hover:text-white transition-colors shadow-lg"
          title="Pause Game"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      )}

      {gameState?.isPaused && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center z-50 backdrop-blur-sm rounded-lg">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            PAUSED
          </h2>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button
              onClick={() => setGameState(prev => prev ? { ...prev, isPaused: false } : null)}
              className="px-8 py-4 bg-yellow-500 text-black font-bold text-xl rounded hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)]"
            >
              RESUME
            </button>
            <button
              onClick={onMenu}
              className="px-8 py-4 bg-zinc-800 text-white font-bold text-xl rounded hover:bg-zinc-700 transition-colors border-2 border-zinc-700"
            >
              MAIN MENU
            </button>
            <button
              onClick={() => {
                // In a real app this might close the window or exit, but here we can just go to menu or reload
                window.location.reload();
              }}
              className="px-8 py-4 bg-red-600 text-white font-bold text-xl rounded hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            >
              QUIT
            </button>
          </div>
        </div>
      )}

      {isTouchDevice && gameState?.status === 'playing' && !gameState.isPaused && (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-end pb-6 px-2 sm:pb-8 sm:px-6">
          <div className="flex justify-between w-full">
            {/* Left side: Movement */}
            <div className="flex gap-2 sm:gap-4 pointer-events-auto items-end">
              <button
                onPointerDown={handlePointerDown('KeyA')}
                onPointerUp={handlePointerUp('KeyA')}
                onPointerLeave={handlePointerUp('KeyA')}
                onPointerCancel={handlePointerUp('KeyA')}
                onContextMenu={(e) => e.preventDefault()}
                className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                style={{ touchAction: 'none' }}
              >
                <MoveLeft className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
              <button
                onPointerDown={handlePointerDown('KeyD')}
                onPointerUp={handlePointerUp('KeyD')}
                onPointerLeave={handlePointerUp('KeyD')}
                onPointerCancel={handlePointerUp('KeyD')}
                onContextMenu={(e) => e.preventDefault()}
                className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                style={{ touchAction: 'none' }}
              >
                <MoveRight className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            </div>

            {/* Right side: Actions */}
            <div className="flex flex-col gap-2 sm:gap-4 items-end pointer-events-auto">
              <div className="flex gap-2 sm:gap-4">
                <button
                  onPointerDown={handlePointerDown('KeyE')}
                  onPointerUp={handlePointerUp('KeyE')}
                  onPointerLeave={handlePointerUp('KeyE')}
                  onPointerCancel={handlePointerUp('KeyE')}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                  style={{ touchAction: 'none' }}
                >
                  <span className="text-[10px] sm:text-xs font-bold">SALT</span>
                </button>
                <button
                  onPointerDown={handlePointerDown('KeyK')}
                  onPointerUp={handlePointerUp('KeyK')}
                  onPointerLeave={handlePointerUp('KeyK')}
                  onPointerCancel={handlePointerUp('KeyK')}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                  style={{ touchAction: 'none' }}
                >
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="flex gap-2 sm:gap-4">
                <button
                  onPointerDown={handlePointerDown('KeyF')}
                  onPointerUp={handlePointerUp('KeyF')}
                  onPointerLeave={handlePointerUp('KeyF')}
                  onPointerCancel={handlePointerUp('KeyF')}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                  style={{ touchAction: 'none' }}
                >
                  <Swords className="w-6 h-6 sm:w-8 sm:h-8" />
                </button>
                <button
                  onPointerDown={handlePointerDown('Space')}
                  onPointerUp={handlePointerUp('Space')}
                  onPointerLeave={handlePointerUp('Space')}
                  onPointerCancel={handlePointerUp('Space')}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/50 border-2 border-zinc-600 rounded-full flex items-center justify-center active:bg-zinc-700/80 text-white select-none backdrop-blur-sm"
                  style={{ touchAction: 'none' }}
                >
                  <ArrowUp className="w-6 h-6 sm:w-8 sm:h-8" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState?.status === 'level1-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-yellow-500 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(241,196,15,0.5)]">
            LEVEL 1: HONEY MUSTARD WATERS
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "The outer perimeter is heavily guarded. The Fry Monsters are patrolling the mustard pools. Infiltrate the facility and rescue our brothers."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-yellow-500 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(241,196,15,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/50"></div>
            <h3 className="text-2xl font-bold text-yellow-400 mb-2 font-mono">THREAT DETECTED: FRY MONSTERS</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Patrolling units with high-speed movement. They are territorial and will attack on sight. Watch out for the security spotlights—they'll drain your health if you're caught in the beam!
            </p>
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 bg-[#e67e22] rounded-sm border-2 border-[#a04000]" />
                <div className="absolute top-2 left-2 w-4 h-4 bg-white rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" /></div>
                <div className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" /></div>
                <div className="absolute bottom-3 left-3 right-3 h-2 bg-black rounded-full" />
              </div>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => prev ? { ...prev, status: 'playing' } : null)}
            className="px-8 py-4 bg-yellow-500 text-black font-bold text-xl rounded hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            START MISSION
          </button>
        </div>
      )}

      {gameState?.status === 'level2-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-yellow-500 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            LEVEL 2: THE PREP STATION
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "Excellent work, Crispy Nugget. You've cleared the first sector. But the grease thickens... You've entered the Prep Station, where the Dill Slicers patrol."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-green-500 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(46,204,113,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50"></div>
            <h3 className="text-2xl text-green-400 font-bold mb-2 font-mono tracking-wider">NEW THREAT DETECTED</h3>
            <p className="text-zinc-400 font-mono text-sm mb-6 uppercase tracking-widest">Subject: The Evil Pickle</p>
            
            <div className="flex justify-center mb-6">
              <div className="relative w-24 h-24 animate-bounce">
                {/* Pickle Body */}
                <div className="absolute inset-0 bg-green-500 rounded-full border-4 border-green-700 shadow-[0_0_20px_rgba(46,204,113,0.6)] flex items-center justify-center overflow-hidden">
                  {/* Ridges */}
                  <div className="absolute w-full h-1 bg-green-600/50 top-4"></div>
                  <div className="absolute w-full h-1 bg-green-600/50 top-10"></div>
                  <div className="absolute w-full h-1 bg-green-600/50 top-16"></div>
                  
                  {/* Seeds */}
                  <div className="w-2 h-2 bg-green-800 rounded-full absolute top-4 left-4"></div>
                  <div className="w-2 h-2 bg-green-800 rounded-full absolute bottom-6 right-6"></div>
                  <div className="w-2 h-2 bg-green-800 rounded-full absolute top-8 right-4"></div>
                  <div className="w-2 h-2 bg-green-800 rounded-full absolute bottom-8 left-8"></div>
                  
                  {/* Angry Eye */}
                  <div className="w-6 h-6 bg-white rounded-full absolute top-6 left-8 flex items-center justify-center shadow-inner">
                    <div className="w-3 h-3 bg-black rounded-full"></div>
                    {/* Angry Eyebrow */}
                    <div className="absolute -top-2 -left-1 w-8 h-2 bg-green-800 transform rotate-12"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-zinc-300 font-mono text-sm leading-relaxed">
              These briny bastards roll at high speeds and spray acidic juice when destroyed. Keep your distance and use your blaster!
            </p>
          </div>
          
          <button 
            onClick={() => setGameState(prev => prev ? { ...prev, status: 'playing' } : null)}
            className="px-8 py-4 bg-yellow-500 text-black font-bold text-xl rounded hover:bg-yellow-400 transition-all hover:scale-105 font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            START LEVEL 2
          </button>
        </div>
      )}

      {gameState?.status === 'level3-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-red-500 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(231,76,60,0.5)]">
            LEVEL 3: THE CONDIMENT AISLE
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "You survived the Prep Station. Now, face the wrath of the Tomato Syndicate in the Condiment Aisle. They've set up barricades and are lobbing acidic projectiles."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-red-500 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(231,76,60,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
            <h3 className="text-2xl font-bold text-red-400 mb-2 font-mono">NEW THREAT: TOMATO THROWERS</h3>
            <p className="text-zinc-400 text-sm mb-4">
              These stationary sentinels lob baby tomato slices at you. Keep moving to avoid their acidic barrage!
            </p>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-600 rounded-full border-4 border-red-800 flex items-center justify-center relative">
                <div className="w-8 h-8 bg-red-400 rounded-full opacity-50 absolute top-2 left-2"></div>
                <div className="w-4 h-4 bg-green-600 rounded-full absolute -top-2"></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => prev ? { ...prev, status: 'playing' } : null)}
            className="px-8 py-4 bg-yellow-500 text-black font-bold text-xl rounded hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            START LEVEL 3
          </button>
        </div>
      )}

      {gameState?.status === 'level4-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-yellow-100 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(245,245,220,0.5)]">
            LEVEL 4: THE MAYO MONSTER
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "The Walk-In Fridge. Cold storage for the Sauce Syndicate's darkest secrets. Here lurks 'The Emulsion'—a grotesque enforcer born from a botched, expired batch of heavy mayo. It doesn't just guard the captured nuggets; it absorbs them."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-yellow-100 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(245,245,220,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-100/50"></div>
            <h3 className="text-2xl font-bold text-yellow-200 mb-2 font-mono">BOSS: THE EMULSION (MAYO MONSTER)</h3>
            <p className="text-zinc-400 text-sm mb-4">
              A slow, relentless mob enforcer made of corrupted mayonnaise. It leaves a suffocating, sticky trail to trap its victims and hurls heavy globs of congealed fat. Stay out of the puddles, or you'll be sleeping with the fishes.
            </p>
            <div className="flex justify-center mb-6">
              <div className="w-24 h-16 bg-[#f5f5dc] rounded-full border-4 border-[#dcdcdc] flex items-center justify-center relative overflow-hidden">
                <div className="w-4 h-4 bg-black rounded-full absolute top-4 left-4"></div>
                <div className="w-4 h-4 bg-black rounded-full absolute top-4 right-4"></div>
                <div className="w-12 h-6 bg-red-900 rounded-full absolute bottom-2"></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => prev ? { ...prev, status: 'playing', bossIntroTimer: 240 } : null)}
            className="px-8 py-4 bg-yellow-500 text-black font-bold text-xl rounded hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            START LEVEL 4
          </button>
        </div>
      )}

      {gameState?.status === 'level5-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-red-500 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            LEVEL 5: THE HOT SAUCE BOTTLE
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "The heart of the Sauce Syndicate. A towering glass fortress of concentrated capsaicin. The air burns your lungs, and the floor is slick with liquid fire. This is where the Don resides, orchestrating the condiment underworld."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-red-500 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
            <h3 className="text-2xl font-bold text-red-400 mb-2 font-mono">ENVIRONMENT: EXTREME HEAT</h3>
            <p className="text-zinc-400 text-sm mb-4">
              The very environment is hostile. Puddles of scorching hot sauce act as deadly hazards. The enemies here are seasoned veterans, infused with spicy rage.
            </p>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-24 bg-red-600 rounded-t-full border-4 border-red-800 flex flex-col items-center justify-start relative overflow-hidden">
                <div className="w-6 h-6 bg-green-600 rounded-t-sm absolute top-0"></div>
                <div className="w-full h-2 bg-red-800 mt-6"></div>
                <div className="text-xs font-bold text-white mt-4">XXX</div>
              </div>
            </div>
            <div className="text-left text-xs text-zinc-500 space-y-1">
              <p>• Avoid the hot sauce puddles at all costs.</p>
              <p>• Enemies are faster and hit harder.</p>
              <p>• Find the Super Mustard to survive.</p>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => prev ? { ...prev, status: 'playing', bossIntroTimer: 240 } : null)}
            className="px-8 py-4 bg-red-600 text-white font-bold text-xl rounded hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
          >
            ENTER THE BOTTLE
          </button>
        </div>
      )}

      {gameState?.status === 'level6-intro' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 rounded-lg backdrop-blur-sm">
          <h2 className="text-4xl md:text-6xl font-bold text-orange-500 mb-4 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(211,84,0,0.5)]">
            LEVEL 6: THE PHANTOM BUNS
          </h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl font-mono italic">
            "The Sauce Syndicate's final line of defense. These genetically modified buns possess active camouflage, rendering them nearly invisible to the naked eye. Trust your instincts, and let the Lettuce Stars guide your aim."
          </p>
          
          <div className="bg-zinc-900/80 border-2 border-orange-500 p-6 rounded-lg mb-8 max-w-md w-full relative overflow-hidden shadow-[0_0_30px_rgba(211,84,0,0.2)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/50"></div>
            <h3 className="text-2xl font-bold text-orange-400 mb-2 font-mono">NEW WEAPON: LETTUCE STARS</h3>
            <p className="text-zinc-400 text-sm mb-4">
              You have been granted unlimited Lettuce Stars! Use them to reveal and destroy the invisible Phantom Buns.
            </p>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(46,204,113,0.8)]">
                <span className="text-3xl">🥬</span>
              </div>
            </div>
            <div className="text-left text-xs text-zinc-500 space-y-1">
              <p>• Lettuce Stars deal massive damage to Phantom Buns.</p>
              <p>• You have an unlimited supply.</p>
              <p>• Press K or L to throw them.</p>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => prev ? { 
              ...prev, 
              status: 'playing', 
              bossIntroTimer: 240,
              floatingTexts: [
                ...prev.floatingTexts,
                { x: prev.player.x, y: prev.player.y - 50, text: 'UPGRADED TO LETTUCE STAR GUN!', life: 180, maxLife: 180, color: '#2ecc71', fontSize: 24 }
              ]
            } : null)}
            className="px-8 py-4 bg-orange-600 text-white font-bold text-xl rounded hover:bg-orange-500 transition-colors shadow-[0_0_20px_rgba(211,84,0,0.4)]"
          >
            FACE THE PHANTOM BUNS
          </button>
        </div>
      )}
    </div>
  );
};

export default Game;
