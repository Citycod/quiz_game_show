const config = require('./config.json');

class GameEngine {
    constructor() {
        this.gameState = {
            currentRound: 0,
            roundStartTime: null,
            questionStartTime: null,
            currentQuestion: null,
            players: {
                1: {
                    score: 0,
                    streak: 0,
                    penalties: 0,
                    answer: null,
                    answerLocked: false,
                    lifelineUsed: null,
                    lifelineActive: null
                },
                2: {
                    score: 0,
                    streak: 0,
                    penalties: 0,
                    answer: null,
                    answerLocked: false,
                    lifelineUsed: null,
                    lifelineActive: null
                }
            },
            gameStatus: 'waiting', // waiting, playing, paused, suddenDeath, finished
            revealPending: false,
            eliminatedOptions: {}
        };

        this.config = config;
        this.responseLogs = [];
    }

    // Start a new round
    startRound(roundNumber) {
        if (roundNumber < 1 || roundNumber > 3) {
            throw new Error('Invalid round number. Must be 1, 2, or 3.');
        }

        this.gameState.currentRound = roundNumber;
        this.gameState.roundStartTime = Date.now();
        this.gameState.gameStatus = 'playing';

        console.log(`🎮 Round ${roundNumber} started`);
        return this.getCurrentRoundConfig();
    }

    // Start sudden death mode
    startSuddenDeath() {
        this.gameState.currentRound = 4; // Special round number for sudden death
        this.gameState.gameStatus = 'suddenDeath';
        this.gameState.roundStartTime = Date.now();

        // Reset lifelines for sudden death (not allowed)
        this.gameState.players[1].lifelineActive = null;
        this.gameState.players[2].lifelineActive = null;

        console.log('💀 SUDDEN DEATH MODE ACTIVATED');
        return this.config.suddenDeath;
    }

    // Load a new question
    loadQuestion(questionData) {
        this.gameState.currentQuestion = questionData;
        this.gameState.questionStartTime = Date.now();
        this.gameState.players[1].answer = null;
        this.gameState.players[1].answerLocked = false;
        this.gameState.players[2].answer = null;
        this.gameState.players[2].answerLocked = false;
        this.gameState.revealPending = false;
        this.gameState.eliminatedOptions = {};

        return questionData;
    }

    // Player submits an answer
    submitAnswer(playerId, answer) {
        const player = this.gameState.players[playerId];

        if (!player) {
            throw new Error('Invalid player ID');
        }

        if (player.answerLocked) {
            return { success: false, message: 'Answer already locked' };
        }

        player.answer = answer.toUpperCase();
        player.answerLocked = true;
        player.answerTime = Date.now();

        // Check if both players have answered
        const bothAnswered = this.gameState.players[1].answerLocked &&
            this.gameState.players[2].answerLocked;

        if (bothAnswered && this.config.dramaticReveal.enabled) {
            this.gameState.revealPending = true;
        }

        return {
            success: true,
            bothAnswered,
            revealPending: this.gameState.revealPending
        };
    }

    // Activate a lifeline
    activateLifeline(playerId, lifelineType) {
        const player = this.gameState.players[playerId];

        if (!this.config.lifelines.enabled) {
            return { success: false, message: 'Lifelines are disabled' };
        }

        if (this.gameState.gameStatus === 'suddenDeath') {
            return { success: false, message: 'No lifelines in Sudden Death' };
        }

        if (player.lifelineUsed) {
            return { success: false, message: 'Lifeline already used' };
        }

        if (!this.config.lifelines.types.includes(lifelineType)) {
            return { success: false, message: 'Invalid lifeline type' };
        }

        player.lifelineUsed = lifelineType;
        player.lifelineActive = lifelineType;

        let result = { success: true, type: lifelineType };

        // Handle 50/50 - eliminate 2 wrong answers
        if (lifelineType === '50/50' && this.gameState.currentQuestion) {
            const correctAnswer = this.gameState.currentQuestion.correctAnswer;
            const options = ['A', 'B', 'C', 'D'];
            const wrongOptions = options.filter(opt => opt !== correctAnswer);

            // Randomly select 2 wrong options to eliminate
            const toEliminate = [];
            for (let i = 0; i < 2 && wrongOptions.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * wrongOptions.length);
                toEliminate.push(wrongOptions.splice(randomIndex, 1)[0]);
            }

            this.gameState.eliminatedOptions[playerId] = toEliminate;
            result.eliminatedOptions = toEliminate;
        }

