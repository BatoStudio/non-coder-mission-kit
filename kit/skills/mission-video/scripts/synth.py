"""Background music for a narrated video, made from nothing but code (no outside music, no licence).

    py -3 synth.py music [--seconds 300] [--out folder]      -> music-<seconds>s.wav
    py -3 synth.py mix   --voice a.wav[@3.0] --voice b.wav[@15.0] [--seconds 30] [--out folder]   -> mix-test.wav
    py -3 synth.py mix   --work folder [--intro 2] [--outro 1.5]   (the lines of say.py one after the other)   -> <folder>/mix.wav and <folder>/starts.json {id: seconds}

Recipe: 96 BPM, 4/4. Main section D - A/C# - Bm - G, bridge Em - G - D - Asus. Synthetic piano (short notes that die away)
and a soft pad, with reverb. Structure: intro, then verse / bridge / lift / break over and over, then an outro that ends on D.
The mix lowers the music while there is speech (ducking) and sets the whole mix to -16 LUFS.
Needs: numpy, scipy, soundfile, pyloudnorm (py -3 -m pip install numpy scipy soundfile pyloudnorm).
"""
import argparse, os, sys, warnings
warnings.filterwarnings("ignore", message="Possible clipped samples")
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import gaussian_filter1d, maximum_filter1d

SR = 44100
BPM = 96
BEAT = 60.0 / BPM
BAR = 4 * BEAT                                  # 2.5 s
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# chords: (bass note, upper notes), MIDI numbers
CH = {
    'D':    (38, [57, 62, 66]),        # D2 / A3 D4 F#4
    'A/C#': (37, [57, 61, 64]),        # C#2 / A3 C#4 E4
    'Bm':   (35, [57, 62, 66]),        # B1 / A3 D4 F#4
    'G':    (43, [55, 59, 62]),        # G2 / G3 B3 D4
    'Em':   (40, [55, 59, 64]),        # E2 / G3 B3 E4
    'Asus': (45, [57, 62, 64]),        # A2 / A3 D4 E4 (sus4)
}
MAIN = ['D', 'A/C#', 'Bm', 'G']
BRIDGE = ['Em', 'G', 'D', 'Asus']


def piano_note(m, dur, vel):
    """One short piano-like note: a few slightly stretched partials, each dying away, and a tiny hammer thump."""
    f = mtof(m); n = int(SR * dur); t = np.arange(n) / SR
    out = np.zeros(n)
    for k, a in enumerate([1.0, .55, .30, .17, .10, .06], start=1):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 9000:
            break
        decay = (1.6 + .9 * k) * (f / 261.6) ** .25
        out += a * np.sin(2 * np.pi * fk * t) * np.exp(-decay * t)
    att = np.minimum(1, t / .004)
    out *= att
    thump = np.random.default_rng(int(m)).standard_normal(int(SR * .02)) * np.exp(-np.arange(int(SR * .02)) / (SR * .004))
    thump = signal.lfilter(*signal.butter(2, 1800 / (SR / 2)), thump)
    out[:len(thump)] += .25 * thump
    rel = np.minimum(1, (n - np.arange(n)) / (SR * .05))
    return out * rel * vel


def pad_note(m, dur, vel):
    """A soft pad note: a few detuned sine stacks, slow to come in and slow to go."""
    f = mtof(m); n = int(SR * dur); t = np.arange(n) / SR
    out = np.zeros(n)
    for cents in (-7, 0, 7):
        fc = f * 2 ** (cents / 1200)
        for k, a in enumerate([1.0, .35, .18, .08], start=1):
            out += a * np.sin(2 * np.pi * fc * k * t + cents)
    env = np.minimum(1, t / .9) * np.minimum(1, (dur - t) / 1.1)
    return out / 3 * env * vel


def add(track, start, note):
    i = int(start * SR)
    if i >= len(track):
        return
    j = min(len(track), i + len(note))
    track[i:j] += note[:j - i]


