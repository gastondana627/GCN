/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Game from './components/Game';
import { LandingScreen, StartScreen, GameOverScreen, WinScreen, LevelSelectScreen } from './components/UI';
import { CharacterSelectScreen } from './components/CharacterSelectScreen';

import ErrorBoundary from './ErrorBoundary';
import { UserProfile, CharacterType } from './types';

const defaultProfile: UserProfile = {
  selectedCharacter: 'classic_og',
  unlockedLevels: [true, false, false, false, false, false],
};

const ADJECTIVES = [
  'CRISPY', 'SOGGY', 'SPICY', 'CUDDLY', 'TOASTED', 'BURNT', 'GLAZED',
  'PICKLED', 'SWEET', 'SOUR', 'SMASHED', 'LOADED', 'CHEESY', 'TRUFFLE',
  'AVOCADO', 'SALTY', 'GOLDEN', 'FRIED', 'BAKED', 'MELTED', 'ZESTY',
  'CHILLED', 'FROSTED', 'GRILLED', 'CHARRED', 'PEPPERY', 'SAUCY',
  'AVOCADO TOASTED', 'DOUBLE FRIED', 'DEEP FRIED', 'EXTRA CRISPY'
];

const NOUNS = [
  'CHICKEN NUGGET', 'SEA SALT', 'FRENCH FRY', 'SUNDAE', 'VEGGIE PATTY',
  'ONION RING', 'MILKSHAKE', 'HASHBROWN', 'WAFFLE', 'PANCAKE',
  'PICKLE SPEAR', 'BURGER', 'TATER TOT', 'HOT DOG', 'BACON STRIP', 'SLIDER',
  'CHURRO', 'PRETZEL', 'DONUT', 'CORN DOG', 'MOZZARELLA STICK',
  'MAC N CHEESE', 'CHICKEN TENDER'
];

export const generateDinerName = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj} ${noun} ${num}`;
};

export default function App() {
  const [status, setStatus] = useState<'landing' | 'start' | 'playing' | 'gameover' | 'win' | 'level-select' | 'character-select'>('landing');
  const [score, setScore] = useState(0);
  const [timePlayed, setTimePlayed] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [hasBeatenGame, setHasBeatenGame] = useState(false);
  const [startingLevel, setStartingLevel] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);

  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('nugget-noir-profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }

      const savedLeaderboard = localStorage.getItem('nugget-noir-leaderboard');
      if (savedLeaderboard) {
        setLeaderboard(JSON.parse(savedLeaderboard));
      }
      const savedName = localStorage.getItem('nugget-noir-playername');
      if (savedName && !savedName.toUpperCase().includes('OPERATIVE')) {
        setPlayerName(savedName);
      }
      const beaten = localStorage.getItem('nugget-noir-beaten');
      if (beaten === 'true') {
        setHasBeatenGame(true);
      }
    } catch (e) {
      console.warn('localStorage not available', e);
    }
  }, []);

  const saveScore = (finalScore: number) => {
    const nameToSave = playerName.trim() || generateDinerName();
    const newEntry = { name: nameToSave, score: finalScore };
    const newLeaderboard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setLeaderboard(newLeaderboard);
    try {
      localStorage.setItem('nugget-noir-leaderboard', JSON.stringify(newLeaderboard));
      localStorage.setItem('nugget-noir-playername', nameToSave);
    } catch (e) {}
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    saveScore(finalScore);
    setStatus('gameover');
  };

  const handleWin = (finalScore: number, timeElapsed: number) => {
    setScore(finalScore);
    setTimePlayed(timeElapsed);
    saveScore(finalScore);
    setHasBeatenGame(true);
    try {
      localStorage.setItem('nugget-noir-beaten', 'true');
    } catch (e) {}
    setStatus('win');
  };

  const handleStart = (levelIndex: number = 0) => {
    const finalName = playerName.trim() || generateDinerName();
    setPlayerName(finalName);
    try {
      localStorage.setItem('nugget-noir-playername', finalName);
    } catch (e) {}
    setStartingLevel(levelIndex);
    setStatus('playing');
  };

  const handleLevelComplete = (completedLevelIndex: number) => {
    setProfile(prev => {
      const newUnlocked = [...prev.unlockedLevels];
      if (completedLevelIndex + 1 < newUnlocked.length) {
        newUnlocked[completedLevelIndex + 1] = true;
      }
      const newProfile = { ...prev, unlockedLevels: newUnlocked };
      try {
        localStorage.setItem('nugget-noir-profile', JSON.stringify(newProfile));
      } catch (e) {}
      return newProfile;
    });
  };

  const handleCharacterSelect = (charType: CharacterType) => {
    setProfile(prev => {
      const newProfile = { ...prev, selectedCharacter: charType };
      try {
        localStorage.setItem('nugget-noir-profile', JSON.stringify(newProfile));
      } catch (e) {}
      return newProfile;
    });
  };

  const handleMenu = () => {
    setStatus('start');
  };

  const handleGoToCharacterSelect = () => {
    setStatus('character-select');
  };

  const handleLevelSelect = () => {
    setStatus('level-select');
  };

  const handleEnterDiner = () => {
    setStatus('start');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-2 md:p-4 font-sans selection:bg-yellow-500 selection:text-black">
        <div className="relative w-full max-w-[1200px] h-[calc(100dvh-16px)] md:h-[calc(100dvh-32px)] lg:h-[800px] flex flex-col rounded-xl border-4 md:border-8 border-zinc-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-zinc-900/20 overflow-hidden">
        <div className="flex-grow relative overflow-y-auto rounded-lg">
          {status === 'landing' && (
            <LandingScreen onEnter={handleEnterDiner} />
          )}

          {status === 'character-select' && (
            <CharacterSelectScreen 
              currentSelection={profile.selectedCharacter}
              onSelect={handleCharacterSelect}
              onConfirm={() => setStatus('start')}
              onBack={() => setStatus('start')}
            />
          )}

          {status === 'start' && (
            <StartScreen 
              status={status} 
              score={score} 
              onStart={() => handleStart(0)} 
              onLevelSelect={handleLevelSelect}
              hasBeatenGame={hasBeatenGame}
              leaderboard={leaderboard} 
              playerName={playerName}
              setPlayerName={setPlayerName}
              selectedCharacter={profile.selectedCharacter}
              onSelectCharacter={handleGoToCharacterSelect}
            />
          )}
          
          {status === 'level-select' && (
            <LevelSelectScreen onSelectLevel={handleStart} onMenu={handleMenu} unlockedLevels={profile.unlockedLevels} />
          )}
          
          {status === 'playing' && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <Game onGameOver={handleGameOver} onWin={handleWin} onMenu={handleMenu} startingLevelIndex={startingLevel} selectedCharacter={profile.selectedCharacter} onLevelComplete={handleLevelComplete} />
            </div>
          )}

          {status === 'gameover' && (
            <GameOverScreen status={status} score={score} onStart={() => handleStart(0)} onMenu={handleMenu} leaderboard={leaderboard} />
          )}

          {status === 'win' && (
            <WinScreen 
              status={status} 
              score={score} 
              onStart={() => handleStart(0)} 
              onMenu={handleMenu} 
              leaderboard={leaderboard}
              playerName={playerName}
              timePlayed={timePlayed}
            />
          )}
        </div>
        
        {/* Decorative scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] rounded-lg" />
      </div>
    </div>
    </ErrorBoundary>
  );
}

