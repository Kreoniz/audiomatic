# Audiomatic

A responsive, browser-only orbital clock for creating generative audiovisual performances and saving them as videos.

## What is included

- Perpetual concentric motion with tempo-locked orbital periods and gentle phase drift
- Strict audiovisual causality: every note begins on a visible threshold crossing
- The inner sphere advances harmony and bass; outer spheres play the melody
- Adjustable key, scale, progression, rhythm, warmth, space, and note length
- Threshold-driven Web Audio synthesis
- Luminous, tactile, and editorial art directions
- Curated energy, density, trail, scale, and sound controls
- Local settings persistence
- Browser-side WebM recording with live audio
- Responsive desktop and mobile layouts
- Static GitHub Pages deployment

## Local development

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Hosting

The application has no backend requirements. Enable GitHub Pages with **GitHub Actions** as the publishing source; pushes to `main` will build and deploy the site.

For the most consistent recording support, use a current Chromium-based browser. Recording is performed locally and no media is uploaded.
