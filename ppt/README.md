# VoiceFlare pitch deck

Open `voiceflare_pitch.html` in Chrome, from disk or from a copy of this folder. All paths are relative.

- Move: arrow keys, Space, Page Up and Page Down, Home and End, a click on the slide, or the dots.
- `N`: speaker notes, with a target time per slide. The talk runs 3:00 plus the demo, and `T` restarts the clock.
- `F`: fullscreen.
- `#5` in the URL opens slide 5. The hash updates as you move, so a screenshot can name its slide.
- The slides sit on a fixed 1600 x 900 stage that scales to fit any screen, with letterboxing.

## Assets (`assets/`)

| File | Used on | If missing |
| --- | --- | --- |
| `demo.mp4` | 8, the demo video | The video hides and a screenshot shows instead, with "Live: open /board?autoplay=1" |
| `shot-autoplay.png` | 8, the video fallback | Falls back to `shot-board.png`, then `board.png` |
| `shot-board.png` | 8, the video fallback when `shot-autoplay.png` is missing: the board with its new left sidebar | Falls back to `board.png` |
| `shot-live-location.png` | 9, the response team map | A labeled illustration |
| `shot-helper.png` | 9, the helper's phone (a portrait shot fits best) | A labeled illustration |
| `shot-blocks.png` | 10, block-by-block evacuation in waves on assigned exit roads | A labeled illustration of blocks in three waves |
| `shot-heat.png` | 11, the dual-use slide: heat check-ins for older residents | A labeled illustration of neighborhoods by heat and a cooling center |
| `shot-landing.png` | 13, the landing page | The logo plus "Start at /" |

The 16:9 frames use `object-fit: contain`, so a screenshot of any shape shows in full.

The fonts (Saira, Geist) load from Google Fonts. Local copies in `assets/fonts/` cover offline use.
