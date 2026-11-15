import type { AlarmTone } from '../types/chrono';
import { getCustomRingtoneBlobUrl } from './ringtoneStore';

export type AmbientSoundscape = 'off' | 'brown' | 'rain' | 'binaural';

class ChronoSoundEngine {
  private ctx: AudioContext | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;
  private alarmInterval: number | null = null;
  private activeAudioEl: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private previewTimeout: number | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  private stopCustomAudio(): void {
    if (this.previewTimeout !== null) {
      window.clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
      } catch {
        // Ignore media stop error
      }
      this.activeAudioEl = null;
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  public playTick(pitch = 880, volume = 0.03): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playCompletionChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  }

  private playSynthTone(tone: Exclude<AlarmTone, 'custom'>): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const patterns: Record<Exclude<AlarmTone, 'custom'>, number[]> = {
      dawn: [440, 554.37, 659.25, 880],
      amber: [587.33, 739.99, 880],
      zenith: [523.25, 783.99, 1046.5],
      pulse: [659.25, 659.25, 880],
    };

    const freqs = patterns[tone] ?? patterns.dawn;
    freqs.forEach((freq, i) => {
      const start = now + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'pulse' ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(tone === 'pulse' ? 0.06 : 0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public async playCustomRingtone(
    ringtoneId: string,
    loop: boolean,
    onEnded?: () => void
  ): Promise<boolean> {
    this.stopCustomAudio();
    const url = await getCustomRingtoneBlobUrl(ringtoneId);
    if (!url) return false;

    const audio = new Audio(url);
    audio.loop = loop;
    audio.onended = () => {
      if (!loop) {
        this.stopCustomAudio();
        onEnded?.();
      }
    };
    this.activeAudioEl = audio;
    this.activeObjectUrl = url;

    try {
      await audio.play();
      if (!loop) {
        this.previewTimeout = window.setTimeout(() => {
          this.stopCustomAudio();
          onEnded?.();
        }, 6000);
      }
      return true;
    } catch {
      this.stopCustomAudio();
      return false;
    }
  }

  public playAlarmToneOnce(tone: AlarmTone, customRingtoneId?: string): void {
    this.stopCustomAudio();
    if (tone === 'custom' && customRingtoneId) {
      void this.playCustomRingtone(customRingtoneId, false).then((ok) => {
        if (!ok) this.playSynthTone('dawn');
      });
      return;
    }
    this.playSynthTone(tone === 'custom' ? 'dawn' : tone);
  }

  public startAlarmLoop(tone: AlarmTone, customRingtoneId?: string): void {
    this.stopAlarmLoop();
    if (tone === 'custom' && customRingtoneId) {
      void this.playCustomRingtone(customRingtoneId, true).then((ok) => {
        if (!ok) {
          this.playSynthTone('dawn');
          this.alarmInterval = window.setInterval(() => {
            this.playSynthTone('dawn');
          }, 1500);
        }
      });
      return;
    }

    const synthTone = tone === 'custom' ? 'dawn' : tone;
    this.playSynthTone(synthTone);
    this.alarmInterval = window.setInterval(() => {
      this.playSynthTone(synthTone);
    }, 1500);
  }

  public stopAlarmLoop(): void {
    if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.stopCustomAudio();
  }

  public setAmbient(mode: AmbientSoundscape): void {
    this.stopAmbient();
    if (mode === 'off') return;

    const ctx = this.getContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(mode === 'binaural' ? 0.06 : 0.14, ctx.currentTime + 0.6);
    masterGain.connect(ctx.destination);
    this.ambientGain = masterGain;

    if (mode === 'binaural') {
      const leftOsc = ctx.createOscillator();
      const rightOsc = ctx.createOscillator();
      const leftPan = ctx.createStereoPanner();
      const rightPan = ctx.createStereoPanner();
      leftOsc.frequency.value = 200;
      rightOsc.frequency.value = 240; // 40Hz gamma focus beat
      leftPan.pan.value = -0.8;
      rightPan.pan.value = 0.8;
      leftOsc.connect(leftPan).connect(masterGain);
      rightOsc.connect(rightPan).connect(masterGain);
      leftOsc.start();
      rightOsc.start();
      this.ambientNodes.push(leftOsc, rightOsc, leftPan, rightPan);
      return;
    }

    // Filtered procedural noise buffer (2 seconds loop)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (mode === 'brown') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      } else {
        data[i] = white * 0.45;
      }
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = mode === 'brown' ? 'lowpass' : 'bandpass';
    filter.frequency.value = mode === 'brown' ? 320 : 1100;
    filter.Q.value = mode === 'brown' ? 0.7 : 0.5;

    noise.connect(filter).connect(masterGain);
    noise.start();
    this.ambientNodes.push(noise, filter);
  }

  public stopAmbient(): void {
    this.ambientNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    });
    this.ambientNodes = [];
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        // Ignore
      }
      this.ambientGain = null;
    }
  }
}

export const soundEngine = new ChronoSoundEngine();
