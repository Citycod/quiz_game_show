const socket = io();

// Identify as scoreboard
socket.emit('identify', { type: 'scoreboard' });

// DOM Elements
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const streak1 = document.getElementById('streak1');
const streak2 = document.getElementById('streak2');
const penalties1 = document.getElementById('penalties1');
const penalties2 = document.getElementById('penalties2');
const suddenDeathBanner = document.getElementById('suddenDeathBanner');

// Handle Game State on connect
socket.on('game-state', (state) => {
    updatePlayers(state.players);
    if (state.gameStatus === 'suddenDeath') {
        suddenDeathBanner.classList.add('active');
    }
});

// Handle player name updates
socket.on('player-name-update', (data) => {
    const nameEl = document.querySelector(`.player-${data.playerId} .player-name`);
    if (nameEl) nameEl.textContent = data.name;
});

socket.on('scores', (scores) => {
    updateScores(scores);
});

socket.on('scores-update', (scores) => {
    updateScores(scores);
});

socket.on('sudden-death-start', () => {
    suddenDeathBanner.classList.add('active');
});

socket.on('game-reset', () => {
    suddenDeathBanner.classList.remove('active');
    score1.textContent = '0';
    score2.textContent = '0';
    streak1.textContent = '0';
    streak2.textContent = '0';
    penalties1.textContent = '0';
    penalties2.textContent = '0';
});

// New Phase 2 Event: Reveal Player Answers (contains speed bonus)
socket.on('reveal-player-answers', (data) => {
    const { player1, player2 } = data;
    
    // Check speed bonuses
    if (player1.speedBonus && player1.speedBonus > 0) {
        showSpeedBonus(1, player1.speedBonus);
    }
    if (player2.speedBonus && player2.speedBonus > 0) {
        showSpeedBonus(2, player2.speedBonus);
    }
    
    // Show combos if streaks are big
    if (player1.streak >= 3) showCombo(1);
    if (player2.streak >= 3) showCombo(2);
});

function updateScores(scores) {
    animateValue(score1, parseInt(score1.textContent), scores.player1.score, 500);
    animateValue(score2, parseInt(score2.textContent), scores.player2.score, 500);
    
    streak1.textContent = scores.player1.streak;
    streak2.textContent = scores.player2.streak;
    penalties1.textContent = scores.player1.penalties;
    penalties2.textContent = scores.player2.penalties;
    
    // Update player names if available
    if (scores.player1.name) {
        const name1El = document.querySelector('.player-1 .player-name');
        if (name1El) name1El.textContent = scores.player1.name;
    }
    if (scores.player2.name) {
        const name2El = document.querySelector('.player-2 .player-name');
        if (name2El) name2El.textContent = scores.player2.name;
    }
    
    // Crown for leader
    if (scores.player1.score > scores.player2.score) {
        document.getElementById('crown1').style.opacity = '1';
        document.getElementById('crown2').style.opacity = '0.2';
    } else if (scores.player2.score > scores.player1.score) {
        document.getElementById('crown1').style.opacity = '0.2';
        document.getElementById('crown2').style.opacity = '1';
    } else {
        document.getElementById('crown1').style.opacity = '1';
        document.getElementById('crown2').style.opacity = '1';
    }
}

function updatePlayers(players) {
    if(!players) return;
    streak1.textContent = players[1].streak || 0;
    streak2.textContent = players[2].streak || 0;
    penalties1.textContent = players[1].penalties || 0;
    penalties2.textContent = players[2].penalties || 0;
}

function showSpeedBonus(playerId, bonusAmount) {
    const playerSection = document.querySelector(`.player-${playerId}`);
    const bonusEl = document.createElement('div');
    bonusEl.className = 'speed-bonus-popup';
    bonusEl.textContent = `+${bonusAmount} SPEED BONUS!`;
    playerSection.appendChild(bonusEl);
    
    // Force reflow
    void bonusEl.offsetWidth;
    bonusEl.classList.add('fly-up');
    
    setTimeout(() => {
        bonusEl.remove();
    }, 2000);
}

function showCombo(playerId) {
    const comboEl = document.getElementById(`combo${playerId}`);
    comboEl.classList.add('active');
    setTimeout(() => {
        comboEl.classList.remove('active');
    }, 1500);
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
