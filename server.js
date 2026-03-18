require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameEngine = require('./game-engine');
const QuestionManager = require('./question-manager');
const GrokService = require('./grok-service');
const config = require('./config.json');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Initialize game components
const gameEngine = new GameEngine();
const questionManager = new QuestionManager();
const grokService = new GrokService();

// Runtime settings (can be changed by admin during the game)
const runtimeSettings = {
    questionDuration: config.rounds[0].questionDuration,
    autoAdvanceDelay: 5,
    revealDelay: config.dramaticReveal.delaySeconds,
    schoolLevel: 'junior' // Default
};

let globalSchoolLevel = 'junior';

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

// Helper: broadcast player connection status to admins
function broadcastPlayerStatus() {
    const status = {
        1: connectedClients.players[1] && connectedClients.players[1].length > 0,
        2: connectedClients.players[2] && connectedClients.players[2].length > 0
    };
    connectedClients.admin.forEach(adminSocketId => {
        io.to(adminSocketId).emit('player-connection-status', status);
    });
}

// Helper: auto-advance to next question
function autoAdvanceNextQuestion() {
    const currentRound = gameEngine.getGameState().currentRound;
    const question = questionManager.getNextQuestion(currentRound);
    
    if (question) {
        gameEngine.loadQuestion(question);
        io.emit('new-question', question);

        // Use runtime duration or round config
        const roundConfig = gameEngine.getCurrentRoundConfig();
        const duration = runtimeSettings.questionDuration || roundConfig.questionDuration;
        io.emit('timer-start', { duration });
    } else {
        // No more questions for this round
        if (gameEngine.shouldEnterSuddenDeath()) {
            gameEngine.startSuddenDeath();
            io.emit('sudden-death-start');
            questionManager.reset(5); // Reset sudden death round (round 5)
            const sdQuestion = questionManager.getNextQuestion(5);
            if (sdQuestion) {
                gameEngine.loadQuestion(sdQuestion);
                io.emit('new-question', sdQuestion);
                io.emit('timer-start', { duration: config.suddenDeath.questionDuration });
            }
        } else {
            io.emit('round-ended', {
                round: currentRound,
                scores: gameEngine.getScores()
            });
        }
    }
}

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
                // Notify admins of player connection
                broadcastPlayerStatus();
                break;
            case 'admin':
                connectedClients.admin.push(socket.id);
                console.log('⚙️ Admin panel connected');
                // Send current state to admin
                socket.emit('game-state', gameEngine.getGameState());
                socket.emit('scores', gameEngine.getScores());
                socket.emit('settings-sync', runtimeSettings);
                // Send current player connection status
                broadcastPlayerStatus();
                break;
        }
    });

    // Player: Set their display name before game starts
    socket.on('join-game', (data) => {
        const { playerId, name } = data;
        try {
            const displayName = gameEngine.setPlayerName(playerId, name);
            // Broadcast name update to ALL clients
            io.emit('player-name-update', { playerId, name: displayName });
            console.log(`🏷️ Player ${playerId} set name to: ${displayName}`);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Start round
    socket.on('start-round', (roundNumber) => {
        try {
            const roundConfig = gameEngine.startRound(roundNumber);
            // Update runtime duration from round config
            runtimeSettings.questionDuration = roundConfig.questionDuration;
            io.emit('round-started', { round: roundNumber, config: roundConfig });
            io.emit('settings-sync', runtimeSettings);

            // Load first question for THIS round
            questionManager.reset(roundNumber);
            const question = questionManager.getNextQuestion(roundNumber);
            if (question) {
                gameEngine.loadQuestion(question);
                io.emit('new-question', question);
                io.emit('timer-start', { duration: runtimeSettings.questionDuration });
            }

            console.log(`🎬 Round ${roundNumber} started by admin`);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Load questions from CSV
    socket.on('load-questions-csv', async (data) => {
        try {
            const filePath = typeof data === 'string' ? data : data.path;
            const round = data.round || 1;
            await questionManager.loadFromCSV(filePath, round);
            io.emit('questions-loaded', {
                count: questionManager.getTotalQuestions(),
                roundCount: questionManager.getRoundQuestionCount(round),
                round: round
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Load Academic Questions (Legacy event name for compatibility)
    socket.on('load-waec-questions', (data) => {
        try {
            const roundRequest = (data && data.round) ? data.round : '1';
            const level = (data && data.schoolLevel) ? data.schoolLevel : globalSchoolLevel;
            const fs = require('fs');
            
            // Choose file based on level
            const fileName = level === 'junior' ? 'junior-questions.json' : 'waec-questions.json';
            const filePath = path.join(__dirname, fileName);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`File ${fileName} not found.`);
            }

            const fileData = fs.readFileSync(filePath, 'utf8');
            const allQuestions = JSON.parse(fileData);
            
            if (roundRequest === 'all') {
                // Load all 61 questions (Rounds 1-4)
                questionManager.reset(); // Full reset
                const rounds = [1, 2, 3, 4];
                let totalLoaded = 0;

                rounds.forEach(r => {
                    const filtered = allQuestions.filter(q => q.round === r);
                    // Shuffle before adding
                    for (let i = filtered.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
                    }
                    filtered.forEach(q => questionManager.addQuestion(q, r));
                    totalLoaded += filtered.length;
                    
                    io.emit('questions-loaded', {
                        count: questionManager.getTotalQuestions(),
                        roundCount: filtered.length,
                        round: r,
                        level: level
                    });
                });

                console.log(`📚 Loaded FULL GAME (${totalLoaded} questions) for ${level.toUpperCase()} level.`);
            } else {
                const round = parseInt(roundRequest);
                const filteredQuestions = allQuestions.filter(q => q.round === round);
                
                for (let i = filteredQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filteredQuestions[i], filteredQuestions[j]] = [filteredQuestions[j], filteredQuestions[i]];
                }

                questionManager.reset(round);
                filteredQuestions.forEach(q => questionManager.addQuestion(q, round));
                
                io.emit('questions-loaded', {
                    count: questionManager.getTotalQuestions(),
                    roundCount: filteredQuestions.length,
                    round: round,
                    level: level
                });
                console.log(`📚 Loaded ${filteredQuestions.length} ${level.toUpperCase()} questions for Round ${round}`);
            }
        } catch (error) {
            console.error('Error loading academic questions:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Set Grok API Key
    socket.on('set-grok-api-key', (data) => {
        try {
            grokService.setApiKey(data.apiKey);
            socket.emit('grok-key-status', { configured: true });
            addLog('Grok API key configured successfully.');
            console.log('🔑 Grok API key set by admin');
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Admin: Generate AI Questions via Grok
    socket.on('generate-ai-questions', async (data) => {
        try {
            const { schoolLevel, round, count } = data;
            globalSchoolLevel = schoolLevel; // Sync global level
            
            if (round === 'all') {
                socket.emit('ai-generating', { status: 'generating' });
                console.log(`🤖 Generating 61 ${schoolLevel} questions for the full game...`);

                const fetchOptions = [
                    {r: 1, c: 20},
                    {r: 2, c: 20},
                    {r: 3, c: 20},
                    {r: 4, c: 1}
                ];

                let totalGenerated = 0;
                for (const opt of fetchOptions) {
                    const questions = await grokService.generateQuestions(schoolLevel, opt.r, opt.c);
                    questionManager.reset(opt.r);
                    questions.forEach(q => questionManager.addQuestion(q, opt.r));
                    totalGenerated += questions.length;
                    
                    io.emit('questions-loaded', {
                        count: questionManager.getTotalQuestions(),
                        roundCount: questions.length,
                        round: opt.r
                    });
                }

                socket.emit('ai-generating', { status: 'done', count: totalGenerated });
                console.log(`✅ AI generated ${totalGenerated} questions for the full game`);
            } else {
                socket.emit('ai-generating', { status: 'generating' });
                console.log(`🤖 Generating ${count} ${schoolLevel} questions for Round ${round}...`);

                const questions = await grokService.generateQuestions(schoolLevel, round, count || 5);

                // Add generated questions to the question manager
                questionManager.reset(round);
                questions.forEach(q => questionManager.addQuestion(q, round));

                io.emit('questions-loaded', {
                    count: questionManager.getTotalQuestions(),
                    roundCount: questions.length,
                    round: round
                });

                socket.emit('ai-generating', { status: 'done', count: questions.length });
                console.log(`✅ AI generated ${questions.length} questions for Round ${round}`);
            }
        } catch (error) {
            socket.emit('ai-generating', { status: 'error', message: error.message });
            socket.emit('error', { message: error.message });
            console.error('AI generation error:', error.message);
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

    // Admin: Next question (manual fallback)
    socket.on('next-question', () => {
        autoAdvanceNextQuestion();
    });

    // Admin: Update settings
    socket.on('update-settings', (settings) => {
        if (settings.questionDuration !== undefined) {
            runtimeSettings.questionDuration = Math.max(5, Math.min(120, settings.questionDuration));
        }
        if (settings.autoAdvanceDelay !== undefined) {
            runtimeSettings.autoAdvanceDelay = Math.max(3, Math.min(10, settings.autoAdvanceDelay));
        }
        if (settings.revealDelay !== undefined) {
            runtimeSettings.revealDelay = Math.max(1, Math.min(5, settings.revealDelay));
        }
        if (settings.schoolLevel !== undefined) {
            runtimeSettings.schoolLevel = settings.schoolLevel;
            globalSchoolLevel = settings.schoolLevel;
        }
        // Broadcast updated settings to all admins
        io.emit('settings-sync', runtimeSettings);
        console.log('⚙️ Settings updated:', runtimeSettings);
    });

    // Player: Submit answer
    socket.on('submit-answer', (data) => {
        const { playerId, answer } = data;

        try {
            const result = gameEngine.submitAnswer(playerId, answer);

            // Confirm to player
            socket.emit('answer-submitted', { success: true });

            // Broadcast lock-in to all displays (for distinct sounds)
            io.emit('player-locked-in', { playerId });

            // Update admin
            connectedClients.admin.forEach(adminId => {
                io.to(adminId).emit('player-answered', {
                    playerId,
                    answered: true
                });
            });

            // If both players answered and dramatic reveal is enabled
            if (result.bothAnswered && result.revealPending) {
                triggerRevealSequence();
            }

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    function triggerRevealSequence() {
        // ── SNAPSHOT current state before any async delays ──
        const snapshotQuestion = gameEngine.getGameState().currentQuestion;
        if (!snapshotQuestion) return;

        const snapshotCorrectAnswer = snapshotQuestion.correctAnswer ||
            questionManager.getCorrectAnswer(snapshotQuestion.id);

        // Auto-submit empty answers for players who haven't answered yet
        const gameState = gameEngine.getGameState();
        if (!gameState.players[1].answerLocked) gameEngine.submitAnswer(1, '');
        if (!gameState.players[2].answerLocked) gameEngine.submitAnswer(2, '');

        // Capture player answers NOW before state can change
        const snapshotP1Answer = gameEngine.getGameState().players[1].answer || '—';
        const snapshotP2Answer = gameEngine.getGameState().players[2].answer || '—';

        // Trigger dramatic reveal sequence
        setTimeout(() => {
            io.emit('reveal-start');

            // --- STEP 1: Show Correct Answer Only ---
            setTimeout(() => {
                io.emit('reveal-correct-answer', { correctAnswer: snapshotCorrectAnswer });

                // Start generating explanation as soon as we know it's being revealed
                const correctAnswerText = snapshotQuestion.options[snapshotCorrectAnswer];
                grokService.generateExplanation(snapshotQuestion.question, correctAnswerText, globalSchoolLevel)
                    .then(explanation => {
                        io.emit('ai-explanation', { explanation });
                    });

                // --- STEP 2: Show Player Answers and process scores ---
                setTimeout(() => {
                    const results = gameEngine.processAnswers(snapshotCorrectAnswer);

                    io.emit('reveal-player-answers', {
                        player1: {
                            answer: snapshotP1Answer,
                            ...results.player1
                        },
                        player2: {
                            answer: snapshotP2Answer,
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
                            return;
                        }
                    } else if (gameEngine.getGameState().currentRound === 4 && questionManager.getNextQuestion() === null) {
                        // End of 4th round check
                        const p1Score = gameEngine.getGameState().players[1].score;
                        const p2Score = gameEngine.getGameState().players[2].score;
                        if (p1Score !== p2Score) {
                            io.emit('game-over', {
                                winner: p1Score > p2Score ? 1 : 2,
                                finalScores: gameEngine.getScores()
                            });
                            return;
                        }
                    }

                    // AUTO-ADVANCE: load next question after delay
                    setTimeout(() => {
                        autoAdvanceNextQuestion();
                    }, runtimeSettings.autoAdvanceDelay * 1000);

                }, 2000); // Wait 2s before showing player choices

            }, runtimeSettings.revealDelay * 1000); // Initial dramatic drumroll delay
        }, 100);
    }

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
                connectedClients.scoreboard.forEach(id => {
                    io.to(id).emit('scores-update', gameEngine.getScores());
                });

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
        const currentQ = gameEngine.getGameState().currentQuestion;
        if (!currentQ) return;

        // Auto-submit null answers for players who didn't answer
        const gameState = gameEngine.getGameState();
        if (!gameState.players[1].answerLocked) {
            gameEngine.submitAnswer(1, '');
        }
        if (!gameState.players[2].answerLocked) {
            gameEngine.submitAnswer(2, '');
        }

        // Use the new dramatic sequence
        triggerRevealSequence();
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);

        // Remove from tracking
        connectedClients.questionDisplay = connectedClients.questionDisplay.filter(id => id !== socket.id);
        connectedClients.scoreboard = connectedClients.scoreboard.filter(id => id !== socket.id);
        connectedClients.admin = connectedClients.admin.filter(id => id !== socket.id);

        Object.keys(connectedClients.players).forEach(playerId => {
            const before = connectedClients.players[playerId].length;
            connectedClients.players[playerId] = connectedClients.players[playerId].filter(id => id !== socket.id);
            if (before !== connectedClients.players[playerId].length) {
                // Player disconnected, notify admins
                broadcastPlayerStatus();
            }
        });
    });
});

// Start server
const PORT = process.env.PORT || config.port || 3000;
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
