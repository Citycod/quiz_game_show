const socket = io();
const audio = new AudioEngine();

// Init audio on first user interaction
document.addEventListener('click', () => { audio.init(); audio.resume(); }, { once: true });

// Identify as question display
socket.emit('identify', { type: 'question-display' });

// DOM Elements
const roundIndicator = document.getElementById('roundIndicator');
const roundText = document.getElementById('roundText');
const questionNumber = document.getElementById('questionNumber');
const questionText = document.getElementById('questionText');
const optionA = document.getElementById('optionA');
const optionB = document.getElementById('optionB');
const optionC = document.getElementById('optionC');
const optionD = document.getElementById('optionD');
const timerBar = document.getElementById('timerBar');
const timerText = document.getElementById('timerText');
const revealOverlay = document.getElementById('revealOverlay');
const player1Answer = document.getElementById('player1Answer');
const player2Answer = document.getElementById('player2Answer');
const correctAnswerDisplay = document.getElementById('correctAnswerDisplay');
const lifelineNotification = document.getElementById('lifelineNotification');
const lifelineText = document.getElementById('lifelineText');
const streakCelebration = document.getElementById('streakCelebration');
const streakMultiplier = document.getElementById('streakMultiplier');
const explanationBox = document.getElementById('explanationBox');
const explanationText = document.getElementById('explanationText');

let timerInterval = null;
let tickInterval = null;
let currentDuration = 10;
let timeRemaining = 10;

// Screen Recorder State
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
const recordingIndicator = document.getElementById('recordingIndicator');

// Screen Recorder Setup
async function toggleRecording() {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quiz-show-recording-${new Date().toISOString().slice(0,10)}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                isRecording = false;
                recordingIndicator.classList.remove('active');
            };

            // Stop recording when user stops sharing via browser UI
            stream.getVideoTracks()[0].onended = () => {
                if (isRecording) mediaRecorder.stop();
            };

            mediaRecorder.start();
            isRecording = true;
            recordingIndicator.classList.add('active');
            console.log('🔴 Recording started');
        } catch (err) {
            console.error('Error starting recording:', err);
            alert('Failed to start recording. Permission denied or not supported.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

// Global hotkey for recording: Shift + R
document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        toggleRecording();
    }
});

// Round started
socket.on('round-started', (data) => {
    const { round, config } = data;
    roundText.textContent = `Round ${round}`;
    currentDuration = config.questionDuration;

    // Update theme
    document.body.className = `round-${round}`;

    audio.playRoundTransition();
    audio.startBackgroundMusic();
    
    if (round >= 3) {
        audio.playTension();
    } else {
        audio.stopTension();
    }
});

// New question loaded
socket.on('new-question', (question) => {
    questionNumber.textContent = `Question ${question.questionNumber} of ${question.totalQuestions}`;
    questionText.textContent = question.question;
    optionA.textContent = question.options.A;
    optionB.textContent = question.options.B;
    optionC.textContent = question.options.C;
    optionD.textContent = question.options.D;

    // Reset options
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('correct', 'wrong', 'eliminated');
        opt.style.display = 'flex'; // Restore visibility if hidden by round-end
    });

    // Hide reveal overlay and explanation
    revealOverlay.classList.remove('active');
    explanationBox.classList.remove('active');
});

// AI Explanation received
socket.on('ai-explanation', (data) => {
    explanationText.textContent = data.explanation;
    explanationBox.classList.add('active');
});

// Timer start
socket.on('timer-start', (data) => {
    timeRemaining = data.duration;
    currentDuration = data.duration;
    timerBar.style.width = '100%';
    timerText.textContent = timeRemaining;
    timerBar.classList.remove('urgent');
    startTimer();
});

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (tickInterval) clearInterval(tickInterval);

    timerInterval = setInterval(() => {
        timeRemaining--;

        const percentage = (timeRemaining / currentDuration) * 100;
        timerBar.style.width = percentage + '%';
        timerText.textContent = timeRemaining;

        // Ticking sounds with two tiers
        if (timeRemaining <= 10 && timeRemaining > 5) {
            audio.playSlowTick();
        } else if (timeRemaining <= 5 && timeRemaining > 0) {
            audio.playFastTick();
            if (!timerBar.classList.contains('urgent')) {
                timerBar.classList.add('urgent');
            }
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerBar.classList.remove('urgent');
            socket.emit('timer-expired');
        }
    }, 1000);
}

// Player locked in their answer (distinct sounds)
socket.on('player-locked-in', (data) => {
    if (data.playerId === 1) {
        audio.playPlayer1LockIn();
    } else if (data.playerId === 2) {
        audio.playPlayer2LockIn();
    }
});

// Reveal start (dramatic delay)
socket.on('reveal-start', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    revealOverlay.classList.add('active');
    audio.playDrumroll();
});

// Reveal STEP 1: Correct Answer Only
socket.on('reveal-correct-answer', (data) => {
    const { correctAnswer } = data;

    // Show blank player answers initially
    player1Answer.textContent = '?';
    player2Answer.textContent = '?';
    player1Answer.className = 'player-answer blank';
    player2Answer.className = 'player-answer blank';

    // Show correct answer display
    correctAnswerDisplay.textContent = `Correct Answer: ${correctAnswer}`;

    // Highlight only the correct option
    document.querySelectorAll('.option').forEach(opt => {
        const letter = opt.querySelector('.option-letter').textContent;
        if (letter === correctAnswer) {
            opt.classList.add('correct');
        }
    });
});

