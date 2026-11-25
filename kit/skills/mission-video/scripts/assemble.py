"""Joins the pictures, the cards, the voice and the music into one video (1280 x 720, 30 fps).

    py -3 assemble.py <work-folder> [--out video.mp4] [--crf 23]

Needs in <work> (from say.py and cards.py): scenes.json, durations.json, voice/<id>.wav, and one picture per line: pictures/<id>.png, .jpg or .mp4.
Optional: cards/title.png (shown 2 s) and cards/end.png (shown 1.5 s).
Each scene lasts as long as its line plus 1.3 s of air. A still stays on the screen; a clip is cut to fit, or its last frame is held.
"""
import argparse, json, os, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth

CARD_T, END_T, LEAD, TAIL, LAST = 2.0, 1.5, .4, .9, .8
# out_range=tv: JPG and PNG come in different colour ranges, and parts that differ turn grey (and lose the corner logo) once joined
FIT = 'scale=1280:720:force_original_aspect_ratio=decrease:out_range=tv,pad=1280:720:(ow-iw)/2:(oh-ih)/2:white,fps=30,format=yuv420p,setrange=tv'
EXT = ('.png', '.jpg', '.jpeg', '.mp4')


def run(cmd):
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-800:])


def still(src, sec, out, crf):
    run(['-loop', '1', '-t', f'{sec:.3f}', '-i', src, '-vf', FIT, '-c:v', 'libx264', '-preset', 'veryfast', '-bf', '0', '-crf', crf, out])


def clip(src, sec, out, crf):
    run(['-i', src, '-an', '-t', f'{sec:.3f}', '-vf', f'tpad=stop_mode=clone:stop_duration={sec:.3f},{FIT}', '-c:v', 'libx264', '-preset', 'veryfast', '-bf', '0', '-crf', crf, out])


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('--out'); ap.add_argument('--crf', default='23')
    a = ap.parse_args(); work = os.path.abspath(a.work); out = os.path.abspath(a.out or os.path.join(work, 'video.mp4'))
    scenes = [s for s in json.load(open(os.path.join(work, 'scenes.json'), encoding='utf-8')) if s.get('line')]
    durs = json.load(open(os.path.join(work, 'durations.json'), encoding='utf-8'))
    pic = lambda i: next((p for p in (os.path.join(work, 'pictures', i + e) for e in EXT) if os.path.exists(p)), None)
    missing = [s['id'] for s in scenes if not pic(s['id'])]
    if missing:
        sys.exit('No picture for line(s): ' + ', '.join(missing) + '. Put them in pictures/<id>.png, .jpg or .mp4')
    title, end = os.path.join(work, 'cards', 'title.png'), os.path.join(work, 'cards', 'end.png')
    has_t, has_e = os.path.exists(title), os.path.exists(end)
    parts = os.path.join(work, 'parts'); os.makedirs(parts, exist_ok=True); files = []
    if has_t:
        files.append(os.path.join(parts, 'title.mp4')); still(title, CARD_T, files[-1], a.crf)
    for n, s in enumerate(scenes):
        sec = LEAD + durs[s['id']] + TAIL
        if n == len(scenes) - 1 and not has_e:
            sec += LAST   # the music fades out over the last picture
        files.append(os.path.join(parts, f"{n:03d}.mp4")); p = pic(s['id'])
        (clip if p.endswith('.mp4') else still)(p, sec, files[-1], a.crf)
    if has_e:
        files.append(os.path.join(parts, 'end.mp4')); still(end, END_T, files[-1], a.crf)
    synth.mix_work(work, LEAD, TAIL, CARD_T if has_t else 0, END_T if has_e else 0)
    lst = os.path.join(parts, 'list.txt'); open(lst, 'w', encoding='utf-8').write('\n'.join("file '" + f.replace(os.sep, '/') + "'" for f in files))
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-i', os.path.join(work, 'mix.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'aresample=48000,atrim=start_sample=1024,asetpts=N/SR/TB', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest', '-use_editlist', '0', '-movflags', '+faststart', out])  # no edit list, no B-frames: Facebook ignores edit lists, which made the voice late
    print('wrote', out)


if __name__ == '__main__':
    main()
