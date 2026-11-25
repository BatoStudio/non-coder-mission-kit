# Writing the script

## Format

```markdown
# Name of the video, script (date)
Target length. Voice, music, what must not be shown.

## 1. Open
- 1.1 — This is the app, by our company.

## 2. Getting started
- 2.1 — Press New, and give the project a name.
```

`say.py` reads only the lines of the form `- 1.1 — words` (number, space, long dash, space). Headings and recording notes can sit between them; they are not read aloud.

## Length

The voice reads about **3.3 words a second** (measured on 53 lines of real narration: 1013 words, 307 s). Each line also takes 1.3 s of breathing room (0.4 s before, 0.9 s after).

Length of a video in seconds is about words / 3.3 + lines x 1.3, plus 2 for a title card and 1.5 for an end card. Do this sum before showing the owner the draft.

## Three layers from one set of scenes

| Layer | Length | Use |
|---|---|---|
| A, Introduction | about 1:20 | Sent to customers; own shorter words, cut from the scenes |
| B, Topic clips | 0:20 to 0:50 | One task each, same words as C, title card and end card |
| C, Full tour | 4 to 5 minutes | Training new people, in chapters |

Ask the owner which layers they want. Making C first gives the scenes and voice files for the other two.

## How the lines should sound

- One action per line, in the order it happens on the screen. The picture is timed to the words.
- Start from what the user needs, then name the button.
- Say the name of a button exactly as the app shows it.
- Short sentences. Commas give the voice its pauses, so use them where a person would breathe.
- Do not write a figure the picture will not show.
- Before writing a line about a feature, check that the app still works that way.
