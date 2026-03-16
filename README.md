# 🎮 Quiz Game Show Engine

A premium, real-time, multi-display quiz game show platform powered by Node.js and Socket.io. Designed for live events, classrooms, or corporate team building.

![Quiz Game Show](https://img.shields.io/badge/Status-Complete-success?style=for-the-badge)
![Socket.io](https://img.shields.io/badge/Protocol-Socket.io-010101?style=for-the-badge&logo=socket.io)

## 🏗️ System Architecture

The engine uses a synchronized multi-interface architecture where every participant has a specialized role-based view.

- **The Hub (Backend):** Node.js server coordinating real-time state broadcasts.
- **Admin Panel:** The host's control center to manage rounds, timers, and lifelines.
- **Player Pads:** Mobile-controllable interfaces for contestants.
- **Audience Display:** The main cinematic screen showing questions, animations, and results.
- **Scoreboard:** A dedicated live ranking screen.

## 🚀 Key Features

- **Real-time Synchronization:** Zero-latency updates across all connected devices using WebSockets.
- **Advanced Scoring:** Includes streak multipliers (1.5x for 3 accurate answers, 2x for 5).
- **Contestant Lifelines:** Supports `50/50`, `Double Points`, and `Time Freeze`.
- **Sudden Death Mode:** Automated tie-breaker logic for high-stakes finishes.
- **Dynamic Question Loading:** Bulk upload questions via a simple CSV format.
- **Premium Aesthetics:** Modern glassmorphism UI with animated backgrounds and haptic-like interactions.

## 🛠️ Quick Start

### 1. Installation
```bash
git clone https://github.com/Citycod/quiz_game_show.git
cd quiz_game_show
npm install
```

### 2. Run Locally
```bash
npm start
```

### 3. Access Interfaces
- **Portal (Landing Page):** `http://localhost:3000`
- **Host Dashboard:** `/admin`
- **Player Controllers:** `/player/1` and `/player/2`
- **Main Display:** `/display/question`

## 📊 Configuration

Modify `config.json` to customize:
- Point values per round.
- Question durations.
- Penalty amounts for wrong answers.
- Lifeline availability.

## 📝 Question Data
The system loads questions from `questions-sample.csv`. The format follows:
`question,optionA,optionB,optionC,optionD,correctAnswer`

---
Built with ❤️ for high-stakes competition.
