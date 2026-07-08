import React from 'react';
import { SoundPosition } from '../types';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, Keyboard, Sliders, ChevronUp, ChevronDown } from 'lucide-react';

interface DPadAndElevationProps {
  position: SoundPosition;
  onChangePosition: (pos: SoundPosition) => void;
}

export const DPadAndElevation: React.FC<DPadAndElevationProps> = ({
  position,
  onChangePosition,
}) => {
  const handleStep = (axis: 'x' | 'y' | 'z', dir: number) => {
    const step = 0.5;
    const nextVal = position[axis] + dir * step;
    const clamped = Math.max(-5, Math.min(5, nextVal));

    onChangePosition({
      ...position,
      [axis]: parseFloat(clamped.toFixed(1)),
    });
  };

  const handleReset = () => {
    onChangePosition({ x: 0, y: 0, z: 0 });
  };

  const handleElevationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChangePosition({
      ...position,
      y: val,
    });
  };

  return (
    <div id="dpad-elevation-card" className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-3xl border border-slate-200/40 dark:border-white/10 p-5 shadow-xl transition-all duration-300">
      
      {/* Directional D-Pad Section */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Keyboard className="w-4 h-4" />
          </div>
          <h3 className="font-display font-semibold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Contrôle par D-Pad Tactile
          </h3>
        </div>

        <div className="flex items-center gap-6 flex-grow">
          {/* Classic Console D-Pad Grid */}
          <div className="grid grid-cols-3 gap-2 w-32 h-32 p-1.5 bg-slate-200/40 dark:bg-black/35 rounded-2xl border border-slate-300/20 dark:border-white/5 shadow-inner shrink-0">
            <div />
            <button
              id="dpad-up"
              onClick={() => handleStep('z', 1)}
              aria-label="Avancer"
              className="flex items-center justify-center bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-95 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm transition-all cursor-pointer"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            <div />

            <button
              id="dpad-left"
              onClick={() => handleStep('x', -1)}
              aria-label="Aller à gauche"
              className="flex items-center justify-center bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-95 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              id="dpad-rst"
              onClick={handleReset}
              aria-label="Réinitialiser"
              className="flex items-center justify-center bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl border border-sky-500/20 transition-all cursor-pointer"
            >
              RST
            </button>
            <button
              id="dpad-right"
              onClick={() => handleStep('x', 1)}
              aria-label="Aller à droite"
              className="flex items-center justify-center bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-95 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm transition-all cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <div />
            <button
              id="dpad-down"
              onClick={() => handleStep('z', -1)}
              aria-label="Reculer"
              className="flex items-center justify-center bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-95 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm transition-all cursor-pointer"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <div />
          </div>

          {/* Key Hints */}
          <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-300">💡 Clavier Physique connecté !</p>
            <p>Utilisez les touches <strong className="text-sky-600 dark:text-sky-400">fléchées (↑, ↓, ←, →)</strong> de votre clavier pour piloter le son en temps réel.</p>
            <p>Appuyez sur <strong className="text-slate-600 dark:text-slate-400 font-mono">Espace</strong> pour démarrer/arrêter.</p>
          </div>
        </div>
      </div>

      {/* Elevation Control Section */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="font-display font-semibold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Hauteur (Élévation 3D)
            </h3>
          </div>
          
          <div className="font-mono text-xs text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/15 px-2 py-0.5 rounded border border-teal-500/20">
            Y: {position.y >= 0 ? '+' : ''}{position.y.toFixed(1)}
          </div>
        </div>

        <div className="flex flex-col gap-4 justify-center flex-grow">
          {/* Elevation Slider with labels */}
          <div className="flex items-center gap-3">
            <button
              id="elevation-down"
              onClick={() => handleStep('y', -1)}
              aria-label="Baisser l'élévation"
              className="p-1.5 bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            
            <div className="flex-grow flex flex-col gap-1.5">
              <input
                id="elevation-slider"
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={position.y}
                onChange={handleElevationChange}
                className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <span>BAS (-5m)</span>
                <span>OREILLE (0m)</span>
                <span>HAUT (+5m)</span>
              </div>
            </div>

            <button
              id="elevation-up"
              onClick={() => handleStep('y', 1)}
              aria-label="Hausser l'élévation"
              className="p-1.5 bg-white/60 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 bg-teal-500/10 dark:bg-teal-500/5 rounded-xl border border-teal-500/20 text-xs text-teal-700 dark:text-teal-300/90 leading-relaxed font-sans">
            <p>
              <strong>Qu'est-ce que l'Élévation ?</strong> En audio spatialisé, modifier la hauteur (axe Y) altère la perception d'élévation. Le modèle <strong>HRTF</strong> simule cela en reproduisant les filtres acoustiques naturels créés par votre pavillon de l'oreille !
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
