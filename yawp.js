const grid = document.getElementById("grid");
const cells = [];

let maxNumber = 0;
let lastRow = null;
let lastCol = null;

let historyStack = [];

/* ---------------- TIMER + RECORD ---------------- */

let timerSeconds = 0;
let timerInterval = null;
let bestTimeSeconds = null;

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timer").textContent = "⏱️ " + formatTime(timerSeconds);
}

function updateBestTimeDisplay() {
  const el = document.getElementById("best-time");
  if (bestTimeSeconds === null) el.textContent = "Miglior tempo: --:--";
  else el.textContent = "Miglior tempo: " + formatTime(bestTimeSeconds);
}

function loadBestTime() {
  const stored = localStorage.getItem("astmca_best_time");
  if (stored) {
    const val = Number(stored);
    if (!isNaN(val)) bestTimeSeconds = val;
  }
  updateBestTimeDisplay();
}

function checkAndUpdateBestTime() {
  if (bestTimeSeconds === null || timerSeconds < bestTimeSeconds) {
    bestTimeSeconds = timerSeconds;
    localStorage.setItem("astmca_best_time", String(bestTimeSeconds));
    updateBestTimeDisplay();
  }
}

/* ---------------- CREAZIONE GRIGLIA ---------------- */

for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.row = r;
    cell.dataset.col = c;

    cell.addEventListener("click", () => handleCellClick(r, c, cell));
    cells.push(cell);
    grid.appendChild(cell);
  }
}

/* ---------------- LOGICA MOSSE ---------------- */

function handleCellClick(row, col, cell) {
  if (cell.textContent !== "" && !(maxNumber === 0 && cell.textContent === "")) return;

  if (maxNumber === 0) {
    maxNumber = 1;
    cell.textContent = "1";
    lastRow = row;
    lastCol = col;
    historyStack = [];
    historyStack.push({ row, col, number: 1 });
    resetTimer();
    startTimer();
    computeAllowed();
    highlightHighest();
    updateStatus("Hai iniziato!");
    return;
  }

  if (!cell.classList.contains("allowed")) return;

  maxNumber++;
  cell.textContent = String(maxNumber);
  lastRow = row;
  lastCol = col;

  historyStack.push({ row, col, number: maxNumber });

  computeAllowed();
  highlightHighest();
  updateStatus(`(${maxNumber}/81)`);

  if (maxNumber === 81) {
    stopTimer();
    checkAndUpdateBestTime();
    updateStatus("Complimenti! Hai riempito tutte le 81 celle.");
  }
}

function computeAllowed() {
  cells.forEach(c => c.classList.remove("allowed"));

  if (maxNumber === 0) return;

  const moves = [];

  const jumpMoves = [
    [0, 3], [0, -3],
    [3, 0], [-3, 0],
    [2, 2], [2, -2],
    [-2, 2], [-2, -2],
  ];

  for (const [dr, dc] of jumpMoves) {
    const nr = lastRow + dr;
    const nc = lastCol + dc;
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      const idx = nr * 9 + nc;
      if (cells[idx].textContent === "") moves.push(cells[idx]);
    }
  }

  moves.forEach(m => m.classList.add("allowed"));

  if (moves.length === 0 && maxNumber > 0 && maxNumber < 81) {
    stopTimer();
    updateStatus("Bloccato! Nessuna mossa disponibile.");
  }
}

/* ---------------- UNDO ---------------- */

document.getElementById("undoBtn").addEventListener("click", () => {
  if (historyStack.length <= 1) return;

  const last = historyStack.pop();
  const idx = last.row * 9 + last.col;
  cells[idx].textContent = "";

  maxNumber--;

  const prev = historyStack[historyStack.length - 1];
  lastRow = prev.row;
  lastCol = prev.col;

  computeAllowed();
  highlightHighest();
  updateStatus(`(${maxNumber}/81)`);
});

/* ---------------- CLEAR ---------------- */

document.getElementById("clearBtn").addEventListener("click", () => {
  cells.forEach(c => {
    c.textContent = "";
    c.classList.remove("allowed", "hint", "highest");
  });
  maxNumber = 0;
  lastRow = null;
  lastCol = null;
  historyStack = [];
  resetTimer();
  updateStatus("");
});

/* ---------------- SUGGERIMENTO ---------------- */

document.getElementById("hintBtn").addEventListener("click", () => {
  const allowed = cells.filter(c => c.classList.contains("allowed"));
  if (allowed.length > 0) {
    allowed[0].classList.add("hint");
    updateStatus("Mossa consigliata evidenziata.");
  }
});

/* ---------------- RISOLUTORE ---------------- */

document.getElementById("solveBtn").addEventListener("click", () => {
  updateStatus("Soluzione automatica non disponibile (solo manuale).");
});

/* ---------------- VARIE ---------------- */

function highlightHighest() {
  cells.forEach(c => c.classList.remove("highest"));
  if (maxNumber > 0) {
    const pos = historyStack[historyStack.length - 1];
    const idx = pos.row * 9 + pos.col;
    cells[idx].classList.add("highest");
  }
}

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}

loadBestTime();
updateTimerDisplay();
