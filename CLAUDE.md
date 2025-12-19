# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kineshow is a real-time multiplayer quiz system (similar to Kahoot) designed for events. Built with Node.js/Express and Socket.io for WebSocket communication. The UI is in Portuguese (pt-BR).

## Commands

```bash
npm install    # Install dependencies
npm start      # Start server on port 3000
```

No automated tests are configured.

## Architecture

**Three-Client Model:**
- **Host** (`/host.html`) - Game master control panel: creates games, manages players, advances questions
- **Display** (`/display.html`) - Projection screen: shows questions, answers, rankings, plays audio
- **Player** (`/player.html`) - Mobile-friendly participant interface: join via PIN, answer questions

**Backend** (`server.js`) - Express server with Socket.io handling room-based sessions. Games identified by 4-digit PIN. Scores calculated as `1000 * (timeRemaining / 30)` (max 1000 points per question).

**Data Flow:**
1. Host creates room → PIN generated
2. Players join via PIN or QR code
3. Host advances questions → 30-second countdown
4. Players submit answers → scores calculated based on speed
5. Results displayed → rankings updated

## Key Files

- `server.js` - All backend logic, Socket.io event handlers, game state management
- `quiz.json` - Quiz questions array with `question`, `options` (4 choices), `correct` (0-indexed), and `image` path
- `public/style.css` - Shared styles across all three interfaces
- `saves/` - Auto-saved game states (JSON files named by PIN)

## Customization

- **Questions**: Edit `quiz.json` - each question needs `question`, `options` array, `correct` index (0-3), and `image` path
- **Images**: Place in `public/assets/`, reference as `/assets/filename.ext`
- **Audio**: Replace files in `public/audios/` (end.mp3, question.mp3, suspense.mp3) and `public/audios/falas/` (fala1-5.mp3)

## Network Setup

For multi-device play, access host panel via local IP (e.g., `http://192.168.1.10:3000/host.html`) so the generated QR code uses a reachable address.
