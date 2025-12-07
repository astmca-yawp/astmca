document.addEventListener("DOMContentLoaded", () => {
  const gridEl = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const hintBtn = document.getElementById("hintBtn");
  const solveBtn = document.getElementById("solveBtn");

  const cells = [];

  let timerInterval = null;
  let timerSeconds = 0;
  let bestTimeSeconds = null;

  let maxNumber = 0;
  let lastRow = null;
  let lastCol = null;
  let undoStack = [];

  const size = 9;
  const maxCells = size * size;

  // ---------------- TIMER ----------------
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
    const el = document.getElementById("timer");
    if (el) {
      el.textContent = `⏱️ ${formatTime(timerSeconds)}`;
    }
  }

  function updateBestTimeDisplay() {
    const el = document.getElementById("best-time");
    if (!el) return;
    if (bestTimeSeconds === null) {
      el.textContent = "Miglior tempo: --:--";
    } else {
      el.textContent = "Miglior tempo: " + formatTime(bestTimeSeconds);
    }
  }

  function loadBestTime() {
    const stored = localStorage.getItem("astmca_best_time");
    if (stored !== null) {
      const val = Number(stored);
      if (!Number.isNaN(val) && val > 0) {
        bestTimeSeconds = val;
      }
    }
    updateBestTimeDisplay();
  }

  function checkAndUpdateBestTime() {
    if (timerSeconds <= 0) return;
    if (bestTimeSeconds === null || timerSeconds < bestTimeSeconds) {
      bestTimeSeconds = timerSeconds;
      localStorage.setItem("astmca_best_time", String(bestTimeSeconds));
      updateBestTimeDisplay();
    }
  }

  // ---------------- UTIL ----------------

  function updateStatus(msg) {
    statusEl.textContent = msg;
  }

  function coords(index) {
    return {
      row: Math.floor(index / size),
      col: index % size,
    };
  }

  function indexFrom(row, col) {
    return row * size + col;
  }

  function canMove(fromRow, fromCol, toRow, toCol) {
    const dRow = Math.abs(toRow - fromRow);
    const dCol = Math.abs(toCol - fromCol);

    if (dRow === 0 && dCol === 3) return true;
    if (dRow === 3 && dCol === 0) return true;
    if (dRow === 2 && dCol === 2) return true;

    return false;
  }

  function highlightHighest() {
    cells.forEach((c) => c.classList.remove("highest"));
    if (maxNumber > 0) {
      const cell = cells.find((c) => c.textContent == maxNumber);
      if (cell) cell.classList.add("highest");
    }
  }

  function computeAllowed() {
    cells.forEach((c) => c.classList.remove("allowed"));

    if (maxNumber === 0) {
      cells.forEach((c) => c.classList.add("allowed"));
      return;
    }

    let allowedCount = 0;

    for (let i = 0; i < cells.length; i++) {
      const { row, col } = coords(i);
      if (cells[i].textContent !== "") continue;

      if (canMove(lastRow, lastCol, row, col)) {
        cells[i].classList.add("allowed");
        allowedCount++;
      }
    }

    return allowedCount;
  }

  function placeNextNumber(cell) {
    if (cell.textContent !== "") return;

    const idx = cells.indexOf(cell);
    const { row, col } = coords(idx);

    if (maxNumber > 0) {
      if (!canMove(lastRow, lastCol, row, col)) return;
    }

    undoStack.push({
      index: idx,
      number: cell.textContent,
      prevMax: maxNumber,
      prevRow: lastRow,
      prevCol: lastCol,
    });

    if (maxNumber === 0) {
      maxNumber = 1;
      resetTimer();
      startTimer();
    } else if (maxNumber < maxCells) {
      maxNumber += 1;
    } else {
      return;
    }

    cell.textContent = String(maxNumber);
    lastRow = row;
    lastCol = col;

    highlightHighest();

    const remainingAllowed = computeAllowed();

    if (remainingAllowed === 0 && maxNumber < maxCells) {
      highlightHighest();
      stopTimer();
      updateStatus(
        "Bloccato! Nessuna mossa disponibile. Usa Suggerimento o Annulla."
      );
      return;
    }

    if (maxNumber === maxCells) {
      resetClasses();
      highlightHighest();
      stopTimer();
      checkAndUpdateBestTime();
      updateStatus("Complimenti! Hai riempito tutte le 81 celle.");
    } else {
      updateStatus(`Prosegui... (${maxNumber}/${maxCells})`);
    }
  }

  function resetClasses() {
    cells.forEach((c) => c.classList.remove("allowed", "hint"));
  }

  // ---------------- BUILD GRID ----------------

  for (let i = 0; i < maxCells; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    c.addEventListener("click", () => placeNextNumber(c));
    gridEl.appendChild(c);
    cells.push(c);
  }

  computeAllowed();

  // ---------------- UNDO ----------------

  undoBtn.addEventListener("click", () => {
    if (undoStack.length === 0) return;
    const st = undoStack.pop();

    if (st.number === "") cells[st.index].textContent = "";
    else cells[st.index].textContent = st.number;

    maxNumber = st.prevMax;
    lastRow = st.prevRow;
    lastCol = st.prevCol;

    highlightHighest();
    computeAllowed();
    updateStatus("");
  });

  // ---------------- CLEAR ----------------

  clearBtn.addEventListener("click", () => {
    cells.forEach((c) => {
      c.textContent = "";
      c.classList.remove("allowed", "hint", "highest");
    });
    maxNumber = 0;
    lastRow = null;
    lastCol = null;
    resetTimer();
    updateStatus("");
    computeAllowed();
  });

  // ---------------- HINT ----------------

  hintBtn.addEventListener("click", () => {
    resetClasses();
    computeAllowed();

    const allowedCells = cells.filter((c) =>
      c.classList.contains("allowed")
    );

    if (allowedCells.length === 0) {
      updateStatus("Nessun suggerimento disponibile.");
      return;
    }

    allowedCells.forEach((c) => c.classList.add("hint"));
    updateStatus("Ecco un suggerimento!");
  });

  // ---------------- LOAD RECORD & INIT ----------------

  loadBestTime();
  updateTimerDisplay();
  updateStatus("");
  highlightHighest();
});
