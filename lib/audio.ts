"use client";

export type AudioChannel = "drone" | "noise" | "static";

/** Per-channel output scaling so the mix stays tasteful. */
const SCALE: Record<AudioChannel, number> = {
  drone: 0.5,
  noise: 0.32,
  static: 0.12,
};

/**
 * Fully procedural ambience synth — zero audio assets, zero broken links.
 * drone  : detuned sub-bass stack through a slowly-breathing lowpass
 * noise  : integrated brown noise, warmth filter
 * static : band-passed white noise — cabin radio hiss
 */
class MissionAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels = new Map<AudioChannel, GainNode>();
  private masterVol = 0.9;
  private mutedFlag = false;

  /** Must be called from a user gesture (autoplay policy). */
  init() {
    if (typeof window === "undefined") return;
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }

    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.masterVol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    this.buildDrone();
    this.buildBrown();
    this.buildStatic();
  }

  resume() {
    void this.ctx?.resume();
  }

  private chan(name: AudioChannel, vol = 0) {
    const g = this.ctx!.createGain();
    g.gain.value = vol * SCALE[name];
    g.connect(this.master!);
    this.channels.set(name, g);
    return g;
  }

  private buildDrone() {
    const ctx = this.ctx!;
    const out = this.chan("drone");

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 240;
    lp.Q.value = 0.8;
    lp.connect(out);

    const stack: [number, number][] = [
      [54, 0.5],
      [55.6, 0.38],
      [108.3, 0.14],
      [162.9, 0.06],
    ];
    for (const [freq, amp] of stack) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      g.connect(lp);
      osc.start();
    }

    // slow orbital "breathing" on the filter cutoff
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const depth = ctx.createGain();
    depth.gain.value = 70;
    lfo.connect(depth);
    depth.connect(lp.frequency);
    lfo.start();
  }

  private noiseBuffer(brown: boolean) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else {
        d[i] = w;
      }
    }
    // seamless loop — crossfade the tail into the head so the loop
    // point doesn't click every cycle (random walk never returns to 0)
    const F = Math.floor(ctx.sampleRate * 0.5);
    for (let i = 0; i < F; i++) {
      const t = i / F;
      d[i] = d[i] * t + d[len - F + i] * (1 - t);
    }
    return buf;
  }

  private buildBrown() {
    const ctx = this.ctx!;
    const out = this.chan("noise");
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(true);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    src.connect(lp);
    lp.connect(out);
    src.start();
  }

  private buildStatic() {
    const ctx = this.ctx!;
    const out = this.chan("static");
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(false);
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.55;
    src.connect(bp);
    bp.connect(out);

    // wandering center frequency — radio drift
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = ctx.createGain();
    depth.gain.value = 900;
    lfo.connect(depth);
    depth.connect(bp.frequency);
    lfo.start();
    src.start();
  }

  setVolume(channel: AudioChannel, v: number) {
    const g = this.channels.get(channel);
    if (!g || !this.ctx) return;
    g.gain.setTargetAtTime(v * SCALE[channel], this.ctx.currentTime, 0.06);
  }

  setMasterVolume(v: number) {
    this.masterVol = v;
    this.applyMaster();
  }

  setMuted(muted: boolean) {
    this.mutedFlag = muted;
    this.applyMaster();
  }

  private applyMaster() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(
      this.mutedFlag ? 0 : this.masterVol,
      this.ctx.currentTime,
      0.05,
    );
  }

  /** Crisp mechanical switch click for UI interaction. */
  click() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 0.03);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = nb;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Short sonar blip — incoming crew radio call. */
  ping() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(940, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /** Soft three-tone bell on session completion. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const notes: [number, number][] = [
      [659.25, 0],
      [987.77, 0.16],
      [1318.5, 0.38],
    ];
    for (const [freq, dt] of notes) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(0.16, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.9);
      o.connect(g);
      g.connect(this.master);
      o.start(t + dt);
      o.stop(t + dt + 2);
    }
  }
}

export const missionAudio = new MissionAudio();
