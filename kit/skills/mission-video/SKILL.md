---
name: mission-video
description: Make or update a narrated video for any app - write the script, make the Kokoro voice, make the background music, put the logo on title cards and in the corner, and join it all into one MP4. Use whenever the owner asks for a video, a clip, an intro, a tutorial, a voice-over, "làm video", "kịch bản", "giọng đọc", "nhạc nền", "chèn logo", or wants new lines added to an existing video, even if only one of those parts is needed.
---

# Make a video

The project owner may have no IT background. Reply in **Vietnamese**, short and plain, English only for technical terms.
Show the owner the script and wait for their OK before making the voice and the picture: a change of words after that costs a full re-run.

Read the app's own `CLAUDE.md` first. It may have rules for its videos (names not to show, a recorder of its own), and those win over this file.

## What is in this skill

| Part | File | Read it when |
|---|---|---|
| Script | `references/script.md` | Writing or changing the words |
| Voice | `scripts/say.py`, `references/voice.md` | Making narration, or a word sounds wrong |
| Music | `scripts/synth.py`, `references/music.md` | Changing the music or mixing it by hand |
| Logo files | `assets/logo/` | Put your own logo at `assets/logo/logo.png` (the default), or pass `--logo <file>`. Cards work without a logo |
| Title and end cards | `scripts/cards.py` | Every clip with a title card |
| Joining everything | `scripts/assemble.py` | Making the finished video |
| Logo in the corner | `scripts/add_logo.py` | The owner wants the logo on the footage |

Paths in this file start at this skill's folder. Run the scripts with `py -3` on Windows (plain `python` is the Windows Store stub). Work in a folder that git ignores, because media files stay in git history forever.

## The steps

1. **Script.** Write it as in `references/script.md`, save it with the app's documents. Get the owner's OK.
2. **Voice.** `py -3 scripts/say.py <work> --script <script>.md` (English, Kokoro). Vietnamese: add `--engine edge` for the Edge female voice vi-VN-HoaiMyNeural. Prints the seconds of speech. Lines that did not change are not made again, so a one-word fix is quick.
3. **Pictures.** One per line, named by the line: `<work>/pictures/1.1.png`, `.jpg` or `.mp4`. Use footage or stills from the owner, or screenshots of the real app, so that what is on screen is true.
4. **Cards (optional).** `py -3 scripts/cards.py title "Clip name" <work>/cards/title.png --brand "APP NAME"` and `py -3 scripts/cards.py end "Thanks for watching" <work>/cards/end.png`.
5. **Join.** `py -3 scripts/assemble.py <work>` writes `<work>/video.mp4` with the voice and the music under it.
6. **Logo on the footage (when asked).** `py -3 scripts/add_logo.py <work>/video.mp4 out.mp4 --from 2`. `--from` leaves the title card clean, because the card already has the logo.
7. **Check.** Look at one frame near the start, middle and end, and ask the owner to listen, because Claude cannot hear the result. Sound should be -16 LUFS.

## House rules

- Use the units and locale the owner sets (default: metric).
- Music is only what `synth.py` makes, so there is never a licence question.
- Nothing is published without the owner's yes.
