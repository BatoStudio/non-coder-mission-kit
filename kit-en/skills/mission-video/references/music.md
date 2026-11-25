# The music

Made from code by `scripts/synth.py` (numpy, scipy, soundfile, pyloudnorm), so there is no outside music and no licence. The same length gives the same music every time.

## Recipe

- 96 BPM, 4/4 (one bar is 2.5 s).
- Main section D, A/C#, Bm, G. Bridge Em, G, D, Asus.
- Synthetic piano (short notes that die away), a soft pad, reverb.
- Structure: intro, then verse / bridge / lift / break round and round, then an outro that ends on D.

To change the mood, change the chords in `CH`, `MAIN`, `BRIDGE` or `BPM`. Keep a copy of what worked, and tell the owner that the new piece will not match the older videos.

## Mix

- The music drops by 78% while there is speech (ducking) and comes back gently between phrases.
- The whole mix is set to **-16 LUFS** with a soft limit, so nothing clips.

## Commands

```
py -3 synth.py music --seconds 120 --out <folder>          music alone
py -3 synth.py mix --work <work>                           all the lines of say.py, one after the other
py -3 synth.py mix --voice a.wav@0.4 --voice b.wav@5 --seconds 12 --out <folder>     voice files at chosen seconds
```
