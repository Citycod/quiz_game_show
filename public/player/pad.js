const socket = io();

// Get Player ID from URL
const playerId = parseInt(window.location.pathname.split('/').pop());
document.title = `Player ${playerId} | Quiz Game Show`;
document.getElementById('playerName').textContent = `PLAYER ${playerId}`;

// Identify as player
socket.emit('identify', { type: 'player', playerId });

const audio = new AudioEngine();
document.addEventListener('touchstart', () => { audio.init(); audio.resume(); }, { once: true });
document.addEventListener('mousedown', () => { audio.init(); audio.resume(); }, { once: true });

function triggerHaptic() {
    audio.playHaptic();
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// DOM Elements
const nameEntryScreen = document.getElementById('nameEntryScreen');
const waitingScreen = document.getElementById('waitingScreen');
const answerFeedback = document.getElementById('answerFeedback');
const roundText = document.getElementById('roundText');
const questionNumber = document.getElementById('questionNumber');
const scoreText = document.getElementById('playerScore');
const buttons = {
    A: document.getElementById('btnA'),
    B: document.getElementById('btnB'),
    C: document.getElementById('btnC'),
    D: document.getElementById('btnD')
};

let gameActive = false;
let lifelinesUsed = [];
let hasJoined = false;

// Join game with name
function joinGame() {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.style.border = '2px solid #ef4444';
        nameInput.placeholder = 'Please enter your name!';
        return;
    }
    socket.emit('join-game', { playerId, name });
    document.getElementById('playerName').textContent = name.toUpperCase();
    hasJoined = true;
    nameEntryScreen.classList.remove('active');
    waitingScreen.classList.add('active');
}

// Allow Enter key to submit name
document.getElementById('playerNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinGame();
});

// Game State Sync
socket.on('game-state', (state) => {
    updateUI(state);
});

socket.on('round-started', (data) => {
    roundText.textContent = `ROUND ${data.round}`;
    waitingScreen.classList.remove('active');
    gameActive = true;
});

socket.on('new-question', (question) => {
    questionNumber.textContent = `Q ${question.questionNumber}`;
    waitingScreen.classList.remove('active');
    answerFeedback.classList.remove('active');
    resetButtons();
    gameActive = true;
});

socket.on('scores-update', (scores) => {
    const pScore = scores[`player${playerId}`];
    scoreText.textContent = `SCORE: ${pScore.score}`;
});

socket.on('lifeline-activated', (result) => {
    if (result.eliminatedOptions) {
        result.eliminatedOptions.forEach(opt => {
            buttons[opt].classList.add('eliminated');
        });
    }
    document.getElementById(`ll${result.type === '50/50' ? '5050' : 'Double'}`).classList.add('used');
});

socket.on('reveal-start', () => {
    gameActive = false;
    disableButtons();
});

function updateUI(state) {
    const player = state.players[playerId];
    scoreText.textContent = `SCORE: ${player.score}`;
    
    if (!hasJoined) return; // Don't change screens until player has entered name

    if (state.gameStatus === 'waiting' || state.gameStatus === 'paused') {
        waitingScreen.classList.add('active');
    } else {
        waitingScreen.classList.remove('active');
    }

    if (player.answerLocked) {
        showFeedback();
    }
}

function submitAnswer(answer) {
    if (!gameActive) return;

    triggerHaptic();
    socket.emit('submit-answer', { playerId, answer });
    showFeedback();
}

function useLifeline(type) {
    triggerHaptic();
    socket.emit('activate-lifeline', { playerId, lifelineType: type });
}

function showFeedback() {
    answerFeedback.classList.add('active');
    disableButtons();
}

function disableButtons() {
    Object.values(buttons).forEach(btn => btn.classList.add('disabled'));
}

function resetButtons() {
    Object.values(buttons).forEach(btn => {
        btn.classList.remove('disabled', 'eliminated');
    });
}

socket.on('reveal-player-answers', (data) => {
    const player = data[`player${playerId}`];
    if (player.correct) {
        audio.playCorrect();
    } else {
        audio.playWrong();
    }
});

socket.on('game-over', (data) => {
    waitingScreen.classList.add('active');
    document.querySelector('#waitingScreen p').textContent = 
        data.winner === playerId ? "🏆 YOU WON!" : "💀 GAME OVER";
    
    if (data.winner === playerId) {
        audio.playCombo();
    } else {
        audio.playWrong();
    }
});
