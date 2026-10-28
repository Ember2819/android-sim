# Pixel 11 — Android simulator in the browser

A flat (non-3D) recreation of a Pixel 11 running an Android-style UI, written in plain HTML/CSS/JS. No build step, no dependencies.

## Run it
Open `index.html` directly, or serve the folder: `python3 -m http.server` → http://localhost:8000

On a phone-sized screen the bezel disappears and the sim fills the display.

## Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Unlock | swipe up, or tap the fingerprint icon | Enter |
| Home / all apps | swipe up from the bottom pill (tap pill = home) | H |
| Recents | slow swipe up and release | R |
| Back | swipe in from the left/right edge | Esc |
| Quick settings & notifications | pull down from the top (or from empty home space) | |
| Screen off / wake | side power button | P |
| Volume | side buttons | Shift+↑ / Shift+↓ |
| Home menu / app shortcuts | long-press (right-click) | |

## What's in it
Lock screen (swipe, fingerprint tap, optional PIN, always-on display), Material You theming from the wallpaper (light/dark/themed icons), launcher with pages + dock + app drawer search, notification shade with working quick-setting tiles, heads-up notifications, swipe-to-dismiss, recents with swipe-to-close, volume panel.

Apps: Phone, Contacts, Messages (simulated replies + notifications), Chrome, Camera (real webcam), Photos, Maps (OpenStreetMap), Calendar, Clock (alarms, world clock, timer, stopwatch), Calculator, Keep Notes, Weather (Open-Meteo), Settings, Play Store (install placeholder apps), Gmail (mock inbox), Files, Wallet. YouTube/Drive/Meet are placeholders that link out.

State (settings, notes, messages, alarms, photos, installed apps) is saved in `localStorage`. The reset button on the side toolbar wipes it.

## Notes
- It is a recreation, not real Android — a browser can't boot Android natively.
- Chrome loads pages in an iframe, so sites that forbid framing show blank. Searches use Wikipedia for that reason.
- There is no on-screen keyboard; text fields use your real keyboard.
- Icons are a subset of Material Symbols. After using a new icon name run `tools/build-icons.sh` to rebuild `fonts/material-symbols.woff2`.
- `tools/cdp.mjs` is a tiny headless-Chromium driver used for smoke tests.
