# The voice

Kokoro (Python library `kokoro-onnx`), voice **`bf_isabella`**, `speed=1.0`, `lang='en-gb'`. Keep exactly these so that every video sounds like the same person.

## Vietnamese: Edge, female voice

For Vietnamese narration use `--engine edge`, which uses the voice **`vi-VN-HoaiMyNeural`** at `speed=1.0`. This is the default Vietnamese voice. Kokoro has no good Vietnamese voice.

`say.py` makes each line as an mp3 and turns it into a 24 kHz mono wav with ffmpeg, so `assemble.py` works the same way for both voices.

Edge needs internet. It is free and needs no key. The service sometimes sends back no audio; `say.py` asks again on its own, up to 6 times. A voice or speed change makes every line again.

To install: `py -3 -m pip install edge-tts`.

## Model files

Two files, 338 MB in total: `kokoro-v1.0.onnx` and `voices-v1.0.bin`. Put them in the shared folder `~/.cache/kokoro`, so `say.py` finds them from any app. They are too big for git and for this skill, so keep them out of both.

Download them from the kokoro-onnx releases page (`model-files-v1.0`, github.com/thewh1teagle/kokoro-onnx/releases) into `~/.cache/kokoro`, or pass `--models <folder>`. Install: `py -3 -m pip install kokoro-onnx soundfile numpy scipy pyloudnorm pillow`.

## Words it gets wrong

The script keeps the normal spelling. `TTS_FIX` at the top of `say.py` swaps the word just before reading: WC becomes "W C", AC "A C", DXF "D X F", PDF "P D F", CAD "C A D". When a new word sounds wrong, add a pair there.

A swap changes the sound only. Lines already made are kept while their text is the same, so delete that line's `.wav` to hear the fix.