# which pattern each section plays: (name, bars, chord list, piano style, pad level)
SECTIONS = {
    'intro':  (4, MAIN, 'sparse', .55),
    'verse':  (8, MAIN, 'arp', .5),
    'bridge': (4, BRIDGE, 'arp', .55),
    'lift':   (8, MAIN, 'lift', .75),
    'break':  (4, MAIN, 'sparse', .8),
    'outro':  (4, MAIN, 'outro', .5),
}


def plan(total_bars):
    """intro, then verse / bridge / lift / break round and round (the last one cut to fit), then the outro."""
    seq = [('intro', SECTIONS['intro'][0])]
    left = total_bars - SECTIONS['intro'][0] - SECTIONS['outro'][0]
    cyc = ['verse', 'bridge', 'lift', 'break']; i = 0
    while left > 0:
        nm = cyc[i % 4]; b = min(SECTIONS[nm][0], left); seq.append((nm, b)); left -= b; i += 1
    seq.append(('outro', SECTIONS['outro'][0]))
    return seq


def make_music(seconds):
    total_bars = max(12, int(round(seconds / BAR)))
    n = int(SR * total_bars * BAR)
    pn = np.zeros(n); pd = np.zeros(n)
    rng = np.random.default_rng(7)
    bar_i = 0
    for name, bars in plan(total_bars):
        _, chords, style, padlvl = SECTIONS[name]
        for b in range(bars):
            ch = CH[chords[(bar_i - 0) % len(chords)] if False else chords[b % len(chords)]]
            bass, up = ch; t0 = bar_i * BAR
            last = name == 'outro' and b == bars - 1
            bar_dur = BAR * (3.2 if last else 1.0) + .6
            add(pd, t0 - .4 if t0 > 0 else 0, pad_note(bass + 12, bar_dur + .4, padlvl * .5))
            for u in up:
                add(pd, t0 - .4 if t0 > 0 else 0, pad_note(u, bar_dur + .4, padlvl * .22))
            if style == 'sparse':
                add(pn, t0, piano_note(bass + 12, 2.2, .5)); add(pn, t0 + 2 * BEAT, piano_note(up[1], 1.6, .30 + .05 * rng.random()))
            elif style == 'outro':
                add(pn, t0, piano_note(bass, 4.5 if last else 2.2, .55)); add(pn, t0 + .02, piano_note(bass + 12, 4.5 if last else 2.2, .40))
                if last:
                    for k, u in enumerate(up):
                        add(pn, t0 + .05 + k * .06, piano_note(u, 5.0, .32))
                else:
                    add(pn, t0 + 2 * BEAT, piano_note(up[2], 1.5, .30))
            else:
                add(pn, t0, piano_note(bass, 2.4, .55))
                order = [0, 1, 2, 1, 2, 1, 2, 1]
                for s in range(8):
                    vel = (.34 if s % 2 == 0 else .26) + (.05 if style == 'lift' else 0) + .03 * rng.random()
                    add(pn, t0 + s * BEAT / 2 + .004 * rng.random(), piano_note(up[order[s]], 1.2, vel))
                if style == 'lift':
                    for beat in (0, 2):
                        add(pn, t0 + beat * BEAT, piano_note(up[2] + 12, 1.6, .20))
            bar_i += 1
    dry = .8 * pn + .9 * pd
    # reverb: noise with a dying tail, a different one for each ear
    L = int(SR * 2.2); tt = np.arange(L) / SR
    outs = []
    for seed in (1, 2):
        ir = np.random.default_rng(seed).standard_normal(L) * np.exp(-tt * 2.4)
        ir = signal.lfilter(*signal.butter(2, 5000 / (SR / 2)), ir); ir /= np.sqrt(np.sum(ir ** 2))
        wet = signal.fftconvolve(dry, ir)[:n]
        outs.append(.72 * dry + .30 * wet)
    st = np.stack(outs, axis=1)
    fade = int(SR * 1.5); st[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5   # the outro chord dies away into silence
    st /= max(1e-9, np.abs(st).max()); return st * .8


def load_voice(spec, n):
    path, _, at = spec.partition('@'); x, sr = sf.read(path, always_2d=True); x = x.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR); x = signal.resample_poly(x, SR // g, sr // g)
    v = np.zeros(n); i = int(float(at or 0) * SR)
    if i < n:
        v[i:i + len(x)] = x[:n - i]
    return v


def duck_gain(voice, depth=.78):
    """1 where there is no speech, down to 1 - depth where there is; it eases in and out."""
    env = gaussian_filter1d(np.abs(voice), SR * .03)
    mask = (env > .02 * max(1e-9, env.max())).astype(float)
    mask = maximum_filter1d(mask, int(SR * .35))                     # hold a little after each phrase
    mask = gaussian_filter1d(mask, SR * .12)
    return 1 - depth * np.clip(mask, 0, 1)


def mix(music, voice):
    import pyloudnorm as pl
    g = duck_gain(voice)[:, None]
    v = voice / max(1e-9, np.abs(voice).max()) * .85 if np.abs(voice).max() > 0 else voice
    out = music * g * .55 + v[:, None]
    meter = pl.Meter(SR)
    soft = lambda x: np.where(np.abs(x) < .8, x, np.sign(x) * (.8 + .2 * np.tanh((np.abs(x) - .8) / .2)))   # a gentle limit above 0.8, so nothing clips
    for _ in range(4):                                  # level to -16 LUFS, limit, and level again (the limit takes a little loudness)
        out = soft(pl.normalize.loudness(out, meter.integrated_loudness(out), -16.0))
    return out


def mix_work(work, lead=.4, tail=.9, intro=0, outro=0):
    """The lines of say.py in script order: each starts lead seconds into its scene, and tail seconds of music follow it."""
    import json
    scenes = json.load(open(os.path.join(work, 'scenes.json'), encoding='utf-8')); durs = json.load(open(os.path.join(work, 'durations.json'), encoding='utf-8'))
    ids = [s['id'] for s in scenes if s.get('line')]; starts = {}; t = float(intro)
    for i in ids:
        starts[i] = round(t + lead, 3); t += lead + durs[i] + tail
    total = t + max(outro, .8); n = int(total * SR); m = make_music(max(total + 4, 60))[:n]
    voice = np.zeros(n)
    for i in ids:
        voice += load_voice(os.path.join(work, 'voice', i + '.wav') + '@' + str(starts[i]), n)
    out = mix(m, voice); fade = int(SR * 1.2); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    sf.write(os.path.join(work, 'mix.wav'), out, SR, subtype='PCM_16'); json.dump(starts, open(os.path.join(work, 'starts.json'), 'w'), indent=1)
    print('wrote', os.path.join(work, 'mix.wav'), round(total, 1), 's')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['music', 'mix']); ap.add_argument('--seconds', type=float, default=300)
    ap.add_argument('--out', default='.'); ap.add_argument('--work'); ap.add_argument('--intro', type=float, default=0); ap.add_argument('--outro', type=float, default=0); ap.add_argument('--voice', action='append', default=[])
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    if a.cmd == 'mix' and a.work:
        return mix_work(a.work, intro=a.intro, outro=a.outro)
    m = make_music(a.seconds if a.cmd == 'music' else max(a.seconds, 60))
    if a.cmd == 'music':
        p = os.path.join(a.out, f'music-{int(a.seconds)}s.wav'); sf.write(p, m, SR, subtype='PCM_16'); print('wrote', p, round(len(m) / SR, 1), 's'); return
    n = int(a.seconds * SR); m = m[:n]
    voice = np.zeros(n)
    for spec in a.voice:
        voice += load_voice(spec, n)
    out = mix(m, voice); fade = int(SR * 1.0); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    p = os.path.join(a.out, 'mix-test.wav'); sf.write(p, out, SR, subtype='PCM_16'); print('wrote', p, round(len(out) / SR, 1), 's')


if __name__ == '__main__':
    main()
