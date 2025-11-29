const OPPOSITES = {
    'top-left': 'bottom-right',
    'top': 'bottom',
    'top-right': 'bottom-left',
    'left': 'right',
    'right': 'left',
    'bottom-left': 'top-right',
    'bottom': 'top',
    'bottom-right': 'top-left'
};

const GAZE_PARAMS = {
    'top-left': { px: -15, py: -15 },
    'top': { px: 0, py: -15 },
    'top-right': { px: 15, py: -15 },
    'left': { px: -15, py: 0 },
    'right': { px: 15, py: 0 },
    'bottom-left': { px: -15, py: 15 },
    'bottom': { px: 0, py: 15 },
    'bottom-right': { px: 15, py: 15 }
};

const DIRECTIONS = Object.keys(GAZE_PARAMS);

let score = 0;
let isPlaying = false;
let currentTarget = null;
let timerInterval = null;
let timeLeft = 0;
const ROUND_TIME = 5.0; // seconds

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const faceTracker = document.getElementById('face');
const startGameBtn = document.getElementById('startGameButton');
const messageOverlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const restartBtn = document.getElementById('restartButton');
const gridCells = document.querySelectorAll('.grid-cell');

// Sound effects (optional, using Web Audio API or simple beeps could be added later)

function startGame() {
    score = 0;
    scoreEl.textContent = score;
    isPlaying = true;
    startGameBtn.disabled = true;
    messageOverlay.classList.add('hidden');

    nextRound();
}

function stopGame(won = false) {
    isPlaying = false;
    clearInterval(timerInterval);
    startGameBtn.disabled = false;

    messageTitle.textContent = won ? "You Won!" : "Game Over";
    messageOverlay.classList.remove('hidden');
}

function nextRound() {
    if (!isPlaying) return;

    // 1. Pick random direction
    const randomDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const gaze = GAZE_PARAMS[randomDir];

    // 2. Set face gaze
    if (faceTracker.setGaze) {
        faceTracker.setGaze(gaze.px, gaze.py);
    }

    // 3. Determine target (opposite)
    currentTarget = OPPOSITES[randomDir];

    // Visual feedback: Highlight the "danger" zone (where face is looking)
    gridCells.forEach(cell => {
        cell.classList.remove('active', 'wrong', 'danger');
        if (cell.dataset.pos === randomDir) {
            cell.classList.add('danger');
        }
    });

    // 4. Start Timer
    timeLeft = ROUND_TIME;
    timerEl.textContent = timeLeft.toFixed(1);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        timerEl.textContent = Math.max(0, timeLeft).toFixed(1);

        if (timeLeft <= 0) {
            stopGame(false);
        }
    }, 100);
}

function checkInput(x, y) {
    if (!isPlaying || !currentTarget) return;

    // Hide cursor for immersion? No, we need to see it to know where we are.

    // Find which element is at x, y
    // We need to handle the case where the element might be covered or nested
    // But since we have a grid, we can just check bounding boxes or use elementFromPoint

    const element = document.elementFromPoint(x, y);
    if (!element) return;

    const cell = element.closest('.grid-cell');

    // Clear previous "current" highlights
    gridCells.forEach(c => c.classList.remove('current'));

    if (!cell) return;

    // Highlight current cell (Yellow)
    if (cell.dataset.pos && cell.dataset.pos !== 'center') {
        // Only highlight if it's NOT the danger zone (red)
        if (!cell.classList.contains('danger')) {
            cell.classList.add('current');
        }
    }

    const pos = cell.dataset.pos;

    if (pos === currentTarget) {
        // SUCCESS!
        score++;
        scoreEl.textContent = score;

        // Visual feedback: Green for success
        cell.classList.add('success');

        clearInterval(timerInterval);

        // Small delay before next round
        setTimeout(() => {
            cell.classList.remove('success');
            nextRound();
        }, 500);
    } else if (pos && pos !== 'center') {
        // WRONG CELL
        // Already handled by not being the target. 
        // We could add 'wrong' class here if we wanted red feedback for wrong moves.
    }
}

function highlightCell(cell, type) {
    cell.classList.add(type);
    setTimeout(() => cell.classList.remove(type), 300);
}

// Listen for global mouse moves (which are dispatched by hand-control.js)
// Listen for custom hand grid events
window.addEventListener('handgridmove', (e) => {
    if (isPlaying) {
        checkGridInput(e.detail.pos);
    }
});

function checkGridInput(pos) {
    if (!isPlaying || !currentTarget) return;

    // Clear previous "current" highlights
    gridCells.forEach(c => c.classList.remove('current'));

    // Find the cell matching the position
    const cell = Array.from(gridCells).find(c => c.dataset.pos === pos);

    if (!cell) return;

    // Highlight current cell (Yellow)
    if (cell.dataset.pos && cell.dataset.pos !== 'center') {
        // Only highlight if it's NOT the danger zone (red)
        if (!cell.classList.contains('danger')) {
            cell.classList.add('current');
        }
    }

    if (pos === currentTarget) {
        // SUCCESS!
        score++;
        scoreEl.textContent = score;

        // Visual feedback: Green for success
        cell.classList.add('success');

        clearInterval(timerInterval);

        // Small delay before next round
        setTimeout(() => {
            cell.classList.remove('success');
            nextRound();
        }, 500);
    }
}

startGameBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Enable start button only when webcam is ready (optional, but good practice)
// For now, we just enable it initially or when webcam button is clicked?
// The webcam button logic is in hand-control.js. 
// We can observe the webcam button state or just enable start always but it won't work well without webcam.
// Let's just enable it.
startGameBtn.disabled = false;