// Reveal STEP 2: Player choices and scores
socket.on('reveal-player-answers', (data) => {
    const { player1, player2 } = data;

    // Show player answers
    player1Answer.textContent = player1.answer || '—';
    player2Answer.textContent = player2.answer || '—';

    // Mark correct/wrong for player boxes
    player1Answer.className = 'player-answer ' + (player1.correct ? 'correct' : 'wrong');
    player2Answer.className = 'player-answer ' + (player2.correct ? 'correct' : 'wrong');

    // Highlight wrong options that players chose on main display
    document.querySelectorAll('.option').forEach(opt => {
        const letter = opt.querySelector('.option-letter').textContent;
        // If not already correct and one of the players picked it
        if (!opt.classList.contains('correct') && (letter === player1.answer || letter === player2.answer)) {
            opt.classList.add('wrong');
        }
    });

    // Play sounds
    if (player1.correct || player2.correct) {
        audio.playCorrect();
        if (player1.streak >= 3 || player2.streak >= 3) {
            setTimeout(() => audio.playCombo(), 400);
        }
    } else {
        audio.playWrong();
    }

    // Check for streak celebrations
    if (player1.streak >= 3 || player2.streak >= 3) {
        showStreakCelebration(Math.max(player1.streak || 0, player2.streak || 0));
    }

    // Reveal auto-hides (server will auto-advance next question)
    setTimeout(() => {
        revealOverlay.classList.remove('active');
    }, 4000);
});

// Lifeline used
socket.on('lifeline-used', (data) => {
    const { playerId, lifelineType, eliminatedOptions } = data;

    lifelineText.textContent = `Player ${playerId} activated ${lifelineType}!`;
    lifelineNotification.classList.add('active');
    audio.playLifelineActivation();

    // Handle 50/50 - eliminate options
    if (lifelineType === '50/50' && eliminatedOptions) {
        eliminatedOptions.forEach(letter => {
            const option = document.querySelector(`.option-${letter.toLowerCase()}`);
            if (option) {
                option.classList.add('eliminated');
            }
        });
    }

    setTimeout(() => {
        lifelineNotification.classList.remove('active');
    }, 3000);
});

// Streak celebration
function showStreakCelebration(streak) {
    let multiplier = '1.5x';
    if (streak >= 5) multiplier = '2x';

    streakMultiplier.textContent = `${multiplier} MULTIPLIER`;
    streakCelebration.classList.add('active');

    setTimeout(() => {
        streakCelebration.classList.remove('active');
    }, 2000);
}

// Sudden death mode
socket.on('sudden-death-start', () => {
    document.body.className = 'sudden-death';
    roundText.textContent = 'SUDDEN DEATH';
    audio.playSuddenDeath();
});

// Round ended
socket.on('round-ended', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    revealOverlay.classList.remove('active');
    timerBar.style.width = '0%';
    timerText.textContent = '';
    
    questionNumber.textContent = `End of Round ${data.round}`;
    questionText.textContent = 'STANDBY FOR NEXT ROUND...';
    
    // Clear options
    optionA.textContent = '';
    optionB.textContent = '';
    optionC.textContent = '';
    optionD.textContent = '';
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('correct', 'wrong', 'eliminated');
        opt.style.display = 'none'; // Hide grid
    });
});

// Game over
socket.on('game-over', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    revealOverlay.classList.remove('active');
    timerBar.style.width = '0%';
    timerText.textContent = '';
    
    questionNumber.textContent = 'GAME OVER';
    questionText.textContent = `🏆 WINNER: PLAYER ${data.winner} 🏆`;
    
    // Clear options
    document.querySelectorAll('.option').forEach(opt => {
        opt.style.display = 'none';
    });
    
    roundText.textContent = `FINAL SCORE: P1(${data.finalScores.player1.score}) - P2(${data.finalScores.player2.score})`;
    audio.stopAll();

    // 👉 Gamification: Display Pulsing Trophy
    const trophyContainer = document.getElementById('trophyContainer');
    if (trophyContainer) trophyContainer.classList.add('active');

    // 👉 Gamification: Confetti blast!
    if (typeof confetti === 'function') {
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }
});

// Game paused/resumed
socket.on('game-paused', () => {
    if (timerInterval) clearInterval(timerInterval);
    audio.stopBackgroundMusic();
});

socket.on('game-resumed', () => {
    audio.startBackgroundMusic();
    if (timeRemaining > 0) {
        startTimer();
    }
});

// Game reset
socket.on('game-reset', () => {
    document.body.className = '';
    roundText.textContent = 'Waiting to Start...';
    questionText.textContent = 'Waiting for question...';
    if (timerInterval) clearInterval(timerInterval);
    audio.stopAll();
    revealOverlay.classList.remove('active');
    explanationBox.classList.remove('active');
});

console.log('📺 Question Display connected');
