/**
 * AEGIS-CORE : Tactical Audio Feedback Engine
 * Synthesizes browser-native tactical audio alerts using Web Audio API
 * No external MP3/WAV dependencies required
 */

class TacticalAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.activeSirenOsc = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Soft UI Click
  playClick() {
    if (this.isMuted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio click err', e);
    }
  }

  // Tactical Confirmation Chime
  playConfirm() {
    if (this.isMuted) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.15, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.22);
      });
    } catch (e) {}
  }

  // High Stakes CAD Emergency Incoming Dispatch Alert
  playDispatchChime() {
    if (this.isMuted) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174.66, now + 0.15);
      osc1.frequency.setValueAtTime(1760, now + 0.3);

      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(587.33, now + 0.15);
      osc2.frequency.setValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.65);
      osc2.stop(now + 0.65);
    } catch (e) {}
  }

  // Police Radio Burst Squelch
  playRadioSquelch() {
    if (this.isMuted) return;
    this.init();
    try {
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  // Emergency SOS Dual-Tone Pulsing Siren
  startSOSAlarm() {
    if (this.isMuted || this.activeSirenOsc) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(950, now);
      
      // Frequency Modulation LFO
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(3.5, now); // 3.5 Hz pulse
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(250, now);
      lfo.connect(osc.frequency);
      lfo.start();

      gain.gain.setValueAtTime(0.25, now);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();

      this.activeSirenOsc = { osc, lfo, gain };
    } catch (e) {}
  }

  stopSOSAlarm() {
    if (this.activeSirenOsc) {
      try {
        const now = this.ctx.currentTime;
        this.activeSirenOsc.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        setTimeout(() => {
          if (this.activeSirenOsc) {
            this.activeSirenOsc.osc.stop();
            this.activeSirenOsc.lfo.stop();
            this.activeSirenOsc = null;
          }
        }, 120);
      } catch (e) {
        this.activeSirenOsc = null;
      }
    }
  }

  // Heartbeat ECG Pulse Tick
  playHeartbeatTick() {
    if (this.isMuted) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.09);
    } catch (e) {}
  }
}

window.tacticalAudio = new TacticalAudioEngine();
