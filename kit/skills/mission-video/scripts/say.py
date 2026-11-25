"""One voice file per narration line (Kokoro, or Edge for Vietnamese). Always the same voice, so new lines match the old ones.

    py -3 say.py <work-folder> [--script script.md] [--models DIR] [--voice bf_isabella] [--speed 1.0] [--lang en-gb]
    py -3 say.py <work-folder> --script script-vi.md --engine edge            (Vietnamese female voice vi-VN-HoaiMyNeural)

--script reads lines written as  "- 3.1 — The words to read."  and writes <work>/scenes.json.
Without it, <work>/scenes.json must exist: [{"id": "3.1", "line": "..."}].
Writes <work>/voice/<id>.wav and <work>/durations.json {id: seconds}. A line whose text did not change is not made again.
Model files (kokoro-v1.0.onnx, voices-v1.0.bin): --models, or the KOKORO_MODELS variable, or the shared folder ~/.cache/kokoro.
Needs: py -3 -m pip install kokoro-onnx soundfile   (Edge: py -3 -m pip install edge-tts, plus ffmpeg; needs internet)
"""
import argparse, asyncio, json, os, re, subprocess, sys, tempfile, time

# Words the voice gets wrong, written the way they sound. Add new ones here.
TTS_FIX = [(r'\bWC\b', 'W C'), (r'\bAC\b', 'A C'), (r'\bDXF\b', 'D X F'), (r'\bPDF\b', 'P D F'), (r'\bCAD\b', 'C A D')]
FILES = ('kokoro-v1.0.onnx', 'voices-v1.0.bin')


def fix(t):
    for a, b in TTS_FIX:
        t = re.sub(a, b, t)
    return t


def find_models(given):
    tries = [given, os.environ.get('KOKORO_MODELS'), os.path.join(os.path.expanduser('~'), '.cache', 'kokoro')]
    for t in tries:
        if t and all(os.path.exists(os.path.join(t, f)) for f in FILES):
            return t
    sys.exit('Kokoro model files not found. Pass --models, or see references/voice.md for where to download them.')


EDGE_VOICE = 'vi-VN-HoaiMyNeural'


def edge_say(text, voice, speed, out_wav):
    """Edge TTS -> mp3 -> 24 kHz mono wav (same shape as Kokoro's). Returns seconds."""
    import edge_tts
    import soundfile as sf
    rate = f'{round((speed - 1) * 100):+d}%'
    fd, mp3 = tempfile.mkstemp(suffix='.mp3'); os.close(fd)
    try:
        for tries in range(6):  # the Edge service now and then sends no audio; asking again works
            try:
                asyncio.run(edge_tts.Communicate(text, voice, rate=rate).save(mp3)); break
            except edge_tts.exceptions.NoAudioReceived:
                if tries == 5:
                    raise
                time.sleep(1 + tries)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ar', '24000', '-ac', '1', out_wav], check=True)
    finally:
        os.remove(mp3)
    info = sf.info(out_wav)
    return round(info.frames / info.samplerate, 3)


def read_script(path):
    out = []
    for ln in open(path, encoding='utf-8').read().splitlines():
        m = re.match(r'^- (\d+\.\d+) [—-] (.+)$', ln)
        if m:
            out.append({'id': m.group(1), 'line': m.group(2).strip()})
    if not out:
        sys.exit('No lines found. Write each one as: - 1.1 — The words to read.')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('work'); ap.add_argument('--script'); ap.add_argument('--models')
    ap.add_argument('--voice'); ap.add_argument('--speed', type=float, default=1.0); ap.add_argument('--lang', default='en-gb')
    ap.add_argument('--engine', choices=['kokoro', 'edge'], default='kokoro')
    a = ap.parse_args()
    edge = a.engine == 'edge'
    a.voice = a.voice or (EDGE_VOICE if edge else 'bf_isabella')
    work = os.path.abspath(a.work); os.makedirs(os.path.join(work, 'voice'), exist_ok=True)
    sp = os.path.join(work, 'scenes.json')
    if a.script:
        json.dump(read_script(a.script), open(sp, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    scenes = json.load(open(sp, encoding='utf-8'))
    import soundfile as sf
    dur_path = os.path.join(work, 'durations.json'); lines_path = os.path.join(work, 'voice', 'lines.json')
    old = json.load(open(lines_path, encoding='utf-8')) if os.path.exists(lines_path) else {}
    durs = json.load(open(dur_path, encoding='utf-8')) if os.path.exists(dur_path) else {}
    if not edge:
        from kokoro_onnx import Kokoro
        m = find_models(a.models)
        k = Kokoro(os.path.join(m, FILES[0]), os.path.join(m, FILES[1]))
    made = 0
    for s in scenes:
        sid, line = s['id'], s.get('line')
        f = os.path.join(work, 'voice', sid + '.wav')
        # Kokoro keeps the plain line as its key (old caches still match); Edge adds voice and speed, so changing either remakes the line.
        key = f'edge:{a.voice}:{a.speed}|{line}' if edge else line
        if not line or (old.get(sid) == key and os.path.exists(f) and sid in durs):
            continue
        if edge:
            durs[sid] = edge_say(fix(line), a.voice, a.speed, f)
        else:
            x, sr = k.create(fix(line), voice=a.voice, speed=a.speed, lang=a.lang)
            sf.write(f, x, sr); durs[sid] = round(len(x) / sr, 3)
        old[sid] = key; made += 1
    json.dump(durs, open(dur_path, 'w', encoding='utf-8'), indent=1)
    json.dump(old, open(lines_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{made} lines made, {len(durs)} in all, {sum(durs.values()):.1f} s of speech')


if __name__ == '__main__':
    main()
