"""Title card or end card as a 1280 x 720 PNG, with the logo. Drawn by Chrome (no extra packages but Pillow).

    py -3 cards.py title "Clip name" out.png [--brand "APP NAME"] [--by "BY YOUR COMPANY"] [--color "#1E3A5F"] [--logo file.png] [--no-logo]
    py -3 cards.py end "Thanks for watching" out.png [--sub "yourcompany.com"] [--brand ...] [--color ...] [--logo file.png] [--no-logo]
"""
import argparse, base64, html, mimetypes, os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, '..', 'assets', 'logo', 'logo.png')   # put your own logo here, or pass --logo / --no-logo
CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
           'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
NAVY = '#1E3A5F'   # default accent colour; change with --color


def page(a):
    e = html.escape
    logo = ''
    if not a.no_logo and os.path.exists(a.logo):
        mime = mimetypes.guess_type(a.logo)[0] or 'image/png'
        data = base64.b64encode(open(a.logo, 'rb').read()).decode()
        logo = f'<img src="data:{mime};base64,{data}" style="height:140px;margin-bottom:24px">'
    brand = f'<div style="font-size:22px;font-weight:700;letter-spacing:.32em;color:{a.color}">{e(a.brand)}</div>' if a.brand else ''
    head = f'{logo}{brand}<div style="width:96px;height:9px;background:{a.color};margin:26px 0 30px"></div>'
    if a.kind == 'title':
        body = f'<div style="font-size:60px;font-weight:800;max-width:1000px;line-height:1.15">{e(a.text)}</div>'
        if a.by:
            body += f'<div style="font-size:20px;margin-top:40px;letter-spacing:.3em;color:#666">{e(a.by)}</div>'
    else:
        body = f'<div style="font-size:40px;font-weight:700">{e(a.text)}</div>'
        if a.sub:
            body += f'<div style="font-size:22px;margin-top:22px;color:#555">{e(a.sub)}</div>'
    return ('<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:720px;background:#fff;display:flex;flex-direction:column;'
            f'align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;color:#1d2125;text-align:center">{head}{body}</body>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['title', 'end']); ap.add_argument('text'); ap.add_argument('out')
    ap.add_argument('--brand', default=''); ap.add_argument('--color', default=NAVY); ap.add_argument('--by', default=''); ap.add_argument('--sub', default='')
    ap.add_argument('--logo', default=LOGO); ap.add_argument('--no-logo', action='store_true')
    a = ap.parse_args()
    exe = next((c for c in CHROMES if os.path.exists(c)), None)
    if not exe:
        raise SystemExit('Chrome or Edge not found')
    out = os.path.abspath(a.out); os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        f = os.path.join(t, 'card.html'); shot = os.path.join(t, 'shot.png')
        open(f, 'w', encoding='utf-8').write(page(a))
        # taller window than the card, then cut: headless Chrome can take some height off the page. Own profile, so an open Chrome is not touched.
        subprocess.run([exe, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1280,900',
                        f'--user-data-dir={os.path.join(t, "p")}', f'--screenshot={shot}', 'file:///' + f.replace(os.sep, '/')], check=True, capture_output=True, timeout=60)
        with Image.open(shot) as im:
            im.convert('RGB').crop((0, 0, 1280, 720)).save(out)
    print('wrote', out)


if __name__ == '__main__':
    main()
