const socket = io();

// Identify as admin
socket.emit('identify', { type: 'admin' });

// DOM Elements
const currentRoundVal = document.getElementById('currentRoundVal');
const currentQuestionVal = document.getElementById('currentQuestionVal');
const currentTimerVal = document.getElementById('currentTimerVal');
const questionsCountVal = document.getElementById('questionsCountVal');
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

// ─── TAB SWITCHING ──────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ─── SOCKET EVENTS ──────────────────────────────────────
socket.on('game-state', (state) => {
    updateDashboard(state);
    addLog(`System connected. Status: ${state.gameStatus}`);
});

socket.on('scores', (scores) => {
    p1Score.textContent = scores.player1.score;
    p2Score.textContent = scores.player2.score;
});

socket.on('scores-update', (scores) => {
    p1Score.textContent = scores.player1.score;
    p2Score.textContent = scores.player2.score;
});

socket.on('player-answered', (data) => {
    const card = document.getElementById(`p${data.playerId}Card`);
    card.classList.add('answered');
    addLog(`Player ${data.playerId} locked in their answer.`);
});

socket.on('new-question', (q) => {
    currentQuestionVal.textContent = q.questionNumber;
    p1Card.classList.remove('answered');
    p2Card.classList.remove('answered');
    addLog(`Q${q.questionNumber}: ${q.question.substring(0, 40)}...`);
});

socket.on('questions-loaded', (data) => {
    questionCountText.textContent = `Questions in database: ${data.count}`;
    questionsCountVal.textContent = data.count;
    addLog(`Database updated: ${data.count} questions loaded.`);
});

socket.on('round-started', (data) => {
    currentRoundVal.textContent = data.round;
    addLog(`Round ${data.round} started!`);
});

socket.on('reveal-results', (data) => {
    const p1 = data.player1.correct ? '✅' : '❌';
    const p2 = data.player2.correct ? '✅' : '❌';
    addLog(`Result: P1 ${p1} | P2 ${p2} | Answer: ${data.correctAnswer}`);
});

socket.on('round-ended', (data) => {
    addLog(`Round ${data.round} ended. Final scores: P1=${data.scores.player1.score}, P2=${data.scores.player2.score}`);
});

socket.on('response-logs', (logs) => {
    logConsole.innerHTML = '';
    logs.reverse().forEach(log => {
        addLog(`[${log.timestamp.split('T')[1].split('.')[0]}] R${log.round}: P1 ${log.player1.correct ? '✅' : '❌'} P2 ${log.player2.correct ? '✅' : '❌'}`, true);
    });
});

// ─── PLAYER CONNECTION STATUS ───────────────────────────
socket.on('player-connection-status', (status) => {
    updatePlayerConnection(1, status[1]);
    updatePlayerConnection(2, status[2]);
});

function updatePlayerConnection(playerId, isConnected) {
    const statusEl = document.getElementById(`p${playerId}Status`);
    if (isConnected) {
        statusEl.className = 'p-status online';
        statusEl.innerHTML = '<span class="conn-dot"></span> ONLINE';
    } else {
        statusEl.className = 'p-status offline';
        statusEl.innerHTML = '<span class="conn-dot"></span> OFFLINE';
    }
}

// ─── SETTINGS SYNC ──────────────────────────────────────
socket.on('settings-sync', (settings) => {
    document.getElementById('questionDurationSlider').value = settings.questionDuration;
    document.getElementById('questionDurationValue').textContent = settings.questionDuration + 's';
    currentTimerVal.textContent = settings.questionDuration + 's';

    document.getElementById('autoAdvanceSlider').value = settings.autoAdvanceDelay;
    document.getElementById('autoAdvanceValue').textContent = settings.autoAdvanceDelay + 's';

    document.getElementById('revealDelaySlider').value = settings.revealDelay;
    document.getElementById('revealDelayValue').textContent = settings.revealDelay + 's';
});

// Live slider value updates
document.getElementById('questionDurationSlider').addEventListener('input', (e) => {
    document.getElementById('questionDurationValue').textContent = e.target.value + 's';
});
document.getElementById('autoAdvanceSlider').addEventListener('input', (e) => {
    document.getElementById('autoAdvanceValue').textContent = e.target.value + 's';
});
document.getElementById('revealDelaySlider').addEventListener('input', (e) => {
    document.getElementById('revealDelayValue').textContent = e.target.value + 's';
});

// ─── GAME CONTROLS ──────────────────────────────────────
function startRound(num) {
    socket.emit('start-round', num);
    addLog(`Starting Round ${num}...`);
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
        currentRoundVal.textContent = '--';
        currentQuestionVal.textContent = '--';
    }
}

function loadCSV() {
    const path = document.getElementById('csvPath').value;
    socket.emit('load-questions-csv', path);
}

function saveSettings() {
    const settings = {
        questionDuration: parseInt(document.getElementById('questionDurationSlider').value),
        autoAdvanceDelay: parseInt(document.getElementById('autoAdvanceSlider').value),
        revealDelay: parseFloat(document.getElementById('revealDelaySlider').value)
    };
    socket.emit('update-settings', settings);
    addLog(`Settings updated: Timer=${settings.questionDuration}s, Advance=${settings.autoAdvanceDelay}s, Reveal=${settings.revealDelay}s`);
}

function getLogs() {
    socket.emit('get-logs');
}

function updateDashboard(state) {
    currentRoundVal.textContent = state.currentRound || '--';
    currentQuestionVal.textContent = state.currentQuestion ? state.currentQuestion.questionNumber : '--';
    document.getElementById('gameStatusText').textContent = state.gameStatus.toUpperCase();
    
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

// ─── MOBILE SIDEBAR TOGGLE ─────────────────────────────
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}
