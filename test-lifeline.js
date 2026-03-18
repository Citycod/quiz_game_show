const path = require('path');
const GameEngine = require('./game-engine');

const engine = new GameEngine();

// Manually override config for testing
engine.config = {
    rounds: [
        { name: "Round 1", pointsPerQuestion: 10, penalty: 0, questionDuration: 10 }
    ],
    speedBonus: { enabled: true, thresholdSeconds: 5, maxBonus: 5 },
    streakMultipliers: {
        level1: { streak: 3, multiplier: 1.5 },
        level2: { streak: 5, multiplier: 2.0 }
    },
    lifelines: { enabled: true, types: ["50/50", "Double Points"] },
    dramaticReveal: { enabled: true }
};

console.log("--- Test: Double Points Lifeline (Functional) ---");

// Set up question
const question = { id: "q1", question: "Test?", options: { A: "Yes", B: "No" } };
engine.loadQuestion(question, "A");

// Player 1 uses Double Points
console.log("Activating Double Points for P1...");
const activation = engine.activateLifeline(1, "Double Points");
console.log("Activation result:", activation);

// Setup answer timing (no speed bonus)
const startTime = Date.now();
engine.gameState.questionStartTime = startTime;
engine.gameState.players[1].answerTime = startTime + 6000; // 6s > threshold 5s
engine.gameState.players[2].answerTime = startTime + 6000;

// Submit answers
engine.submitAnswer(1, "A");
engine.submitAnswer(2, "A");

// Process
const results = engine.processAnswers("A");

console.log("P1 Points:", results.player1.points);
console.log("P2 Points:", results.player2.points);

if (results.player1.points === 20 && results.player2.points === 10) {
    console.log("✅ SUCCESS: Double Points applied (10 * 2 = 20 vs 10)");
} else {
    console.log("❌ FAILURE: Points not as expected.");
}

console.log("--- End Test ---");