        console.log(`🎯 Player ${playerId} activated ${lifelineType}`);
        return result;
    }

    // Process answers and calculate scores
    processAnswers(correctAnswer) {
        const results = {
            player1: { correct: false, points: 0, streakBroken: false },
            player2: { correct: false, points: 0, streakBroken: false }
        };

        const roundConfig = this.getCurrentRoundConfig();

        [1, 2].forEach(playerId => {
            const player = this.gameState.players[playerId];
            const isCorrect = player.answer === correctAnswer;
            const playerResult = results[`player${playerId}`];

            playerResult.correct = isCorrect;

            if (isCorrect) {
                // Increase streak
                player.streak++;

                // Calculate base points
                let points = roundConfig.pointsPerQuestion;

                // Apply lifeline: Double Points
                if (player.lifelineActive === 'Double Points') {
                    points *= 2;
                    player.lifelineActive = null; // Consume the lifeline
                }

                // Apply streak multiplier
                const multiplier = this.getStreakMultiplier(player.streak);
                points = Math.floor(points * multiplier);

                player.score += points;
                playerResult.points = points;
                playerResult.multiplier = multiplier;
                playerResult.streak = player.streak;

            } else {
                // Wrong answer
                if (player.streak > 0) {
                    playerResult.streakBroken = true;
                    playerResult.previousStreak = player.streak;
                }
                player.streak = 0;

                // Apply penalty
                const penalty = roundConfig.penalty || 0;
                player.score = Math.max(0, player.score - penalty);
                player.penalties += penalty;
                playerResult.penalty = penalty;

                // Clear active lifeline
                player.lifelineActive = null;
            }
        });

        // Log the response
        this.logResponse(correctAnswer, results);

        return results;
    }

    // Get streak multiplier
    getStreakMultiplier(streak) {
        const multipliers = this.config.streakMultipliers;

        if (streak >= multipliers.level2.streak) {
            return multipliers.level2.multiplier;
        } else if (streak >= multipliers.level1.streak) {
            return multipliers.level1.multiplier;
        }

        return 1.0;
    }

    // Check for sudden death condition
    shouldEnterSuddenDeath() {
        if (!this.config.suddenDeath.enabled) return false;
        if (this.gameState.currentRound !== 3) return false;

        return this.gameState.players[1].score === this.gameState.players[2].score;
    }

    // Check sudden death winner
    getSuddenDeathWinner() {
        if (this.gameState.gameStatus !== 'suddenDeath') return null;

        const p1Correct = this.gameState.players[1].answer === this.gameState.currentQuestion.correctAnswer;
        const p2Correct = this.gameState.players[2].answer === this.gameState.currentQuestion.correctAnswer;

        if (!p1Correct && p2Correct) return 2;
        if (p1Correct && !p2Correct) return 1;

        return null; // Both correct or both wrong, continue
    }

    // Get current round configuration
    getCurrentRoundConfig() {
        if (this.gameState.gameStatus === 'suddenDeath') {
            return this.config.suddenDeath;
        }

        const roundIndex = this.gameState.currentRound - 1;
        return this.config.rounds[roundIndex];
    }

    // Get game state
    getGameState() {
        return this.gameState;
    }

    // Get player scores
    getScores() {
        return {
            player1: {
                score: this.gameState.players[1].score,
                streak: this.gameState.players[1].streak,
                penalties: this.gameState.players[1].penalties,
                lifelineUsed: this.gameState.players[1].lifelineUsed
            },
            player2: {
                score: this.gameState.players[2].score,
                streak: this.gameState.players[2].streak,
                penalties: this.gameState.players[2].penalties,
                lifelineUsed: this.gameState.players[2].lifelineUsed
            }
        };
    }

    // Pause game
    pauseGame() {
        this.gameState.gameStatus = 'paused';
    }

    // Resume game
    resumeGame() {
        this.gameState.gameStatus = 'playing';
    }

    // Reset game
    resetGame() {
        this.gameState = {
            currentRound: 0,
            roundStartTime: null,
            questionStartTime: null,
            currentQuestion: null,
            players: {
                1: { score: 0, streak: 0, penalties: 0, answer: null, answerLocked: false, lifelineUsed: null, lifelineActive: null },
                2: { score: 0, streak: 0, penalties: 0, answer: null, answerLocked: false, lifelineUsed: null, lifelineActive: null }
            },
            gameStatus: 'waiting',
            revealPending: false,
            eliminatedOptions: {}
        };
        this.responseLogs = [];
    }

    // Log response
    logResponse(correctAnswer, results) {
        this.responseLogs.push({
            timestamp: new Date().toISOString(),
            round: this.gameState.currentRound,
            question: this.gameState.currentQuestion,
            correctAnswer,
            player1: {
                answer: this.gameState.players[1].answer,
                correct: results.player1.correct,
                points: results.player1.points
            },
            player2: {
                answer: this.gameState.players[2].answer,
                correct: results.player2.correct,
                points: results.player2.points
            }
        });
    }

    // Get response logs
    getResponseLogs() {
        return this.responseLogs;
    }
}

module.exports = GameEngine;
