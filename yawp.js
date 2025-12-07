document.addEventListener("DOMContentLoaded", () => {
  const gridEl = document.getElementById("grid");
  const clearBtn = document.getElementById("clear-btn");
  const solveBtn = document.getElementById("solve-btn");
  const hintBtn = document.getElementById("hint-btn");
  const undoBtn = document.getElementById("undo-btn");
  const statusEl = document.getElementById("status");
  const quickKeys = document.querySelectorAll(".qkey");
  const appEl = document.querySelector(".app");

  const size = 9;
  const maxCells = size * size; // 81
  const cells = [];

  const levelSelect = document.getElementById("level-select");
  const timerEl = document.getElementById("timer");
  const bestTimeEl = document.getElementById("best-time");

  const LEVEL_MAX = [0, 5, 8, 9, 14, 17, 21, 22]; // indice 1..7

  let currentLevel = levelSelect ? parseInt(levelSelect.value, 10) || 1 : 1;
  let bestTimeSeconds = null;
  let hasStarted = false;
  let timerInterval = null;
  let timerSeconds = 0;

  let maxNumber = 0;
  let lastRow = null;
  let lastCol = null;

  const moveDeltas = [
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3],
    [-2, -2],
    [-2, 2],
    [2, -2],
    [2, 2]
  ];

  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  function indexFromRowCol(row, col) {
    return row * size + col;
  }

  function inBounds(r, c) {
    return r >= 0 && r < size && c >= 0 && c < size;
  }

  function resetClasses() {
    cells.forEach(c => c.classList.remove("allowed", "hint", "highest"));
  }

  function updateStatus(msg) {
    statusEl.textContent = msg || "";
  }


  function levelBestTimeKey() {
    return "yawpBestTimeSeconds_L" + String(currentLevel);
  }

  function formatSeconds(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return m + ":" + s;
  }

  function updateTimerDisplay() {
    if (!timerEl) return;
    timerEl.textContent = "⏱️ " + formatSeconds(timerSeconds);
  }

  function loadBestTimeForLevel() {
    const raw = localStorage.getItem(levelBestTimeKey());
    bestTimeSeconds = raw ? parseInt(raw, 10) : null;
  }

  function updateBestTimeDisplay() {
    if (!bestTimeEl) return;
    if (bestTimeSeconds === null || isNaN(bestTimeSeconds)) {
      bestTimeEl.textContent = "🏆 Livello " + currentLevel + ": --:--";
    } else {
      bestTimeEl.textContent = "🏆 Livello " + currentLevel + ": " + formatSeconds(bestTimeSeconds);
    }
  }

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

  function canMove(fromRow, fromCol, toRow, toCol) {
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;

    const isOrthogonal =
      (dr === 0 && Math.abs(dc) === 3) ||
      (dc === 0 && Math.abs(dr) === 3);

    const isDiagonal =
      Math.abs(dr) === 2 && Math.abs(dc) === 2;

    return isOrthogonal || isDiagonal;
  }

  function highlightHighest() {
    cells.forEach(c => c.classList.remove("highest"));
    if (maxNumber === 0) return;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === String(maxNumber)) {
        cells[i].classList.add("highest");
        break;
      }
    }
  }

  function updateAllowedCells() {
    resetClasses();
    highlightHighest();

    if (maxNumber === 0 || maxNumber >= maxCells) {
      return;
    }

    let anyAllowed = false;

    for (const [dr, dc] of moveDeltas) {
      const r = lastRow + dr;
      const c = lastCol + dc;
      if (inBounds(r, c)) {
        const idx = indexFromRowCol(r, c);
        const cell = cells[idx];
        if (cell.textContent.trim() === "") {
          cell.classList.add("allowed");
          anyAllowed = true;
        }
      }
    }

    if (!anyAllowed && maxNumber < maxCells) {
      updateStatus("Nessuna mossa possibile: sequenza bloccata a " + maxNumber + ".");
    } else if (maxNumber > 0 && maxNumber < maxCells) {
      updateStatus("Numero corrente: " + maxNumber + ".");
    } else {
      updateStatus("");
    }
  }

  function invalidMoveFeedback() {
    vibrate([40, 40, 40]);
  }

  function placeNextNumber(cell) {
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    if (cell.textContent.trim() !== "") return;

    if (cell.dataset.fixed === "true") {
      // numeri fissi: non modificabili
      return;
    }

    if (maxNumber > 0) {
      if (!canMove(lastRow, lastCol, row, col)) {
        invalidMoveFeedback();
        return;
      }
    }

    if (!hasStarted) {
      hasStarted = true;
      resetTimer();
      startTimer();
    }

    if (maxNumber === 0) {
      maxNumber = 1;
    } else if (maxNumber < maxCells) {
      maxNumber += 1;
    } else {
      return;
    }

    cell.textContent = String(maxNumber);
    lastRow = row;
    lastCol = col;
    vibrate(20);

    if (maxNumber === maxCells) {
      resetClasses();
      highlightHighest();
      stopTimer();

      if (timerSeconds > 0) {
        if (bestTimeSeconds === null || timerSeconds < bestTimeSeconds) {
          bestTimeSeconds = timerSeconds;
          localStorage.setItem(levelBestTimeKey(), String(bestTimeSeconds));
          updateBestTimeDisplay();
          updateStatus("Complimenti! Hai riempito tutte le 81 celle in " + formatSeconds(timerSeconds) + ". Nuovo record per il livello " + currentLevel + "!");
        } else {
          updateStatus("Complimenti! Hai riempito tutte le 81 celle in " + formatSeconds(timerSeconds) + ". Miglior tempo livello " + currentLevel + ": " + formatSeconds(bestTimeSeconds) + ".");
        }
      } else {
        updateStatus("Complimenti! Hai riempito tutte le 81 celle.");
      }
    } else {
      updateAllowedCells();
    }
  }

  function parseCurrentStateAllowPrefix() {
    let currentMax = 0;
    const freq = new Array(maxCells + 1).fill(0);
    const positions = new Array(maxCells);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = indexFromRowCol(r, c);
        const vStr = cells[idx].textContent.trim();
        if (vStr === "") continue;
        const v = parseInt(vStr, 10);
        if (isNaN(v) || v < 1 || v > maxCells) {
          updateStatus("Valore non valido in riga " + (r + 1) + ", colonna " + (c + 1) + ".");
          return null;
        }
        freq[v]++;
        if (freq[v] > 1) {
          updateStatus("Il numero " + v + " è presente più di una volta.");
          return null;
        }
        currentMax = Math.max(currentMax, v);
        positions[v - 1] = { row: r, col: c };
      }
    }

    if (currentMax === 0) {
      updateStatus("La griglia è vuota. Inserisci almeno un 1 per iniziare.");
      return null;
    }

    if (!positions[0]) {
      updateStatus("Manca il numero 1: non posso ricostruire una sequenza coerente.");
      return null;
    }

    let prefixK = 1;
    for (let n = 2; n <= currentMax; n++) {
      if (!positions[n - 1]) {
        prefixK = n - 1;
        break;
      }
      const a = positions[n - 2];
      const b = positions[n - 1];
      if (!canMove(a.row, a.col, b.row, b.col)) {
        prefixK = n - 1;
        break;
      }
      prefixK = n;
    }

    const visited = Array.from({ length: size }, () =>
      Array(size).fill(false)
    );
    for (let n = 1; n <= prefixK; n++) {
      const p = positions[n - 1];
      visited[p.row][p.col] = true;
    }

    return {
      prefixK,
      positions,
      visited,
      currentMax
    };
  }

  function degree(r, c, visited) {
    let count = 0;
    for (const [dr, dc] of moveDeltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && !visited[nr][nc]) {
        count++;
      }
    }
    return count;
  }

  function solveFromState(state) {
    const path = new Array(maxCells);
    const visited = Array.from({ length: size }, () =>
      Array(size).fill(false)
    );

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        visited[r][c] = state.visited[r][c];
      }
    }
    for (let n = 1; n <= state.prefixK; n++) {
      const p = state.positions[n - 1];
      path[n - 1] = { row: p.row, col: p.col };
    }

    let bestLen = state.prefixK;
    let bestPath = [];
    for (let i = 0; i < state.prefixK; i++) {
      const p = state.positions[i];
      bestPath.push({ row: p.row, col: p.col });
    }

    function backtrack(pos) {
      if (pos > bestLen) {
        bestLen = pos;
        bestPath = path.slice(0, pos).map(p => ({ row: p.row, col: p.col }));
      }
      if (pos === maxCells) {
        return true;
      }

      const prev = path[pos - 1];
      const moves = [];

      for (const [dr, dc] of moveDeltas) {
        const nr = prev.row + dr;
        const nc = prev.col + dc;
        if (inBounds(nr, nc) && !visited[nr][nc]) {
          moves.push({ nr, nc, deg: degree(nr, nc, visited) });
        }
      }

      moves.sort((a, b) => a.deg - b.deg);

      for (const m of moves) {
        visited[m.nr][m.nc] = true;
        path[pos] = { row: m.nr, col: m.nc };
        if (backtrack(pos + 1)) return true;
        visited[m.nr][m.nc] = false;
      }

      return false;
    }

    if (state.prefixK === 0) {
      return { bestPath, bestLen: 0 };
    }

    backtrack(state.prefixK);
    return { bestPath, bestLen };
  }

  

  function generateLevelLayout(level) {
    const requiredMax = LEVEL_MAX[level] || 0;

    // svuota completamente la griglia
    cells.forEach(c => {
      c.textContent = "";
      c.classList.remove("allowed", "hint", "highest", "fixed");
      delete c.dataset.fixed;
    });
    maxNumber = 0;
    lastRow = null;
    lastCol = null;
    hasStarted = false;
    resetTimer();

    if (!requiredMax) {
      // livello senza numeri fissi
      highlightHighest();
      updateAllowedCells();
      updateStatus("Livello " + level + " senza numeri fissi. Inserisci l'1 per iniziare.");
      return;
    }

    let path = null;

    // prova finché non troviamo un percorso abbastanza lungo
    while (!path) {
      const startRow = Math.floor(Math.random() * size);
      const startCol = Math.floor(Math.random() * size);

      const visited = Array.from({ length: size }, () =>
        Array(size).fill(false)
      );
      const positions = new Array(maxCells);

      visited[startRow][startCol] = true;
      positions[0] = { row: startRow, col: startCol };

      const state = {
        prefixK: 1,
        positions,
        visited,
        currentMax: 1
      };

      const { bestPath, bestLen } = solveFromState(state);
      if (bestLen >= requiredMax) {
        path = bestPath;
      }
    }

    // ora path contiene almeno requiredMax passi validi
    for (let n = 1; n <= requiredMax; n++) {
      const { row, col } = path[n - 1];
      const idx = indexFromRowCol(row, col);
      const cell = cells[idx];
      cell.textContent = String(n);
      cell.dataset.fixed = "true";
      cell.classList.add("fixed");
    }

    maxNumber = requiredMax;
    const last = path[requiredMax - 1];
    lastRow = last.row;
    lastCol = last.col;

    highlightHighest();
    updateAllowedCells();
    updateStatus(
      "Livello " + level +
      ": sequenza precompilata da 1 a " + requiredMax +
      ". Continua dal " + (requiredMax + 1) + "."
    );
  }

