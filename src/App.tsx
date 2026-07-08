import { useState, useEffect, useRef } from 'react';
import { SoundPosition, SoundType, TrajectoryType } from './types';
import { AudioEngine } from './audioEngine';
import { AcousticScene } from './components/AcousticScene';
import { AudioControls } from './components/AudioControls';
import { Sun, Moon, Info, HelpCircle, Disc, Headphones, VolumeX, Volume2, ShieldCheck } from 'lucide-react';

export default function App() {
  // Theme state (default dark mode since audio software matches dark aesthetics perfectly)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('spatial_audio_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  // Audio configuration states
  const [position, setPosition] = useState<SoundPosition>({ x: 0, y: 0, z: 0 });
  const [volume, setVolume] = useState<number>(0.6);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeSound, setActiveSound] = useState<SoundType>('organic_rain');

  // Autopilot configurations
  const [isAutopilot, setIsAutopilot] = useState<boolean>(true);
  const [activeTrajectory, setActiveTrajectory] = useState<TrajectoryType>('left_right');
  const [orbitSpeed, setOrbitSpeed] = useState<number>(1.8);

  // Info modal state
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);

  // Audio Engine persistent reference
  const audioEngineRef = useRef<AudioEngine | null>(null);

  // Theta reference for continuous orbit calculations
  const thetaRef = useRef<number>(0);
  const requestRef = useRef<number | null>(null);

  // Initialize AudioEngine on first render (lazy loaded internally)
  if (!audioEngineRef.current) {
    audioEngineRef.current = new AudioEngine();
  }
  const audioEngine = audioEngineRef.current;

  // Toggle theme helper
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('spatial_audio_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Sync state variables directly with audioEngine
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume, audioEngine]);

  useEffect(() => {
    audioEngine.updatePosition(position);
  }, [position, audioEngine]);

  // Sync isPlaying and sound selector
  useEffect(() => {
    if (isPlaying) {
      audioEngine.start(activeSound);
    } else {
      audioEngine.stop();
    }
    // Cleanup on unmount
    return () => {
      audioEngine.stop();
    };
  }, [isPlaying, activeSound, audioEngine]);

  // Physical Keyboard Arrow Keys and Space bar bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); // Prevent page scrolling
        
        // Disable autopilot if user manually takes over coordinates via keyboard
        setIsAutopilot(false);

        const step = 0.5;
        let dx = 0;
        let dz = 0;

        if (e.key === 'ArrowUp') dz = 1;
        if (e.key === 'ArrowDown') dz = -1;
        if (e.key === 'ArrowLeft') dx = -1;
        if (e.key === 'ArrowRight') dx = 1;

        setPosition((prev) => {
          const nextX = Math.max(-5, Math.min(5, prev.x + dx * step));
          const nextZ = Math.max(-5, Math.min(5, prev.z + dz * step));
          return {
            ...prev,
            x: parseFloat(nextX.toFixed(1)),
            z: parseFloat(nextZ.toFixed(1)),
          };
        });
      }

      // Space bar toggles playback
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autopilot loop: continuous calculation of trajectories
  useEffect(() => {
    const animate = () => {
      if (!isAutopilot || !isPlaying) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Increment rotation angle based on customizable orbit speed
      // Constant rate scaled by speed coefficient
      const delta = 0.015 * orbitSpeed;
      thetaRef.current += delta;

      setPosition((prev) => {
        let nextX = prev.x;
        let nextY = prev.y;
        let nextZ = prev.z;

        const R = 4.0; // Radius coefficient

        switch (activeTrajectory) {
          case 'circle':
            // 360 degree circle
            nextX = R * Math.sin(thetaRef.current);
            nextZ = R * Math.cos(thetaRef.current);
            // Height Y remains controlled by manual elevation or current state
            break;

          case 'infinity': {
            // Lemniscate of Bernoulli (figure 8 curve)
            const sinT = Math.sin(thetaRef.current);
            const cosT = Math.cos(thetaRef.current);
            const denom = 1 + sinT * sinT;
            nextX = (R * 1.1) * cosT / denom;
            nextZ = (R * 1.1) * sinT * cosT / denom;
            break;
          }

          case 'up_down':
            // Pure vertical oscillation on Y axis, centered on the listener
            nextX = 0;
            nextZ = 0; // Centered
            nextY = 4.8 * Math.sin(thetaRef.current);
            break;

          case 'left_right':
            // Back-and-forth linear movement on X axis, centered on the listener
            nextX = R * Math.sin(thetaRef.current);
            nextZ = 0; // Centered
            // Height Y remains at its manual elevation value (prev.y)
            break;
        }

        return {
          x: parseFloat(nextX.toFixed(3)),
          y: parseFloat(nextY.toFixed(3)),
          z: parseFloat(nextZ.toFixed(3)),
        };
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isAutopilot, isPlaying, activeTrajectory, orbitSpeed]);

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 relative overflow-hidden ${
      isDarkMode 
        ? 'dark bg-[#050608] text-slate-100' 
        : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Decorative Blur Orbs for Frosted Glass Theme */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-sky-500/15 dark:bg-blue-900/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-50px] right-[-50px] w-[450px] h-[450px] bg-indigo-500/15 dark:bg-indigo-900/15 rounded-full blur-[110px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-150px] w-[300px] h-[300px] bg-purple-500/10 dark:bg-purple-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Top Banner / Header Bar */}
      <header className="border-b border-slate-200/40 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] flex items-center justify-center">
              <Headphones className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-slate-950 via-sky-600 to-indigo-600 dark:from-white dark:via-sky-400 dark:to-indigo-300 bg-clip-text text-transparent">
                Spatial Audio Compass
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                Simulateur Binaural 3D • HRTF de Haute Fidélité
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            
            {/* Documentation Trigger Button */}
            <button
              id="info-modal-trigger"
              onClick={() => setIsInfoOpen(true)}
              title="Comment ça marche ?"
              className="p-2.5 rounded-xl hover:bg-slate-200/40 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer border border-transparent dark:hover:border-white/5"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Premium Dark/Light mode switch button */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
              className="p-2.5 rounded-xl hover:bg-slate-200/40 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer border border-transparent dark:hover:border-white/5"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Audio Playback, Wave Signal, Autopilot */}
          <div className="lg:col-span-5">
            <AudioControls
              volume={volume}
              onChangeVolume={setVolume}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((prev) => !prev)}
              activeSound={activeSound}
              onChangeSound={setActiveSound}
              isAutopilot={isAutopilot}
              onToggleAutopilot={() => setIsAutopilot((prev) => !prev)}
              activeTrajectory={activeTrajectory}
              onChangeTrajectory={setActiveTrajectory}
              orbitSpeed={orbitSpeed}
              onChangeOrbitSpeed={setOrbitSpeed}
            />
          </div>

          {/* Right Column: Sonar view */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <AcousticScene
              position={position}
              onChangePosition={setPosition}
              audioEngine={audioEngine}
              isPlaying={isPlaying}
              isDarkMode={isDarkMode}
            />
          </div>

        </div>
      </main>

      {/* Professional Footer Bar */}
      <footer className="border-t border-slate-200/40 dark:border-white/10 bg-white/20 dark:bg-white/2 backdrop-blur-md py-6 mt-8 transition-colors duration-300 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} <strong>Spatial Audio Compass</strong> — Interface utilisateur modernisée.
          </p>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase bg-slate-200/30 dark:bg-white/5 px-3 py-1 rounded-full border border-slate-300/20 dark:border-white/5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Sécurisé : traitement audio 100% local</span>
          </div>
        </div>
      </footer>

      {/* Info / Explanation Overlay Modal */}
      {isInfoOpen && (
        <div 
          id="info-modal-backdrop"
          onClick={() => setIsInfoOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            id="info-modal-content"
            onClick={(e) => e.stopPropagation()}
            className="bg-white/90 dark:bg-[#0d0f19]/90 backdrop-blur-2xl rounded-3xl border border-slate-200/60 dark:border-white/10 p-6 max-w-lg w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] relative animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100"
          >
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Headphones className="w-5 h-5" /> Spatial Audio Compass : Mode d'Emploi
            </h3>
            
            <div className="space-y-3.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Bienvenue dans le <strong>Spatial Audio Compass</strong> ! Cette application simule des flux sonores tridimensionnels réalistes grâce à la technologie de panoramique <strong>HRTF (Head-Related Transfer Function)</strong> intégrée dans l'API Web Audio moderne de votre navigateur.
              </p>
              
              <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-xl border border-indigo-500/20 text-xs">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">🎧 IMPORTANT : UTILISEZ DES ÉCOUTEURS</span>
                Pour percevoir l'illusion de spatialisation 3D (gauche, droite, devant, derrière, haut, bas), vous devez impérativement porter des <strong>écouteurs stéréo</strong> ou un <strong>casque audio</strong> !
              </div>

              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">🕹️ Comment piloter la source sonore :</span>
                <ul className="list-disc list-inside space-y-1 pl-1 text-xs text-slate-500 dark:text-slate-400">
                  <li><strong>Glisser-Déposer :</strong> Cliquez ou touchez n'importe où sur l'écran radar 2D pour y téléporter ou faire glisser l'émetteur sonore.</li>
                  <li><strong>Clavier Physique :</strong> Utilisez directement les <strong className="text-sky-600 dark:text-sky-400">flèches directionnelles (↑, ↓, ←, →)</strong> de votre clavier pour piloter le son par paliers de 0,5 mètre.</li>
                </ul>
              </div>

              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">🔄 Autopilote & Signaux :</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Activez l'<strong>Orbite Automatique</strong> pour faire tourner le son de manière continue sur des trajectoires géométriques (Cercles complets, trajectoires en infini, ou mouvements ascendants/descendants). Choisissez le type de bruit pour tester la réponse spectrale de votre ouïe !
                </p>
              </div>
            </div>

            <button
              id="info-modal-close"
              onClick={() => setIsInfoOpen(false)}
              className="mt-6 w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              J'ai compris, fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
