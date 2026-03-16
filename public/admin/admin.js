const socket = io();

// Identify as admin
socket.emit('identify', { type: 'admin' });

// DOM Elements
const dashboard = document.getElementById('dashboard');
const questionsTab = document.getElementById('questions');
const logsTab = document.getElementById('logs');
const currentRoundVal = document.getElementById('currentRoundVal');
const currentQuestionVal = document.getElementById('currentQuestionVal');
const p1Score = document.getElementById('p1Score');
const p2Score = document.getElementById('p2Score');
const p1Status = document.getElementById('p1Status');
const p2Status = document.getElementById('p2Status');
const p1Card = document.getElementById('p1Card');
const p2Card = document.getElementById('p2Card');
const logConsole = document.getElementById('logConsole');
const pauseBtn = document.getElementById('pauseBtn');
const questionCountText = document.getElementById('questionCount');

let isPaused = false;

// Tab Switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Socket Events
socket.on('game-state', (state) => {
    updateDashboard(state);
    addLog(`System connected. Status: ${state.gameStatus}`);
});

socket.on('scores', (scores) => {
    p1Score.textContent = scores.player1.score;
    p2Score.textContent = scores.player2.score;
});

socket.on('player-answered', (data) => {
    const card = document.getElementById(`p${data.playerId}Card`);
    card.classList.add('answered');
    addLog(`Player ${data.playerId} submitted an answer.`);
});

socket.on('new-question', (q) => {
    currentQuestionVal.textContent = q.questionNumber;
    p1Card.classList.remove('answered');
    p2Card.classList.remove('answered');
    addLog(`New Question: ${q.question.substring(0, 30)}...`);
});

socket.on('questions-loaded', (data) => {
    questionCountText.textContent = `Questions in database: ${data.count}`;
    addLog(`Database updated: ${data.count} questions loaded.`);
});

socket.on('response-logs', (logs) => {
    logConsole.innerHTML = '';
    logs.reverse().forEach(log => {
        addLog(`[${log.timestamp.split('T')[1].split('.')[0]}] Round ${log.round} Result: P1 ${log.player1.correct ? '✅' : '❌'}, P2 ${log.player2.correct ? '✅' : '❌'}`, true);
    });
});

// Game Controls
function startRound(num) {
    socket.emit('start-round', num);
    addLog(`Starting Round ${num}...`);
}

function nextQuestion() {
    socket.emit('next-question');
}

function togglePause() {
    if (isPaused) {
        socket.emit('resume-game');
        pauseBtn.textContent = 'PAUSE GAME';
    } else {
        socket.emit('pause-game');
        pauseBtn.textContent = 'RESUME GAME';
    }
    isPaused = !isPaused;
}

function resetGame() {
    if (confirm('Are you sure you want to reset the entire game?')) {
        socket.emit('reset-game');
        addLog('Game reset by admin.');
    }
}

function loadCSV() {
    const path = document.getElementById('csvPath').value;
    socket.emit('load-questions-csv', path);
}

function getLogs() {
    socket.emit('get-logs');
}

function updateDashboard(state) {
    currentRoundVal.textContent = state.currentRound || '--';
    currentQuestionVal.textContent = state.currentQuestion ? state.currentQuestion.questionNumber : '--';
    document.getElementById('gameStatusText').textContent = state.gameStatus.toUpperCase();
    
    // Status Dot Color
    const dot = document.getElementById('statusDot');
    if (state.gameStatus === 'playing') dot.style.background = '#10b981';
    else if (state.gameStatus === 'paused') dot.style.background = '#f59e0b';
    else dot.style.background = '#64748b';
}

function addLog(msg, isInternal = false) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    if (isInternal) entry.style.color = '#8b5cf6';
    logConsole.prepend(entry);
}
