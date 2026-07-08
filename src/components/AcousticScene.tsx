import React, { useRef, useEffect, useState } from 'react';
import { SoundPosition, EarLevels } from '../types';
import { AudioEngine } from '../audioEngine';
import { Move, Compass, Volume2, Maximize2 } from 'lucide-react';

interface AcousticSceneProps {
  position: SoundPosition;
  onChangePosition: (pos: SoundPosition) => void;
  audioEngine: AudioEngine;
  isPlaying: boolean;
  isDarkMode: boolean;
}

export const AcousticScene: React.FC<AcousticSceneProps> = ({
  position,
  onChangePosition,
  audioEngine,
  isPlaying,
  isDarkMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [dimensions, setDimensions] = useState({ width: 380, height: 380 });
  const [angleAndDistance, setAngleAndDistance] = useState({ azimuth: 0, distance: 0 });

  // Update azimuth and distance display whenever position changes
  useEffect(() => {
    const dist = Math.sqrt(position.x * position.x + position.z * position.z);
    // Azimuth in degrees: 0° is top (front), 90° right, 180° back, -90° left
    // Math.atan2(x, z) gives angle from Z-axis (front)
    let az = Math.atan2(position.x, position.z) * (180 / Math.PI);
    if (az < 0) az += 360; // Normalize to [0, 360]
    // Translate so 0 is Front, 90 is Right, 180 is Back, 270 is Left
    setAngleAndDistance({
      azimuth: Math.round(az),
      distance: parseFloat(dist.toFixed(1)),
    });
  }, [position]);

  // Handle Resize of canvas container
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Keep it square
        const size = Math.max(280, Math.min(width, 420));
        setDimensions({ width: size, height: size });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Main Canvas Animation loop for 60fps oscilloscope rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear with background color
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Themes config
      const colors = {
        gridLines: isDarkMode ? 'rgba(125, 211, 252, 0.12)' : 'rgba(79, 70, 229, 0.08)',
        gridSubLines: isDarkMode ? 'rgba(125, 211, 252, 0.04)' : 'rgba(79, 70, 229, 0.03)',
        axes: isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(100, 116, 139, 0.15)',
        text: isDarkMode ? '#94a3b8' : '#64748b',
        head: isDarkMode ? '#1e293b' : '#cbd5e1',
        headOutline: isDarkMode ? '#475569' : '#94a3b8',
        headphones: isDarkMode ? '#38bdf8' : '#4f46e5',
        source: isDarkMode ? '#06b6d4' : '#2563eb',
        sourceOuter: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(37, 99, 235, 0.12)',
        waveformL: isDarkMode ? '#06b6d4' : '#4f46e5',
        waveformR: isDarkMode ? '#10b981' : '#0d9488',
        directionIndicator: isDarkMode ? '#f43f5e' : '#e11d48',
      };

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const radiusX = dimensions.width / 2;
      const radiusY = dimensions.height / 2;

      // 1. Draw Concentric Sonar Circles
      ctx.strokeStyle = colors.gridLines;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (i / 5) * (dimensions.width / 2 - 20), 0, Math.PI * 2);
        ctx.stroke();

        // Add subtle labels for distance
        ctx.fillStyle = colors.text;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${i}m`, centerX + (i / 5) * (dimensions.width / 2 - 20) - 8, centerY - 4);
      }

      // 2. Draw Cross Axes
      ctx.strokeStyle = colors.axes;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      // X-Axis
      ctx.beginPath();
      ctx.moveTo(10, centerY);
      ctx.lineTo(dimensions.width - 10, centerY);
      ctx.stroke();
      // Z-Axis
      ctx.beginPath();
      ctx.moveTo(centerX, 10);
      ctx.lineTo(centerX, dimensions.height - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Axis labels
      ctx.fillStyle = colors.text;
      ctx.font = '9px "Inter", sans-serif';
      ctx.fillText('GAUCHE (-)', 12, centerY - 8);
      ctx.fillText('DROITE (+)', dimensions.width - 65, centerY - 8);
      ctx.fillText('AVANT (+)', centerX - 24, 20);
      ctx.fillText('ARRIÈRE (-)', centerX - 28, dimensions.height - 12);

      // 3. Draw Listener's Head
      const headRadius = 24;
      ctx.beginPath();
      ctx.arc(centerX, centerY, headRadius, 0, Math.PI * 2);
      ctx.fillStyle = colors.head;
      ctx.fill();
      ctx.strokeStyle = colors.headOutline;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nose to indicate direction (looking forward towards top of canvas!)
      ctx.beginPath();
      ctx.moveTo(centerX - 4, centerY - headRadius + 2);
      ctx.lineTo(centerX, centerY - headRadius - 6);
      ctx.lineTo(centerX + 4, centerY - headRadius + 2);
      ctx.closePath();
      ctx.fillStyle = colors.headOutline;
      ctx.fill();

      // Fetch waveforms and levels from audio engine
      const levels = audioEngine.getLevels();
      const waveforms = audioEngine.getWaveforms();

      // 4. Draw Headphones with real-time waveform oscilloscopes!
      const headphoneW = 8;
      const headphoneH = 20;
      const leftEarX = centerX - headRadius - headphoneW / 2;
      const rightEarX = centerX + headRadius + headphoneW / 2;

      // Draw Headphone Band
      ctx.beginPath();
      ctx.arc(centerX, centerY, headRadius + 1, Math.PI, 0, false);
      ctx.strokeStyle = colors.headphones;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Left Earphone
      ctx.fillStyle = colors.headphones;
      ctx.beginPath();
      ctx.roundRect(leftEarX - headphoneW / 2, centerY - headphoneH / 2, headphoneW, headphoneH, 4);
      ctx.fill();

      // Right Earphone
      ctx.beginPath();
      ctx.roundRect(rightEarX - headphoneW / 2, centerY - headphoneH / 2, headphoneW, headphoneH, 4);
      ctx.fill();

      // Left and Right Oscilloscope Waves!
      // We draw them flowing outwards from the headphones
      if (isPlaying) {
        // Draw Left Oscilloscope
        ctx.strokeStyle = colors.waveformL;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const leftWave = waveforms.left;
        const waveLenL = leftWave.length;
        const maxWaveHeight = 16;

        for (let i = 0; i < waveLenL; i++) {
          const progress = i / (waveLenL - 1);
          // Flow outwards (leftwards)
          const wx = leftEarX - 6 - progress * 35;
          // Offset inside the sample values (amplitude is generally -1..1)
          const sample = waveLenL > 0 ? leftWave[i] : 0;
          const wy = centerY + sample * maxWaveHeight;

          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // Draw Right Oscilloscope
        ctx.strokeStyle = colors.waveformR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const rightWave = waveforms.right;
        const waveLenR = rightWave.length;

        for (let i = 0; i < waveLenR; i++) {
          const progress = i / (waveLenR - 1);
          // Flow outwards (rightwards)
          const wx = rightEarX + 6 + progress * 35;
          const sample = waveLenR > 0 ? rightWave[i] : 0;
          const wy = centerY + sample * maxWaveHeight;

          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // Draw pulsating volumetric arcs for extra juicy spatial feeling
        ctx.strokeStyle = `rgba(6, 182, 212, ${levels.left * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX - headRadius - 6, centerY, 8 + levels.left * 15, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();

        ctx.strokeStyle = `rgba(16, 185, 129, ${levels.right * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX + headRadius + 6, centerY, 8 + levels.right * 15, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
      } else {
        // Draw idle straight line
        ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftEarX - 6, centerY);
        ctx.lineTo(leftEarX - 35, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightEarX + 6, centerY);
        ctx.lineTo(rightEarX + 35, centerY);
        ctx.stroke();
      }

      // 5. Draw Sound Source Dot (Coordinates scaled)
      // Map [-5, 5] position coordinates to canvas pixels
      const margin = 20;
      const usableHalfW = dimensions.width / 2 - margin;
      const usableHalfH = dimensions.height / 2 - margin;

      const sourceCanvasX = centerX + (position.x / 5) * usableHalfW;
      // Note: +Z is Front (top of canvas), so subtract position.z from centerY
      const sourceCanvasY = centerY - (position.z / 5) * usableHalfH;

      // Draw distance vector line
      ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.18)' : 'rgba(79, 70, 229, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sourceCanvasX, sourceCanvasY);
      ctx.stroke();

      // Draw elevation (Y) visualization bar under the source
      // If elevation is non-zero, draw a small vertical scale bar next to the source
      const elevH = (position.y / 5) * 20;
      ctx.strokeStyle = position.y >= 0 ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sourceCanvasX + 14, sourceCanvasY);
      ctx.lineTo(sourceCanvasX + 14, sourceCanvasY - elevH);
      ctx.stroke();

      // Little dot at top of elevation bar
      ctx.fillStyle = position.y >= 0 ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(sourceCanvasX + 14, sourceCanvasY - elevH, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw multiple glowing outer ripples emitting from sound source
      const timeMs = Date.now();
      const pulse1 = (timeMs % 1200) / 1200;
      const pulse2 = ((timeMs + 600) % 1200) / 1200;

      if (isPlaying) {
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 * (1 - pulse1)})`;
        ctx.beginPath();
        ctx.arc(sourceCanvasX, sourceCanvasY, 8 + pulse1 * 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 * (1 - pulse2)})`;
        ctx.beginPath();
        ctx.arc(sourceCanvasX, sourceCanvasY, 8 + pulse2 * 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw sound source solid core
      const gradient = ctx.createRadialGradient(
        sourceCanvasX,
        sourceCanvasY,
        1,
        sourceCanvasX,
        sourceCanvasY,
        10
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, colors.source);
      gradient.addColorStop(1, isDarkMode ? 'rgba(6,182,212,0)' : 'rgba(37,99,235,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sourceCanvasX, sourceCanvasY, 11, 0, Math.PI * 2);
      ctx.fill();

      // Draw border ring around the dot core
      ctx.strokeStyle = colors.source;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sourceCanvasX, sourceCanvasY, 7, 0, Math.PI * 2);
      ctx.stroke();

      // Draw small Speaker Icon indicator inside sound source
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Inter"';
      ctx.fillText('🔊', sourceCanvasX - 4.5, sourceCanvasY + 3);

      // Label beside sound source showing Elevation height indicator
      ctx.fillStyle = colors.text;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`Y: ${position.y > 0 ? '+' : ''}${position.y.toFixed(1)}`, sourceCanvasX + 22, sourceCanvasY + 4);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [dimensions, position, isPlaying, isDarkMode, audioEngine]);

  // Handle Dragging
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    updatePositionFromPointer(e);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    updatePositionFromPointer(e);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const updatePositionFromPointer = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const margin = 20;
    const usableHalfW = dimensions.width / 2 - margin;
    const usableHalfH = dimensions.height / 2 - margin;

    // Convert mouse coordinates back to [-5, 5] space
    let rx = ((mouseX - centerX) / usableHalfW) * 5;
    // +Z is top of canvas, so mouseY < centerY implies positive coordinate value
    let rz = ((centerY - mouseY) / usableHalfH) * 5;

    // Clamp values
    rx = Math.max(-5, Math.min(5, rx));
    rz = Math.max(-5, Math.min(5, rz));

    onChangePosition({
      x: rx,
      y: position.y, // Maintain current elevation
      z: rz,
    });
  };

  return (
    <div id="acoustic-scene-card" className="flex flex-col bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-3xl border border-slate-200/40 dark:border-white/10 p-5 shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <h2 className="font-display font-semibold text-base text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Scène Acoustique 2D
          </h2>
        </div>
        
        {/* Real-time coordinates reading badges */}
        <div className="flex items-center gap-1 font-mono text-xs text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15 px-2.5 py-1 rounded-full border border-sky-500/20">
          <span className="font-medium">X:</span>
          <span className="w-8 text-right font-semibold">{position.x.toFixed(2)}</span>
          <span className="opacity-40">|</span>
          <span className="font-medium">Z:</span>
          <span className="w-8 text-right font-semibold">{position.z.toFixed(2)}</span>
        </div>
      </div>

      {/* Radar Canvas Container */}
      <div 
        ref={containerRef}
        className="relative flex justify-center items-center py-2 flex-grow min-h-[300px]"
      >
        <canvas
          id="acoustic-radar-canvas"
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="rounded-2xl bg-slate-500/5 dark:bg-black/20 shadow-inner border border-slate-200/30 dark:border-white/5 cursor-crosshair active:scale-[0.99] transition-transform duration-100"
        />

        {/* Drag Helper Icon Overlay (only visible in dark mode / subtle) */}
        <div className="absolute top-4 right-4 text-slate-400 dark:text-slate-600 pointer-events-none opacity-40 flex items-center gap-1.5 text-[10px] font-mono">
          <Move className="w-3.5 h-3.5" /> Glisser pour déplacer
        </div>
      </div>

      {/* Calibration metrics */}
      <div className="grid grid-cols-2 gap-3 mt-4 text-[11px] font-mono border-t border-slate-200/30 dark:border-white/10 pt-3 text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-200/20 dark:bg-white/5 border border-slate-200/30 dark:border-white/5 text-center">
          <span>Angle d'Azimut</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{angleAndDistance.azimuth}°</span>
        </div>
        <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-200/20 dark:bg-white/5 border border-slate-200/30 dark:border-white/5 text-center">
          <span>Distance Source</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{angleAndDistance.distance} m</span>
        </div>
      </div>
    </div>
  );
};
