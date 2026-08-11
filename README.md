# Protect Broccoli

A tiny top-down defense game inspired by Warcraft III hero mode and Saint Seiya.

Athena loves broccoli. Pick a **Gold Saint** and keep the sacred patch alive for **2 minutes**.

## Play

```bash
npm install
npm run dev
```

## Controls

- **Left-click** — move (hold to steer)
- **Double left-click** — Cosmo burst attack
- **Right-click** — Gold Saint special (charges every 10s)
- **WASD / Arrow keys** — move (optional)
- **Space** — basic attack (optional)
- **R** — restart after win/lose

## Current slice

- All 12 Gold Saints on the select screen (zodiac order), each with a unique special
- 1 broccoli patch
- 2-minute survival
- Athena sleeps on the side and wakes every 15s to heal the patch
- Broccoli grows from seedling to full plant over the 2-minute match
- Pseudo-3D presentation: perspective ground, drop shadows, depth scaling, walk bob
- Pest roster: Squirrels, Aphids (fast swarms), Cabbage Worms (tanky)

## Art

Original Gold-Saint–inspired sprites live in `public/assets/` (12 saints, pests, sacred broccoli, Cosmo burst).
