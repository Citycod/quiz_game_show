const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameEngine = require('./game-engine');
const QuestionManager = require('./question-manager');
const config = require('./config.json');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Initialize game components
const gameEngine = new GameEngine();
const questionManager = new QuestionManager();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes for different displays
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/display/question', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display', 'question.html'));
});

app.get('/display/scoreboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display', 'scoreboard.html'));
});

app.get('/player/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player', 'pad.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Track connected clients
const connectedClients = {
    questionDisplay: [],
    scoreboard: [],
    players: {},
    admin: []
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Client identifies itself
    socket.on('identify', (data) => {
        const { type, playerId } = data;

        switch (type) {
            case 'question-display':
                connectedClients.questionDisplay.push(socket.id);
                console.log('📺 Question display connected');
                break;
            case 'scoreboard':
                connectedClients.scoreboard.push(socket.id);
                console.log('📊 Scoreboard connected');
                break;
            case 'player':
                if (!connectedClients.players[playerId]) {
                    connectedClients.players[playerId] = [];
                }
                connectedClients.players[playerId].push(socket.id);
                console.log(`🎮 Player ${playerId} pad connected`);
                // Send current game state to player
                socket.emit('game-state', gameEngine.getGameState());
                break;
            case 'admin':
                connectedClients.admin.push(socket.id);
                console.log('⚙️ Admin panel connected');
                // Send current state to admin
                socket.emit('game-state', gameEngine.getGameState());
                socket.emit('scores', gameEngine.getScores());
                break;
        }
    });

    // Admin: Start round
    socket.on('start-round', (roundNumber) => {
        try {
            const roundConfig = gameEngine.startRound(roundNumber);
            io.emit('round-started', { round: roundNumber, config: roundConfig });

            // Load first question
            const question = questionManager.getNextQuestion();
            if (question) {
                gameEngine.loadQuestion(question);
                io.emit('new-question', question);
                io.emit('timer-start', { duration: roundConfig.questionDuration });
            }

            console.log(`🎬 Round ${roundNumber} started by admin`);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Load questions from CSV
    socket.on('load-questions-csv', async (filePath) => {
        try {
            await questionManager.loadFromCSV(filePath);
            socket.emit('questions-loaded', {
                count: questionManager.getTotalQuestions()
            });
            io.to(connectedClients.admin).emit('questions-loaded', {
                count: questionManager.getTotalQuestions()
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Add question manually
    socket.on('add-question', (questionData) => {
        try {
            const question = questionManager.addQuestion(questionData);
            socket.emit('question-added', question);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Next question
    socket.on('next-question', () => {
        const question = questionManager.getNextQuestion();
        if (question) {
            gameEngine.loadQuestion(question);
            io.emit('new-question', question);

            const roundConfig = gameEngine.getCurrentRoundConfig();
            io.emit('timer-start', { duration: roundConfig.questionDuration });
        } else {
            // No more questions, check for sudden death or end round
            if (gameEngine.shouldEnterSuddenDeath()) {
                gameEngine.startSuddenDeath();
                io.emit('sudden-death-start');
                // Load a question for sudden death
                questionManager.reset();
                const sdQuestion = questionManager.getNextQuestion();
                if (sdQuestion) {
                    gameEngine.loadQuestion(sdQuestion);
                    io.emit('new-question', sdQuestion);
                    io.emit('timer-start', { duration: config.suddenDeath.questionDuration });
                }
            } else {
                io.emit('round-ended', {
                    round: gameEngine.getGameState().currentRound,
                    scores: gameEngine.getScores()
                });
            }
        }
    });

    // Player: Submit answer
    socket.on('submit-answer', (data) => {
        const { playerId, answer } = data;

        try {
            const result = gameEngine.submitAnswer(playerId, answer);

            // Confirm to player
            socket.emit('answer-submitted', { success: true });

            // Update admin
            io.to(connectedClients.admin).emit('player-answered', {
                playerId,
                answered: true
            });

            // If both players answered and dramatic reveal is enabled
            if (result.bothAnswered && result.revealPending) {
                // Trigger dramatic reveal sequence
                setTimeout(() => {
                    io.emit('reveal-start');

                    // After reveal delay, show results
                    setTimeout(() => {
                        const correctAnswer = questionManager.getCorrectAnswer(
                            gameEngine.getGameState().currentQuestion.id
                        );
                        const results = gameEngine.processAnswers(correctAnswer);

                        io.emit('reveal-results', {
                            correctAnswer,
                            player1: {
                                answer: gameEngine.getGameState().players[1].answer,
                                ...results.player1
                            },
                            player2: {
                                answer: gameEngine.getGameState().players[2].answer,
                                ...results.player2
                            }
                        });

                        // Update scores
                        io.emit('scores-update', gameEngine.getScores());

                        // Check for sudden death winner
                        if (gameEngine.getGameState().gameStatus === 'suddenDeath') {
                            const winner = gameEngine.getSuddenDeathWinner();
                            if (winner) {
                                io.emit('game-over', {
                                    winner,
                                    finalScores: gameEngine.getScores()
                                });
                            }
                        }

                    }, config.dramaticReveal.delaySeconds * 1000);
                }, 100);
            }

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Player: Activate lifeline
    socket.on('activate-lifeline', (data) => {
        const { playerId, lifelineType } = data;

        try {
            const result = gameEngine.activateLifeline(playerId, lifelineType);

            if (result.success) {
                // Notify player
                socket.emit('lifeline-activated', result);

                // Notify all displays
                io.emit('lifeline-used', {
                    playerId,
                    lifelineType,
                    eliminatedOptions: result.eliminatedOptions
                });

                // Update scoreboard
                io.to(connectedClients.scoreboard).emit('scores-update', gameEngine.getScores());

                console.log(`🎯 Player ${playerId} used ${lifelineType}`);
            } else {
                socket.emit('lifeline-error', { message: result.message });
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Pause game
    socket.on('pause-game', () => {
        gameEngine.pauseGame();
        io.emit('game-paused');
        console.log('⏸️ Game paused');
    });

    // Admin: Resume game
    socket.on('resume-game', () => {
        gameEngine.resumeGame();
        io.emit('game-resumed');
        console.log('▶️ Game resumed');
    });

    // Admin: Reset game
    socket.on('reset-game', () => {
        gameEngine.resetGame();
        questionManager.reset();
        io.emit('game-reset');
        console.log('🔄 Game reset');
    });

    // Admin: Get response logs
    socket.on('get-logs', () => {
        socket.emit('response-logs', gameEngine.getResponseLogs());
    });

    // Timer expired
    socket.on('timer-expired', () => {
        // Process answers even if not both answered
        const correctAnswer = questionManager.getCorrectAnswer(
            gameEngine.getGameState().currentQuestion.id
        );

        // Auto-submit null answers for players who didn't answer
        const gameState = gameEngine.getGameState();
        if (!gameState.players[1].answerLocked) {
            gameEngine.submitAnswer(1, '');
        }
        if (!gameState.players[2].answerLocked) {
            gameEngine.submitAnswer(2, '');
        }

        const results = gameEngine.processAnswers(correctAnswer);

        io.emit('reveal-results', {
            correctAnswer,
            player1: {
                answer: gameState.players[1].answer || 'No Answer',
                ...results.player1
            },
            player2: {
                answer: gameState.players[2].answer || 'No Answer',
                ...results.player2
            }
        });

        io.emit('scores-update', gameEngine.getScores());
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);

        // Remove from tracking
        connectedClients.questionDisplay = connectedClients.questionDisplay.filter(id => id !== socket.id);
        connectedClients.scoreboard = connectedClients.scoreboard.filter(id => id !== socket.id);
        connectedClients.admin = connectedClients.admin.filter(id => id !== socket.id);

        Object.keys(connectedClients.players).forEach(playerId => {
            connectedClients.players[playerId] = connectedClients.players[playerId].filter(id => id !== socket.id);
        });
    });
});

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🎮 QUIZ GAME SHOW SERVER RUNNING 🎮                ║
║                                                            ║
║  Server: http://localhost:${PORT}                            ║
║                                                            ║
║  📺 Question Display:  http://localhost:${PORT}/display/question   ║
║  📊 Scoreboard:        http://localhost:${PORT}/display/scoreboard ║
║  🎮 Player 1 Pad:      http://localhost:${PORT}/player/1           ║
║  🎮 Player 2 Pad:      http://localhost:${PORT}/player/2           ║
║  ⚙️  Admin Panel:       http://localhost:${PORT}/admin             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
