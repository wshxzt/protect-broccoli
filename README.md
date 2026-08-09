# Protect Broccoli

A tiny top-down defense game inspired by Warcraft III hero mode and Saint Seiya.

Athena loves broccoli. As **Gemini**, keep the sacred patch alive for **2 minutes**.

## Play

```bash
npm install
npm run dev
```

## Controls

- **Left-click** — move Gemini (hold to steer)
- **Double left-click** — Cosmo burst attack
- **Right-click** — Galaxian Explosion (charges every 10s)
- **WASD / Arrow keys** — move (optional)
- **Space** — basic attack (optional)
- **R** — restart after win/lose

## Current slice

- Hero-only: Gemini
- 1 broccoli patch
- 2-minute survival
- Athena sleeps on the side and wakes every 15s to heal the patch
- Easier spawn pressure; win screen shows Athena hugging the broccoli
- Broccoli grows from seedling to full plant over the 2-minute match
- Pseudo-3D presentation: perspective ground, drop shadows, depth scaling
- Pest roster: Squirrels, Aphids (fast swarms), Cabbage Worms (tanky)

## Art

Original Gold-Saint–inspired sprites live in `public/assets/` (Gemini, pests, sacred broccoli, Cosmo burst).
