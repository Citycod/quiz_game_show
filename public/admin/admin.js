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
    // Update names from scores if available
    if (scores.player1.name) {
        document.querySelector('#p1Card h3').textContent = scores.player1.name;
    }
    if (scores.player2.name) {
        document.querySelector('#p2Card h3').textContent = scores.player2.name;
    }
});

// Handle player name updates
socket.on('player-name-update', (data) => {
    const card = document.getElementById(`p${data.playerId}Card`);
    if (card) {
        card.querySelector('h3').textContent = data.name;
    }
    addLog(`Player ${data.playerId} joined as: ${data.name}`);
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
    questionCountText.textContent = `Total in DB: ${data.count} | Round ${data.round}: ${data.roundCount}`;
    questionsCountVal.textContent = data.count;
    addLog(`Database updated: Round ${data.round} now has ${data.roundCount} questions.`);
});

socket.on('grok-key-status', (data) => {
    if (data.configured) {
        document.getElementById('grokKeyStatus').style.display = 'block';
    }
});

socket.on('ai-generating', (data) => {
    const statusEl = document.getElementById('aiStatus');
    const btn = document.getElementById('generateAiBtn');
    statusEl.style.display = 'block';
    if (data.status === 'generating') {
        statusEl.textContent = '⏳ Generating questions with AI... Please wait...';
        statusEl.style.color = '#f59e0b';
        btn.disabled = true;
    } else if (data.status === 'done') {
        statusEl.textContent = `✅ Successfully generated ${data.count} questions!`;
        statusEl.style.color = '#10b981';
        btn.disabled = false;
        setTimeout(() => statusEl.style.display = 'none', 5000);
    } else if (data.status === 'error') {
        statusEl.textContent = `❌ Error: ${data.message}`;
        statusEl.style.color = '#ef4444';
        btn.disabled = false;
    }
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

    if (settings.schoolLevel) {
        document.getElementById('schoolLevel').value = settings.schoolLevel;
    }
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
    const round = parseInt(document.getElementById('targetRound').value);
    socket.emit('load-questions-csv', { path, round });
    addLog(`Requesting CSV load for Round ${round}...`);
}

function loadWAEC() {
    const round = document.getElementById('targetRound').value;
    const schoolLevel = document.getElementById('schoolLevel').value;
    socket.emit('load-waec-questions', { round, schoolLevel });
    addLog(`Requesting ${schoolLevel.toUpperCase()} database load for Round ${round}...`);
}

function generateAIQuestions() {
    const schoolLevel = document.getElementById('schoolLevel').value;
    const roundVal = document.getElementById('targetRound').value;
    
    let count;
    let round;
    if (roundVal === 'all') {
        round = 'all';
        count = 61;
    } else {
        round = parseInt(roundVal);
        count = parseInt(document.getElementById('aiQuestionCount').value) || 5;
    }

    socket.emit('generate-ai-questions', { schoolLevel, round, count });
    addLog(`Requesting ${count} AI questions for ${schoolLevel} (Round ${round})...`);
}

function setGrokApiKey() {
    const apiKey = document.getElementById('grokApiKey').value.trim();
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }
    socket.emit('set-grok-api-key', { apiKey });
    document.getElementById('grokApiKey').value = '';
}

function saveSettings() {
    const settings = {
        questionDuration: parseInt(document.getElementById('questionDurationSlider').value),
        autoAdvanceDelay: parseInt(document.getElementById('autoAdvanceSlider').value),
        revealDelay: parseFloat(document.getElementById('revealDelaySlider').value),
        schoolLevel: document.getElementById('schoolLevel').value
    };
    socket.emit('update-settings', settings);
    addLog(`Settings updated: Timer=${settings.questionDuration}s, Advance=${settings.autoAdvanceDelay}s, Reveal=${settings.revealDelay}s, Level=${settings.schoolLevel}`);

    // Also trigger save for Grok API key if one is entered
    const apiKey = document.getElementById('grokApiKey').value.trim();
    if (apiKey) {
        socket.emit('set-grok-api-key', { apiKey });
        document.getElementById('grokApiKey').value = '';
    }
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