function applySolution(path, len) {
    cells.forEach(c => {
      c.textContent = "";
      c.classList.remove("allowed", "hint", "highest");
    });

    for (let i = 0; i < len; i++) {
      const { row, col } = path[i];
      const idx = indexFromRowCol(row, col);
      const cell = cells[idx];
      cell.textContent = String(i + 1);
    }

    maxNumber = len;
    const last = path[len - 1];
    lastRow = last.row;
    lastCol = last.col;

    highlightHighest();
    vibrate([50, 30, 50]);

    if (len === maxCells) {
      updateStatus("Soluzione completa fino a 81.");
    } else {
      updateStatus("Soluzione estesa fino a " + len + ". Puoi continuare a mano o annullare.");
      updateAllowedCells();
    }
  }

  function suggestLocalCorrectionOrMove() {
    const state = parseCurrentStateAllowPrefix();
    if (!state) return;

    if (state.prefixK < state.currentMax) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const idx = indexFromRowCol(r, c);
          const vStr = cells[idx].textContent.trim();
          if (vStr === "") continue;
          const v = parseInt(vStr, 10);
          if (!isNaN(v) && v > state.prefixK) {
            cells[idx].textContent = "";
          }
        }
      }

      const last = state.positions[state.prefixK - 1];
      maxNumber = state.prefixK;
      lastRow = last.row;
      lastCol = last.col;

      vibrate(30);
      updateStatus("Ho corretto la sequenza fino al numero " + state.prefixK + ". Ora puoi proseguire da qui.");
      updateAllowedCells();
      return;
    }

    const last = state.positions[state.prefixK - 1];
    maxNumber = state.prefixK;
    lastRow = last.row;
    lastCol = last.col;

    const candidateMoves = [];
    for (const [dr, dc] of moveDeltas) {
      const nr = last.row + dr;
      const nc = last.col + dc;
      if (inBounds(nr, nc)) {
        const idx = indexFromRowCol(nr, nc);
        const cell = cells[idx];
        if (cell.textContent.trim() === "") {
          candidateMoves.push({ row: nr, col: nc, idx });
        }
      }
    }

    resetClasses();
    highlightHighest();

    if (candidateMoves.length === 0) {
      updateStatus("Da questa posizione (" + maxNumber + ") non ci sono mosse valide. Usa 'Risolvi' o 'Annulla'.");
      return;
    }

    let best = null;
    let bestDeg = Number.POSITIVE_INFINITY;
    for (const m of candidateMoves) {
      const degVal = degree(m.row, m.col, state.visited);
      if (degVal < bestDeg) {
        bestDeg = degVal;
        best = m;
      }
    }

    candidateMoves.forEach(m => {
      cells[m.idx].classList.add("allowed");
    });

    if (best) {
      cells[best.idx].classList.remove("allowed");
      cells[best.idx].classList.add("hint");
      vibrate(25);
      updateStatus("Suggerimento: metti il numero " + (maxNumber + 1) + " nella cella arancione.");
    }
  }

  function undoLastMove() {
    if (maxNumber === 0) {
      updateStatus("Non ci sono mosse da annullare.");
      invalidMoveFeedback();
      return;
    }

    let foundIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === String(maxNumber)) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx === -1) {
      updateStatus("Stato non coerente, azzero la griglia.");
      cells.forEach(c => c.textContent = "");
      maxNumber = 0;
      lastRow = null;
      lastCol = null;
      resetClasses();
      invalidMoveFeedback();
      return;
    }

    cells[foundIdx].textContent = "";
    maxNumber -= 1;
    vibrate(30);

    if (maxNumber === 0) {
      lastRow = null;
      lastCol = null;
      resetClasses();
      updateStatus("Hai annullato tutte le mosse. Puoi ripartire da 1.");
      return;
    }

    let newLast = null;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === String(maxNumber)) {
        newLast = { row: Math.floor(i / size), col: i % size };
        break;
      }
    }

    if (!newLast) {
      updateStatus("Dopo l'annullamento lo stato non è coerente, quindi azzero la griglia.");
      cells.forEach(c => c.textContent = "");
      maxNumber = 0;
      lastRow = null;
      lastCol = null;
      resetClasses();
      invalidMoveFeedback();
      return;
    }

    lastRow = newLast.row;
    lastCol = newLast.col;

    updateStatus("Mossa annullata. Ultimo numero ora: " + maxNumber + ".");
    updateAllowedCells();
  }

  solveBtn.addEventListener("click", () => {
    const state = parseCurrentStateAllowPrefix();
    if (!state) return;
    updateStatus("Cerco una continuazione automatica...");
    setTimeout(() => {
      const { bestPath, bestLen } = solveFromState(state);
      if (bestLen <= state.prefixK) {
        highlightHighest();
        updateStatus("Non ho trovato un'estensione migliore rispetto alla situazione attuale.");
        invalidMoveFeedback();
      } else {
        applySolution(bestPath, bestLen);
      }
    }, 10);
  });

  hintBtn.addEventListener("click", () => {
    suggestLocalCorrectionOrMove();
  });

  undoBtn.addEventListener("click", () => {
    undoLastMove();
  });

  quickKeys.forEach(btn => {
    btn.addEventListener("click", () => {
      const dr = parseInt(btn.dataset.dr, 10);
      const dc = parseInt(btn.dataset.dc, 10);

      if (maxNumber === 0 || lastRow === null || lastCol === null) {
        updateStatus("Prima scegli una cella per il numero 1.");
        invalidMoveFeedback();
        return;
      }

      const nr = lastRow + dr;
      const nc = lastCol + dc;

      if (!inBounds(nr, nc)) {
        invalidMoveFeedback();
        return;
      }

      const idx = indexFromRowCol(nr, nc);
      const targetCell = cells[idx];

      if (targetCell.textContent.trim() !== "" || !canMove(lastRow, lastCol, nr, nc)) {
        invalidMoveFeedback();
        return;
      }

      placeNextNumber(targetCell);
    });
  });

  let touchStartX = null;
  let touchStartY = null;
  let touchStartTime = 0;

  appEl.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  appEl.addEventListener("touchend", (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 60;
    const maxTime = 600;

    touchStartX = null;
    touchStartY = null;

    if (dt > maxTime) return;
    if (absX < threshold && absY < threshold) return;

    if (absX > absY && dx > 0) {
      undoLastMove();
    }
  }, { passive: true });

  // Creazione griglia con BUTTON (non input!)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.textContent = "";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      // Font inline molto diverso (debug): serif tipo giornale
      cell.style.fontFamily = 'Fredoka, sans-serif';
      cell.style.fontSize = '1.2rem';
      cell.style.fontWeight = '600';


      if (row % 3 === 0 && row !== 0) {
        cell.dataset.rowBorder = "true";
      }
      if (col % 3 === 0 && col !== 0) {
        cell.dataset.colBorder = "true";
      }

      cell.addEventListener("click", () => {
        placeNextNumber(cell);
      });

      gridEl.appendChild(cell);
      cells.push(cell);
    }
  }


  // inizializza il livello corrente all'avvio
  loadBestTimeForLevel();
  updateBestTimeDisplay();
  updateTimerDisplay();
  generateLevelLayout(currentLevel);

  if (levelSelect) {
    levelSelect.addEventListener("change", () => {
      const newLevel = parseInt(levelSelect.value, 10);
      currentLevel = isNaN(newLevel) ? 1 : newLevel;
      loadBestTimeForLevel();
      updateBestTimeDisplay();
      generateLevelLayout(currentLevel);
    });
  }

clearBtn.addEventListener("click", () => {
    generateLevelLayout(currentLevel);
  });


  // inizializza timer e best time per il livello corrente
  loadBestTimeForLevel();
  updateBestTimeDisplay();
  updateTimerDisplay();
});
