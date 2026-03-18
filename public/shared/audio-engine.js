/**
 * AudioEngine - Web Audio API Synthesizer for Quiz Game Show
 * Generates all game sounds programmatically (no MP3 files needed)
 */
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgMusicOsc = null;
        this.bgMusicGain = null;
        this.isPlaying = false;
        this.masterVolume = 0.5;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ─── BACKGROUND MUSIC ───────────────────────────────────
    startBackgroundMusic() {
        this.init();
        this.resume();
        if (this.bgMusicOsc) return;

        const now = this.ctx.currentTime;
        this.bgMusicGain = this.ctx.createGain();
        this.bgMusicGain.gain.value = 0.08;
        this.bgMusicGain.connect(this.masterGain);

        // Pad chord: C-E-G ambient drone
        const notes = [130.81, 164.81, 196.00]; // C3, E3, G3
        this.bgMusicOscs = notes.map(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.3;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(now);

            osc.connect(this.bgMusicGain);
            osc.start(now);
            return { osc, lfo };
        });

        this.isPlaying = true;
    }

    stopBackgroundMusic() {
        if (this.bgMusicOscs) {
            this.bgMusicOscs.forEach(({ osc, lfo }) => {
                osc.stop();
                lfo.stop();
            });
            this.bgMusicOscs = null;
        }
        this.isPlaying = false;
    }

    // ─── TICKING SOUNDS ─────────────────────────────────────
    playSlowTick() {
        this._playTick(800, 0.06, 0.05);
    }

    playFastTick() {
        this._playTick(1200, 0.12, 0.04);
    }

    _playTick(freq, vol, duration) {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration + 0.01);
    }

    // ─── PLAYER LOCK-IN SOUNDS ──────────────────────────────
    playPlayer1LockIn() {
        // Rising chime - bright and high
        this._playChime([523.25, 659.25, 783.99], 0.15); // C5, E5, G5
    }

    playPlayer2LockIn() {
        // Descending chime - deeper tone
        this._playChime([392.00, 329.63, 261.63], 0.15); // G4, E4, C4
    }

    _playChime(freqs, vol) {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const start = now + i * 0.08;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(vol, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.3);
        });
    }

    // ─── LIFELINE ACTIVATION ────────────────────────────────
    playLifelineActivation() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        // Dramatic frequency sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.6);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.8);
    }

    // ─── CORRECT ANSWER ─────────────────────────────────────
    playCorrect() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const start = now + i * 0.1;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.5);
        });
    }

    // ─── WRONG ANSWER ───────────────────────────────────────
    playWrong() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 150;

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    // ─── DRUMROLL (REVEAL) ──────────────────────────────────
    playDrumroll(durationSec = 2.5) {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;
        const steps = Math.floor(durationSec * 20);

        for (let i = 0; i < steps; i++) {
            const t = now + i * (durationSec / steps);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 200 + Math.random() * 100;

            gain.gain.setValueAtTime(0.06 + (i / steps) * 0.06, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.05);
        }
    }

    // ─── ROUND TRANSITION ───────────────────────────────────
    playRoundTransition() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            const start = now + i * 0.15;
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    // ─── SUDDEN DEATH ───────────────────────────────────────
    playSuddenDeath() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        for (let i = 0; i < 6; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 100 + i * 50;

            const start = now + i * 0.12;
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.25);
        }
    }

    // ─── COMBO / STREAK ─────────────────────────────────────
    playCombo() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const start = now + i * 0.06;
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    }

    // ─── TENSION / AMBIENCE ─────────────────────────────────
    playTension() {
        this.init();
        this.resume();
        if (this.tensionOsc) return;

        const now = this.ctx.currentTime;
        this.tensionGain = this.ctx.createGain();
        this.tensionGain.gain.value = 0;
        this.tensionGain.connect(this.masterGain);
        this.tensionGain.gain.linearRampToValueAtTime(0.05, now + 1);

        // Low pulsing heartbeat
        this.tensionOsc = this.ctx.createOscillator();
        this.tensionOsc.type = 'sine';
        this.tensionOsc.frequency.value = 60; // Low bass
        
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 1.5; // Pulse rate
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 20;
        lfo.connect(lfoGain);
        lfoGain.connect(this.tensionOsc.frequency);
        
        this.tensionOsc.connect(this.tensionGain);
        lfo.start(now);
        this.tensionOsc.start(now);
        this.tensionLfo = lfo;
    }

    stopTension() {
        if (this.tensionOsc) {
            const now = this.ctx.currentTime;
            this.tensionGain.gain.linearRampToValueAtTime(0, now + 1);
            setTimeout(() => {
                if (this.tensionOsc) {
                    this.tensionOsc.stop();
                    this.tensionLfo.stop();
                    this.tensionOsc = null;
                }
            }, 1000);
        }
    }

    // ─── POWER-UP ──────────────────────────────────────────
    playPowerUp() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.4);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }

    // ─── HAPTIC FEEDBACK (BEEP) ─────────────────────────────
    playHaptic() {
        this.init();
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    stopAll() {
        this.stopBackgroundMusic();
        this.stopTension();
    }
}
