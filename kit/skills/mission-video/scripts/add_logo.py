"""Puts the logo in a corner of a video. The sound is copied as it is.

    py -3 add_logo.py in.mp4 out.mp4 [--logo file.png] [--corner tr] [--height 72] [--margin 20] [--opacity 0.9] [--from 2] [--to 60] [--crf 23]

--corner: tr (top right, the default), br, bl, tl. Look at one frame first, and pick the corner where the logo covers nothing.
--from / --to (seconds): show it only between these times, for example to leave out a title card that already has the logo.
"""
import argparse, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, '..', 'assets', 'logo', 'logo.png')   # put your own logo here, or pass --logo
POS = {'br': ('W-w-{m}', 'H-h-{m}'), 'bl': ('{m}', 'H-h-{m}'), 'tr': ('W-w-{m}', '{m}'), 'tl': ('{m}', '{m}')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input'); ap.add_argument('output'); ap.add_argument('--logo', default=LOGO); ap.add_argument('--corner', choices=POS, default='tr')
    ap.add_argument('--height', type=int, default=72); ap.add_argument('--margin', type=int, default=20); ap.add_argument('--opacity', type=float, default=.9)
    ap.add_argument('--from', dest='t0', type=float); ap.add_argument('--to', dest='t1', type=float); ap.add_argument('--crf', default='23')
    a = ap.parse_args()
    if not os.path.exists(a.logo):
        raise SystemExit(f'Logo not found: {a.logo}. Put your logo at assets/logo/logo.png or pass --logo <file>.')
    x, y = (p.format(m=a.margin) for p in POS[a.corner])
    when = ''
    if a.t0 is not None or a.t1 is not None:
        when = f":enable='between(t,{a.t0 or 0},{a.t1 if a.t1 is not None else 86400})'"
    fc = f'[1:v]scale=-1:{a.height},format=rgba,colorchannelmixer=aa={a.opacity}[l];[0:v][l]overlay={x}:{y}:shortest=1{when},format=yuv420p[v]'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.input, '-loop', '1', '-i', a.logo, '-filter_complex', fc, '-map', '[v]', '-map', '0:a?',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', a.crf, '-c:a', 'copy', '-movflags', '+faststart', a.output], check=True)
    print('wrote', os.path.abspath(a.output))


if __name__ == '__main__':
    main()
