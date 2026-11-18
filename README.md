# ORBITAL® // FOCUS — Apsis

Aesthetic NASA telemetry & deep-work station. Live space data drives a
cinematic focus timer — Off-White™ industrial typography meets Co–Star
minimalism on an ISS Cupola flight deck.

## Mission Profiles

| Mode | Feed | Visual |
| --- | --- | --- |
| `ASTEROID HITCHHIKER` | NeoWs — today's near-Earth objects | Procedural faceted 3D asteroid, starfield, bloom + film grain |
| `DEEP SPACE DRIFT` | APOD — last 7 days | Full-bleed HD imagery, Ken Burns pan, vignette |
| `ORBITAL CUPOLA` | EPIC — full-disc Earth | ISS Cupola window, reticle, timestamp crossfades |
| `SOLAR TELEMETRY` | DONKI — flares + Kp index | Generative GLSL plasma orb; calm indigo → storm crimson |

## Stack

- Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4
- `three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`
- `framer-motion` · `lucide-react` · `html-to-image`
- Web Audio API procedural synth (drone, brown noise, cabin static, UI clicks — zero audio assets)

## Features

- Pomodoro 25 / Deep Work 50 / Ultradian 90 / custom minutes, timestamp-accurate clock
- `H` — zen mode (hides every panel, keeps the timer + scene)
- `Space` — ignite / hold · `Esc` — close overlays
- **Flight Plan** — waypoint task list (`WP-01…`), persisted to `localStorage`
- **Boarding Pass** — post-session specimen artifact with real travelled-distance
  telemetry, SVG barcode, 1:1 / 9:16 export via `html-to-image`
- HUD telemetry with scramble-decrypt readouts; `UPLINK LIVE` / `ARCHIVE CACHE`
  status chips per feed

## NASA API layer

`/api/nasa/{neows,apod,epic,donki}` — server-side routes with
`revalidate: 3600` caching and realistic fallback archives, so the app works
instantly offline and never breaks on rate limits.

```bash
NASA_API_KEY=your_key   # optional — falls back to DEMO_KEY
```

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (clean: 0 errors / 0 warnings)
npm run lint    # eslint — clean
```

Data: NASA Open APIs (NeoWs · APOD · EPIC · DONKI). Not affiliated with NASA.
