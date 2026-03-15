# 0xMerl HQ 🏢

A 3D isometric AI agent headquarters built with React + Three.js. Watch autonomous AI agents work, play, and interact in a fully interactive office environment.

![0xMerl HQ](https://img.shields.io/badge/Built%20with-Three.js-black?style=flat&logo=threedotjs)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Solana](https://img.shields.io/badge/Solana-Native-14f195?style=flat)

## Features

### 🏗️ Two-Room Office
- **Main HQ** — 6 desks with live terminal monitors, meeting table, lounge area with couches, server racks
- **Sports Room** — Pool/billiard table and ping pong table with animated balls

### 🤖 6 Autonomous AI Agents
| Agent | Role | Color |
|-------|------|-------|
| Alpha | Trader | Green |
| Bravo | DeFi Strategist | Purple |
| Charlie | Data Analyst | Cyan |
| Delta | NFT Scout | Red |
| Echo | Tx Executor | Orange |
| Foxtrot | Market Monitor | Pink |

### 🎮 Agent Behaviors
Agents autonomously cycle between activities:
- **Working at desk** — sit with live terminal showing role-specific output
- **Relaxing on sofa** — chill in the lounge area
- **Playing ping pong** — invite a partner, animated paddle swings
- **Playing billiards** — invite a partner, cue aiming animation
- **Walking around** — navigate between rooms through doorway

### 💬 Chat Commands
Click an agent's chat to command them:
- `"go to desk"` / `"work"` — send to their workstation
- `"relax"` / `"sofa"` / `"chill"` — send to couch
- `"play ping pong"` — invite a partner for table tennis
- `"play pool"` / `"billiards"` — invite a partner for billiards
- `"stand up"` / `"stop"` — interrupt any activity

### 📊 Live Displays
- **Desk monitors** — per-agent terminal output (active only when agent is seated)
- **Wall screens** — live animated trading charts (candlestick, line, volume)
- **Monitor modal** — click any desk screen to see full-size terminal view

### 🎵 Ambient Music
Procedurally generated lo-fi beats with Tone.js (toggle with volume button)

### 📷 Camera Controls
- **Left-drag** — pan
- **Right-drag** — rotate + pitch
- **Scroll** — zoom
- **Click agent** — follow mode (zoom in)

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Tech Stack
- **React 18** — UI components and state
- **Three.js** — 3D rendering, voxel agents, isometric camera
- **Tone.js** — procedural ambient music
- **Vite** — build tooling

## Architecture
```
src/
  main.jsx          — Entry point
  components/
    ClawHQ.jsx      — Main component (scene, agents, UI, logic)
```

## Inspired By
[Luke The Dev's OpenClaw Office](https://x.com/iamlukethedev)

## License
MIT

---

Built by [@solgoodmanx_](https://x.com/solgoodmanx_) | [0xMer199](https://github.com/0xMer199)
