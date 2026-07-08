import { SoundType, SoundPosition, EarLevels } from './types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private panner: PannerNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;

  // Active sources
  private activeSource: AudioBufferSourceNode | OscillatorNode | null = null;
  private activeSoundType: SoundType | null = null;
  private currentVolume: number = 0.6;
  private currentPosition: SoundPosition = { x: 0, y: 0, z: 0 };

  // Cached buffers
  private buffers: Record<string, AudioBuffer> = {};

  // Synth Arpeggiator states
  private arpeggioTimer: number | null = null;
  private arpeggioIndex: number = 0;
  private synthNodes: { oscs: OscillatorNode[]; gain: GainNode }[] = [];

  constructor() {
    // Lazy initialization on user interaction
  }

  private init() {
    if (this.ctx) return;

    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Create main nodes
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.currentVolume;

    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 100;
    this.panner.rolloffFactor = 1.2;

    // Connect nodes
    // Source -> Panner -> MasterGain -> Destination
    this.panner.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Create splitter and analysers for visual feedback
    this.splitter = this.ctx.createChannelSplitter(2);
    this.leftAnalyser = this.ctx.createAnalyser();
    this.rightAnalyser = this.ctx.createAnalyser();

    this.leftAnalyser.fftSize = 128;
    this.rightAnalyser.fftSize = 128;

    // Panner output also connects to splitter to analyze L/R spatialized signals
    this.panner.connect(this.splitter);
    this.splitter.connect(this.leftAnalyser, 0, 0); // L channel
    this.splitter.connect(this.rightAnalyser, 1, 0); // R channel

    // Update initial panner coordinates
    this.updatePosition(this.currentPosition);

    // Build static sound buffers
    this.generateWhiteNoiseBuffer();
    this.generatePinkNoiseBuffer();
    this.generateOrganicRainBuffer();
  }

  private generateWhiteNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2; // 2 seconds of looping white noise
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.buffers['white_noise'] = buffer;
  }

  private generatePinkNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Paul Kellet's refined Voss-McCartney pink noise algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.12; // Rescale to fit standard audio level
    }

    this.buffers['pink_noise'] = buffer;
  }

  private generateOrganicRainBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 4; // 4 seconds of rich audio
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // 1. Generate pink noise baseline wash (distant rain sound)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.035; // Gentle atmospheric wash
    }

    // 2. Sprinkle random near-field high-fidelity drops (sharp transients)
    const numDrops = 150;
    for (let d = 0; d < numDrops; d++) {
      const startIdx = Math.floor(Math.random() * (bufferSize - 2000));
      const freq = 1200 + Math.random() * 1800; // High-pitched clean resonance
      const duration = 0.008 + Math.random() * 0.012; // Super quick plops (8-20ms)
      const samples = duration * sampleRate;

      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const amp = Math.exp(-t * 220); // Fast decay exponent
        const wave = Math.sin(2 * Math.PI * freq * t);
        if (startIdx + i < bufferSize) {
          data[startIdx + i] += wave * amp * 0.14;
        }
      }
    }

    this.buffers['organic_rain'] = buffer;
  }

  public async start(type: SoundType) {
    this.init();
    if (!this.ctx || !this.panner) return;

    // Resume context if suspended (browser security check)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Stop current sound
    this.stop();
    this.activeSoundType = type;

    if (type === 'white_noise' || type === 'pink_noise' || type === 'organic_rain') {
      const buffer = this.buffers[type];
      if (buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.panner);
        source.start(0);
        this.activeSource = source;
      }
    } else if (type === 'sine_wave') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime); // 220 Hz soft pure tone for relaxation
      osc.connect(this.panner);
      osc.start(0);
      this.activeSource = osc;
    } else if (type === 'synth_arpeggio') {
      this.startArpeggiator();
    } else if (type === 'sea_waves') {
      // Synthesize rolling ocean waves using low-pass filtered pink noise modulated by a very slow LFO
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.buffers['pink_noise'] || this.buffers['white_noise'];
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);

      const waveGain = this.ctx.createGain();
      waveGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(this.panner);

      // Create a slow LFO to simulate waves coming in and out (approx 8 seconds period)
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);

      const lfoGainFilter = this.ctx.createGain();
      lfoGainFilter.gain.setValueAtTime(220, this.ctx.currentTime); // Modulate frequency by +/- 220Hz

      const lfoGainVolume = this.ctx.createGain();
      lfoGainVolume.gain.setValueAtTime(0.12, this.ctx.currentTime); // Modulate volume

      lfo.connect(lfoGainFilter);
      lfoGainFilter.connect(filter.frequency);

      lfo.connect(lfoGainVolume);
      lfoGainVolume.connect(waveGain.gain);

      noiseSource.start(0);
      lfo.start(0);

      this.activeSource = noiseSource;
      // Track secondary active nodes for cleanup
      this.synthNodes.push({ oscs: [lfo], gain: waveGain });

    } else if (type === 'forest_birds') {
      // Gentle wind chimes and warm bird sweeps
      const scheduler = () => {
        if (!this.ctx || !this.panner) return;
        const now = this.ctx.currentTime;

        // Randomly decide to play a chime (wind chime sound) or a chirp (bird)
        if (Math.random() > 0.4) {
          // Play a sweet wind chime
          const chimeOsc = this.ctx.createOscillator();
          const chimeGain = this.ctx.createGain();
          
          chimeOsc.type = 'sine';
          const notes = [587.33, 659.25, 783.99, 880.00, 987.77, 1174.66];
          const freq = notes[Math.floor(Math.random() * notes.length)];
          chimeOsc.frequency.setValueAtTime(freq, now);

          chimeGain.gain.setValueAtTime(0, now);
          chimeGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

          chimeOsc.connect(chimeGain);
          chimeGain.connect(this.panner);
          chimeOsc.start(now);
          chimeOsc.stop(now + 1.3);

          const nodeRef = { oscs: [chimeOsc], gain: chimeGain };
          this.synthNodes.push(nodeRef);
          setTimeout(() => {
            if (this.ctx) {
              this.synthNodes = this.synthNodes.filter((n) => n !== nodeRef);
            }
          }, 1500);
        } else {
          // Play a gentle forest bird chirp
          const chirpOsc = this.ctx.createOscillator();
          const chirpGain = this.ctx.createGain();

          chirpOsc.type = 'sine';
          const startFreq = 1800 + Math.random() * 600;
          chirpOsc.frequency.setValueAtTime(startFreq, now);
          chirpOsc.frequency.exponentialRampToValueAtTime(startFreq + 500, now + 0.05);
          chirpOsc.frequency.exponentialRampToValueAtTime(startFreq - 300, now + 0.12);

          chirpGain.gain.setValueAtTime(0, now);
          chirpGain.gain.linearRampToValueAtTime(0.06, now + 0.005);
          chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

          chirpOsc.connect(chirpGain);
          chirpGain.connect(this.panner);
          chirpOsc.start(now);
          chirpOsc.stop(now + 0.2);

          const nodeRef = { oscs: [chirpOsc], gain: chirpGain };
          this.synthNodes.push(nodeRef);
          setTimeout(() => {
            if (this.ctx) {
              this.synthNodes = this.synthNodes.filter((n) => n !== nodeRef);
            }
          }, 300);
        }
      };

      scheduler();
      this.arpeggioTimer = window.setInterval(scheduler, 400);

    } else if (type === 'bowl_gong') {
      // 4 oscillators slightly detuned to create that rich, vibrating singing bowl sound
      const freqs = [180, 360.5, 541, 811.5];
      const gains = [0.35, 0.18, 0.08, 0.04];
      const bowlGain = this.ctx.createGain();
      bowlGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      bowlGain.connect(this.panner);

      const oscs: OscillatorNode[] = [];

      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, this.ctx!.currentTime);
        
        // Subtle slow vibrato for each oscillator to mimic a hand-rubbed bowl
        const vibrato = this.ctx!.createOscillator();
        vibrato.frequency.setValueAtTime(0.22 + idx * 0.04, this.ctx!.currentTime);
        const vibratoGain = this.ctx!.createGain();
        vibratoGain.gain.setValueAtTime(1.8, this.ctx!.currentTime);
        
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start();
        
        const oscGain = this.ctx!.createGain();
        oscGain.gain.setValueAtTime(gains[idx], this.ctx!.currentTime);
        
        osc.connect(oscGain);
        oscGain.connect(bowlGain);
        osc.start();
        
        oscs.push(osc);
        oscs.push(vibrato);
      });

      this.activeSource = oscs[0];
      this.synthNodes.push({ oscs: oscs.slice(1), gain: bowlGain });

    } else if (type === 'heartbeat_sba') {
      const scheduler = () => {
        if (!this.ctx || !this.panner) return;
        const now = this.ctx.currentTime;

        const triggerBeat = (delay: number, intensity: number) => {
          const time = now + delay;
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(90, time);
          osc.frequency.exponentialRampToValueAtTime(25, time + 0.12);

          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(intensity, time + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

          osc.connect(gain);
          gain.connect(this.panner!);
          osc.start(time);
          osc.stop(time + 0.25);

          const nodeRef = { oscs: [osc], gain };
          this.synthNodes.push(nodeRef);
          setTimeout(() => {
            if (this.ctx) {
              this.synthNodes = this.synthNodes.filter((n) => n !== nodeRef);
            }
          }, 300);
        };

        triggerBeat(0, 0.45);
        triggerBeat(0.16, 0.35);
      };

      scheduler();
      this.arpeggioTimer = window.setInterval(scheduler, 1000);

    } else if (type === 'binaural_beat') {
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(528, this.ctx.currentTime); // 528 Hz Solfeggio

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(264, this.ctx.currentTime); // 264 Hz sub-octave

      const osc3 = this.ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(132, this.ctx.currentTime); // 132 Hz deep anchor

      const padGain = this.ctx.createGain();
      padGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      osc1.connect(padGain);
      osc2.connect(padGain);
      osc3.connect(padGain);
      padGain.connect(this.panner);

      osc1.start();
      osc2.start();
      osc3.start();

      this.activeSource = osc1;
      this.synthNodes.push({ oscs: [osc2, osc3], gain: padGain });
    }
  }

  private startArpeggiator() {
    if (!this.ctx || !this.panner) return;

    const scheduler = () => {
      if (!this.ctx || !this.panner) return;

      const nextNoteTime = this.ctx.currentTime;
      // 320Hz is a classic gentle woodblock / click frequency
      const freq = 320; 

      const osc1 = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc1.type = 'triangle'; // triangle is much warmer and gentler than sine or sawtooth
      osc1.frequency.setValueAtTime(freq, nextNoteTime);

      // Woodblock-like attack and quick decay (extremely soft but precise)
      noteGain.gain.setValueAtTime(0, nextNoteTime);
      noteGain.gain.linearRampToValueAtTime(0.24, nextNoteTime + 0.002);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, nextNoteTime + 0.06); // 60ms click is crisp yet gentle

      osc1.connect(noteGain);
      noteGain.connect(this.panner);

      osc1.start(nextNoteTime);
      
      const stopTime = nextNoteTime + 0.1;
      osc1.stop(stopTime);

      const noteRef = { oscs: [osc1], gain: noteGain };
      this.synthNodes.push(noteRef);
      setTimeout(() => {
        this.synthNodes = this.synthNodes.filter((n) => n !== noteRef);
      }, 150);
    };

    // Run first tick immediately
    scheduler();

    // Schedule subsequent ticks: 450ms is perfect therapeutic tempo for bilateral clicks
    this.arpeggioTimer = window.setInterval(scheduler, 450);
  }

  public stop() {
    // Clear arpeggiator timer
    if (this.arpeggioTimer) {
      clearInterval(this.arpeggioTimer);
      this.arpeggioTimer = null;
    }

    // Stop active buffer/oscillator source
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch (e) {
        // Source might have been stopped already
      }
      this.activeSource = null;
    }

    // Stop and clean up any ongoing scheduled synth voices
    this.synthNodes.forEach((node) => {
      node.oscs.forEach((osc) => {
        try {
          osc.stop();
        } catch (e) {}
      });
    });
    this.synthNodes = [];

    this.activeSoundType = null;
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public updatePosition(pos: SoundPosition) {
    this.currentPosition = pos;
    if (!this.panner || !this.ctx) return;

    // Map X, Y, Z to Panner's spatial coordinate system
    // Our top-down 2D canvas mapping:
    // - X maps directly to horizontal axis (positionX). Panning Left is negative, Right is positive.
    // - Y maps to elevation (positionY). Up is positive, Down is negative.
    // - Z maps to front-back axis (positionZ).
    // Let's scale to exaggerate spatial effect in headphones (2.5x coefficient)
    const scale = 2.5;
    const px = pos.x * scale;
    const py = pos.y * scale;
    
    // In Web Audio, listener looks at -Z (forward direction).
    // Therefore, positive pos.z (In front / Haute) should map to -Z (forward).
    // Negative pos.z (Behind / Bas) should map to +Z (backward).
    const pz = -pos.z * scale;

    if (this.panner.positionX) {
      const t = this.ctx.currentTime;
      // Use linearRampToValueAtTime to smoothly interpolate between moves and prevent audio crackles!
      this.panner.positionX.linearRampToValueAtTime(px, t + 0.05);
      this.panner.positionY.linearRampToValueAtTime(py, t + 0.05);
      this.panner.positionZ.linearRampToValueAtTime(pz, t + 0.05);
    } else {
      // Legacy browsers
      this.panner.setPosition(px, py, pz);
    }
  }

  public getLevels(): EarLevels {
    if (!this.leftAnalyser || !this.rightAnalyser || !this.activeSoundType) {
      return { left: 0, right: 0 };
    }

    // Calculate RMS in time domain for real-time responsiveness
    const leftData = new Float32Array(this.leftAnalyser.fftSize);
    const rightData = new Float32Array(this.rightAnalyser.fftSize);

    this.leftAnalyser.getFloatTimeDomainData(leftData);
    this.rightAnalyser.getFloatTimeDomainData(rightData);

    let leftSum = 0;
    for (let i = 0; i < leftData.length; i++) {
      leftSum += leftData[i] * leftData[i];
    }
    const leftRMS = Math.sqrt(leftSum / leftData.length);

    let rightSum = 0;
    for (let i = 0; i < rightData.length; i++) {
      rightSum += rightData[i] * rightData[i];
    }
    const rightRMS = Math.sqrt(rightSum / rightData.length);

    // Apply scale multiplier for visual aesthetics
    const scale = 4.0;
    return {
      left: Math.min(1, leftRMS * scale),
      right: Math.min(1, rightRMS * scale),
    };
  }

  public getWaveforms() {
    if (!this.leftAnalyser || !this.rightAnalyser || !this.activeSoundType) {
      return { left: new Float32Array(0), right: new Float32Array(0) };
    }

    const leftData = new Float32Array(64);
    const rightData = new Float32Array(64);

    this.leftAnalyser.getFloatTimeDomainData(leftData);
    this.rightAnalyser.getFloatTimeDomainData(rightData);

    return { left: leftData, right: rightData };
  }

  public isPlaying(): boolean {
    return this.activeSoundType !== null;
  }

  public getActiveSoundType(): SoundType | null {
    return this.activeSoundType;
  }
}
