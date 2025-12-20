const socket = io();

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

// Audio elements
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioElements = {
    countdown: createAudio('/audio/countdown.mp3'),
    countdownUrgent: createAudio('/audio/countdown-urgent.mp3'),
    correct: createAudio('/audio/correct.mp3'),
    correctStreak: createAudio('/audio/correct-streak.mp3'),
    wrong: createAudio('/audio/wrong.mp3'),
    drumroll: createAudio('/audio/drumroll.mp3'),
    lifeline: createAudio('/audio/lifeline-activate.mp3'),
    combo: createAudio('/audio/combo.mp3'),
    roundTransition: createAudio('/audio/round-transition.mp3'),
    suddenDeath: createAudio('/audio/sudden-death.mp3')
};

function createAudio(src) {
    const audio = new Audio(src);
    audio.volume = 0.7;
    return audio;
}

let timerInterval = null;
let currentDuration = 10;
let timeRemaining = 10;

// Round started
socket.on('round-started', (data) => {
    const { round, config } = data;
    roundText.textContent = `Round ${round}`;
    currentDuration = config.questionDuration;

    // Update theme
    document.body.className = `round-${round}`;

    playAudio('roundTransition');
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
    });

    // Hide reveal overlay
    revealOverlay.classList.remove('active');
});

// Timer start
socket.on('timer-start', (data) => {
    timeRemaining = data.duration;
    currentDuration = data.duration;
    startTimer();
});

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    playAudio('countdown');

    timerInterval = setInterval(() => {
        timeRemaining--;

        const percentage = (timeRemaining / currentDuration) * 100;
        timerBar.style.width = percentage + '%';
        timerText.textContent = timeRemaining;

        // Last 10 seconds - urgent mode
        if (timeRemaining <= 10 && !timerBar.classList.contains('urgent')) {
            timerBar.classList.add('urgent');
            stopAudio('countdown');
            playAudio('countdownUrgent');
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerBar.classList.remove('urgent');
            stopAudio('countdownUrgent');
            socket.emit('timer-expired');
        }
    }, 1000);
}

// Reveal start (dramatic delay)
socket.on('reveal-start', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        stopAudio('countdown');
        stopAudio('countdownUrgent');
    }

    revealOverlay.classList.add('active');
    playAudio('drumroll');
});

// Reveal results
socket.on('reveal-results', (data) => {
    stopAudio('drumroll');

    const { correctAnswer, player1, player2 } = data;

    // Show player answers
    player1Answer.textContent = player1.answer || '—';
    player2Answer.textContent = player2.answer || '—';

    // Mark correct/wrong
    player1Answer.className = 'player-answer ' + (player1.correct ? 'correct' : 'wrong');
    player2Answer.className = 'player-answer ' + (player2.correct ? 'correct' : 'wrong');

    // Show correct answer
    correctAnswerDisplay.textContent = `Correct Answer: ${correctAnswer}`;

    // Highlight correct option on main display
    document.querySelectorAll('.option').forEach(opt => {
        const letter = opt.querySelector('.option-letter').textContent;
        if (letter === correctAnswer) {
            opt.classList.add('correct');
        } else if (letter === player1.answer || letter === player2.answer) {
            opt.classList.add('wrong');
        }
    });

    // Play sounds
    if (player1.correct || player2.correct) {
        if (player1.streak >= 3 || player2.streak >= 3) {
            playAudio('correctStreak');
        } else {
            playAudio('correct');
        }
    } else {
        playAudio('wrong');
    }

    // Check for streak celebrations
    if (player1.streak >= 3 || player2.streak >= 3) {
        showStreakCelebration(Math.max(player1.streak || 0, player2.streak || 0));
    }

    // Hide reveal after 5 seconds
    setTimeout(() => {
        revealOverlay.classList.remove('active');
    }, 5000);
});

// Lifeline used
socket.on('lifeline-used', (data) => {
    const { playerId, lifelineType, eliminatedOptions } = data;

    lifelineText.textContent = `Player ${playerId} activated ${lifelineType}!`;
    lifelineNotification.classList.add('active');
    playAudio('lifeline');

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
    playAudio('combo');

    setTimeout(() => {
        streakCelebration.classList.remove('active');
    }, 2000);
}

// Sudden death mode
socket.on('sudden-death-start', () => {
    document.body.className = 'sudden-death';
    roundText.textContent = 'SUDDEN DEATH';
    playAudio('suddenDeath');
});

// Game over
socket.on('game-over', (data) => {
    roundText.textContent = `WINNER: PLAYER ${data.winner}!`;
    stopAllAudio();
});

// Audio helper functions
function playAudio(name) {
    if (audioElements[name]) {
        audioElements[name].currentTime = 0;
        audioElements[name].play().catch(e => console.log('Audio play failed:', e));
    }
}

function stopAudio(name) {
    if (audioElements[name]) {
        audioElements[name].pause();
        audioElements[name].currentTime = 0;
    }
}

function stopAllAudio() {
    Object.values(audioElements).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

// Game paused/resumed
socket.on('game-paused', () => {
    if (timerInterval) clearInterval(timerInterval);
    stopAllAudio();
});

socket.on('game-resumed', () => {
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
    stopAllAudio();
    revealOverlay.classList.remove('active');
});

console.log('📺 Question Display connected');
