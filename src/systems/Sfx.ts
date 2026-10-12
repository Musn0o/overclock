/**
 * Tiny procedural sound engine built on the Web Audio API.
 *
 * All sounds are synthesised at runtime, so the game ships with zero audio
 * files (keeps the initial bundle tiny and avoids any licensed music/SFX).
 * Output is routed through a master gain node so it can be muted instantly
 * when YouTube sends an audio-disabled event.
 */
export class Sfx {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private enabled = true;

    private ensureContext(): void {
        if (this.ctx) {
            return;
        }
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
            return;
        }
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.22 : 0;
        this.master.connect(this.ctx.destination);
    }

    /** Must be called from a user gesture to unlock audio on mobile browsers. */
    resume(): void {
        this.ensureContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            void this.ctx.resume();
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (this.master) {
            this.master.gain.value = enabled ? 0.22 : 0;
        }
    }

    private tone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gain = 1): void {
        if (!this.enabled) {
            return;
        }
        this.ensureContext();
        if (!this.ctx || !this.master) {
            return;
        }
        const start = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.6 * gain), start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(env);
        env.connect(this.master);
        osc.start(start);
        osc.stop(start + duration + 0.03);
    }

    click(): void {
        this.tone(520, 0.05, 'square', 0, 0.5);
    }

    release(): void {
        this.tone(440, 0.08, 'triangle');
    }

    success(): void {
        this.tone(660, 0.10, 'sine');
        this.tone(990, 0.12, 'sine', 0.07);
    }

    bubble(): void {
        this.tone(520, 0.08, 'sine');
        this.tone(880, 0.10, 'sine', 0.06);
    }

    whoosh(): void {
        this.tone(300, 0.14, 'triangle', 0, 0.7);
        this.tone(180, 0.18, 'sine', 0.03, 0.5);
    }

    claim(): void {
        this.tone(660, 0.09, 'square');
        this.tone(990, 0.10, 'square', 0.07);
        this.tone(1320, 0.12, 'square', 0.14);
    }

    fail(): void {
        this.tone(180, 0.22, 'sawtooth', 0, 0.7);
    }

    gameOver(): void {
        this.tone(330, 0.18, 'square');
        this.tone(247, 0.18, 'square', 0.16);
        this.tone(165, 0.36, 'square', 0.32);
    }
}

export const sfx = new Sfx();
