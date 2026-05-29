import React from 'react';
import { motion } from 'motion/react';
import { CharacterType } from '../types';
import { useVinylCrackle } from './UI';
import { characterData } from '../data/characterData';
import Image from './Image';

export interface CharacterRosterItem {
  id: CharacterType;
  name: string;
  tagline: string;
  desc: string;
  imageSrc: string;
}

export const ROSTER_DATA: CharacterRosterItem[] = (Object.keys(characterData) as CharacterType[]).map(key => ({
  id: key,
  name: characterData[key].name,
  tagline: characterData[key].tagline,
  desc: characterData[key].description,
  imageSrc: characterData[key].imageSrc
}));


export const CharacterSelectScreen: React.FC<{
  currentSelection: CharacterType;
  onSelect: (id: CharacterType) => void;
  onConfirm: () => void;
  onBack: () => void;
}> = ({ currentSelection, onSelect, onConfirm, onBack }) => {
  
  // Apply our custom retro hooks and effects optionally if we want them standard to the UI
  // useVinylCrackle();

  const selectedData = ROSTER_DATA.find(c => c.id === currentSelection) || ROSTER_DATA[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-full text-white p-4 md:p-8 bg-zinc-950 relative overflow-y-auto"
    >
      <div className="film-grain" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,85,0,0.1),transparent_70%)]" />
      
      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left Column - Roster List */}
        <div className="md:col-span-7 flex flex-col space-y-4">
          <h1 className="text-3xl md:text-5xl font-black text-orange-500 italic tracking-tighter drop-shadow-lg neon-flicker uppercase">
            Select Operative
          </h1>
          <p className="text-zinc-400 font-mono text-xs uppercase mb-4 tracking-widest pb-4 border-b border-zinc-800">
            Awaiting Deployment Parameter
          </p>

          <div className="space-y-3">
            {ROSTER_DATA.map((char) => {
              const isActive = currentSelection === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => onSelect(char.id)}
                  className={`w-full text-left p-4 md:p-6 border-l-4 transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
                    isActive 
                      ? 'border-orange-500 bg-orange-500/10 shadow-[inset_0_0_20px_rgba(255,85,0,0.1)]' 
                      : 'border-zinc-800 bg-black/40 hover:bg-black/60 hover:border-zinc-600'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="activeSelectionBg"
                      className="absolute inset-0 bg-orange-500/5 z-0" 
                    />
                  )}
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                    <div>
                      <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${isActive ? 'text-orange-400' : 'text-zinc-300'}`}>
                        {char.name}
                      </h2>
                      <p className={`font-mono text-[10px] md:text-xs uppercase tracking-wider mt-1 ${isActive ? 'text-orange-500/80' : 'text-zinc-500'}`}>
                        {char.tagline}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column - Visual Preview */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="w-full formica-texture p-1 shadow-2xl relative border border-orange-500/30">
            <div className="bg-black/80 backdrop-blur-xl border border-zinc-900 p-6 flex flex-col items-center">
              
              {/* Target Brackets */}
              <div className="absolute top-2 left-2 border-t-2 border-l-2 border-orange-500/50 w-6 h-6" />
              <div className="absolute top-2 right-2 border-t-2 border-r-2 border-orange-500/50 w-6 h-6" />
              <div className="absolute bottom-2 left-2 border-b-2 border-l-2 border-orange-500/50 w-6 h-6" />
              <div className="absolute bottom-2 right-2 border-b-2 border-r-2 border-orange-500/50 w-6 h-6" />

              <div className="w-48 h-48 md:w-64 md:h-64 mb-6 relative flex items-center justify-center bg-[radial-gradient(circle_at_50%_50%,rgba(255,85,0,0.15),transparent_60%)] rounded-full border border-orange-500/20 shadow-[0_0_15px_rgba(255,85,0,0.1)]">
                <Image 
                  src={selectedData.imageSrc} 
                  alt={selectedData.name} 
                  className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,85,0,0.5)] transition-all duration-300 transform hover:scale-105" 
                />
              </div>

              <div className="text-center w-full">
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">
                  {selectedData.name}
                </h3>
                <p className="text-sm font-mono text-orange-400 mb-4 h-6">
                  {selectedData.tagline}
                </p>
                
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 text-left">
                  <p className="text-xs font-mono text-zinc-300 leading-relaxed h-16 md:h-20">
                    <span className="text-orange-500">{'>'} LOG: </span>
                    {selectedData.desc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex gap-4 mt-8">
            <button 
              onClick={onBack}
              className="flex-1 py-4 border border-zinc-700 hover:border-zinc-500 bg-black/50 hover:bg-black text-zinc-400 hover:text-white font-mono text-sm uppercase tracking-widest transition-colors duration-200"
            >
              Abort
            </button>
            <button 
              onClick={onConfirm}
              className="flex-[2] py-4 border-2 border-orange-500 bg-orange-600 hover:bg-orange-500 text-white font-black text-lg italic uppercase tracking-widest shadow-[0_0_15px_rgba(255,85,0,0.5)] transition-all duration-200 active:scale-95"
            >
              Deploy
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
