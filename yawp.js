document.addEventListener("DOMContentLoaded", () => {
  // evita zoom su doppio click/tap (soprattutto su iOS)
  const preventDoubleTapZoom = (el) => {
    if (!el) return;
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
    }, { passive: false });
  };

  let gameMode = localStorage.getItem("yawpGameMode") || "easy";
  let soundEnabled = (localStorage.getItem('yawpSound') !== '0');
  let audioCtx = null;
  let audioUnlocked = false;
  let hintsUsed = 0;
  let undosUsed = 0;
  let debugEnabled = (localStorage.getItem('yawpDebug') === '1');
  let cornerSecretInstalled = false;
  const modeSelect = document.getElementById("mode-select");
  preventDoubleTapZoom(document.body);
  preventDoubleTapZoom(document.getElementById("grid"));
  const soundBtn = document.getElementById("sound-toggle");
  if (soundBtn) {
    const refreshSoundUI = () => {
      soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
      soundBtn.classList.toggle("off", !soundEnabled);
    };
    refreshSoundUI();
    soundBtn.addEventListener("click", () => {
      // user gesture: unlock audio and toggle
      unlockAudio();
      soundEnabled = !soundEnabled;
      localStorage.setItem("yawpSound", soundEnabled ? "1" : "0");
      refreshSoundUI();
      showToast(soundEnabled ? "Audio ON" : "Audio OFF");
      try { navigator.vibrate?.(15); } catch(e) {}
    playTick();
    });
  }

  if (modeSelect) {
    modeSelect.value = gameMode;
    modeSelect.addEventListener("change", () => {
      gameMode = modeSelect.value;
      localStorage.setItem("yawpGameMode", gameMode);
      clearLastNumberHighlight();
      generateLevelLayout(currentLevel);
  installCornerCellSecret();
    });
  }

  const gridEl = document.getElementById("grid");
  const clearBtn = document.getElementById("clear-btn");
  const solveBtn = document.getElementById("solve-btn");
  const hintBtn = document.getElementById("hint-btn");
  const undoBtn = document.getElementById("undo-btn");
  const statusEl = document.getElementById("status");
  const quickKeys = document.querySelectorAll(".qkey");
  const appEl = document.querySelector(".app");

  
  function showToast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "18px";
      t.style.transform = "translateX(-50%)";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "999px";
      t.style.background = "rgba(0,0,0,0.85)";
      t.style.color = "#fff";
      t.style.fontSize = "0.95rem";
      t.style.zIndex = "100000";
      t.style.opacity = "0";
      t.style.transition = "opacity 180ms ease";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = "1"; });
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => { t.style.opacity = "0"; }, 900);
  }

  
  
  /* ===== STATS (best time + hints + undo) ===== */
  function statsKey(level, mode) {
    return `yawpStats_${mode}_L${level}`;
  }

  function loadBestStats(level, mode) {
    try {
      const raw = localStorage.getItem(statsKey(level, mode));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveBestStats(level, mode, statsObj) {
    try {
      localStorage.setItem(statsKey(level, mode), JSON.stringify(statsObj));
    } catch (e) {}
  }
  /* ===== END STATS ===== */

/* ===== AUDIO (optional, works on iOS too) ===== */
  function ensureAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function unlockAudio() {
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    audioUnlocked = true;
  }

  function playTick() {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;

    // On iOS Safari, audio must be triggered after a user gesture.
    if (!audioUnlocked) return;

    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);          // A5
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.06);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.09);
  }
  /* ===== END AUDIO ===== */

function applyDebugUI() {
    if (debugEnabled) {
      document.body.classList.add("debug-on");
    } else {
      document.body.classList.remove("debug-on");
    }
  }

  function setDebugEnabled(val) {
    debugEnabled = !!val;
    localStorage.setItem("yawpDebug", debugEnabled ? "1" : "0");
    applyDebugUI();
    try { navigator.vibrate?.(25); } catch(e) {}
    showToast(debugEnabled ? "Debug ON" : "Debug OFF");
  }


  function installCornerCellSecret() {
    if (cornerSecretInstalled) return;
    cornerSecretInstalled = true;
    const gridEl = document.getElementById("grid");
    if (!gridEl) return;

    const seq = [
      { r: 0, c: 0 },
      { r: 0, c: 8 },
      { r: 8, c: 8 },
      { r: 8, c: 0 },
    ];
    let idx = 0;

    gridEl.addEventListener("click", (e) => {
      unlockAudio();
      const btn = e.target.closest("button");
      if (!btn) return;

      const r = parseInt(btn.dataset.row, 10);
      const c = parseInt(btn.dataset.col, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return;

      const exp = seq[idx];
      if (r === exp.r && c === exp.c) {
        idx += 1;
        if (idx === seq.length) {
          idx = 0;
          setDebugEnabled(!debugEnabled);
        }
      } else {
        // restart if they clicked the first corner, else reset
        idx = (r === seq[0].r && c === seq[0].c) ? 1 : 0;
      }
    });
  }
const timerEl = document.getElementById("timer");
  const bestTimeEl = document.getElementById("best-time");
  const levelSelect = document.getElementById("level-select");

  const LEVEL_COUNT = 7;
  const FIXED_BY_LEVEL = {
    1: [],
    2: [5],
    3: [5, 8],
    4: [5, 8, 9],
    5: [5, 8, 9, 14],
    6: [5, 8, 9, 14, 17, 21],
    7: [5, 8, 9, 14, 17, 21, 22]
  };

  let unlockedLevel = localStorage.getItem("yawpUnlockedLevel")
    ? parseInt(localStorage.getItem("yawpUnlockedLevel"), 10)
    : 1;
  if (isNaN(unlockedLevel) || unlockedLevel < 1) unlockedLevel = 1;
  if (unlockedLevel > LEVEL_COUNT) unlockedLevel = LEVEL_COUNT;

  let currentLevel = unlockedLevel;
gameMode = localStorage.getItem('yawpGameMode') || 'easy';

  let timerInterval = null;
  let timerSeconds = 0;
  let bestTimeSeconds = null;
  let hasStarted = false;
  let fixedPos = {};



  const size = 9;
  const maxCells = size * size; // 81
  const cells = [];

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
    cells.forEach(c => c.classList.remove("allowed", "hint", "highest", "unreachable"));
  }

  function updateStatus(msg) {
    statusEl.textContent = msg || "";
  }


  function levelBestTimeKey(level) {
    return "yawpBestTimeSeconds_L" + String(level);
  }

  
  /* ===== VICTORY OVERLAY + CONFETTI ===== */
  function launchConfetti() {
    const layer = document.getElementById("confetti-layer");
    if (!layer) return;

    layer.innerHTML = "";
    const count = 90;
    const w = window.innerWidth;
    const palette = ["#00e0ff", "#00ffa6", "#ffd400", "#ff4d6d", "#b76cff", "#ffffff"];

    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "confetti";

      const x = Math.random() * w;
      const cw = 6 + Math.random() * 10;
      const ch = 8 + Math.random() * 14;

      el.style.left = x + "px";
      el.style.width = cw + "px";
      el.style.height = ch + "px";
      el.style.background = palette[Math.floor(Math.random() * palette.length)];
      el.style.animationDelay = (Math.random() * 0.25) + "s";

      layer.appendChild(el);
    }

    setTimeout(() => { layer.innerHTML = ""; }, 1700);
  }

  function showVictoryOverlay() {
    // salva best stats (tempo + lampadina + undo) per questo livello e modalità
    const runSeconds = timerSeconds; // tempo della run corrente
    const existing = loadBestStats(currentLevel, gameMode);
    const candidate = { bestTimeSeconds: runSeconds, bestHints: hintsUsed, bestUndos: undosUsed };

    if (!existing || existing.bestTimeSeconds === null || isNaN(existing.bestTimeSeconds) || runSeconds < existing.bestTimeSeconds) {
      saveBestStats(currentLevel, gameMode, candidate);
    }
    updateBestTimeDisplay();
const overlay = document.getElementById("victory-overlay");
    const textEl = document.getElementById("victory-text");
    const timeEl = document.getElementById("victory-time");
    const nextBtn = document.getElementById("victory-next");

    if (!overlay || !textEl || !timeEl || !nextBtn) return;

    const isLast = (typeof LEVEL_COUNT !== "undefined") ? (currentLevel >= LEVEL_COUNT) : false;
    const nextLevel = currentLevel + 1;

    const t = formatSeconds(timerSeconds);
    timeEl.innerHTML = "Tempo: <span>" + t + "</span>";

    if (!isLast) {
      textEl.innerHTML =
        "Hai completato il livello <span>" + currentLevel + "</span>.<br>" +
        "Ottima gestione della sequenza e delle mosse consentite.<br>" +
        "Se vuoi, puoi proseguire al livello successivo.";
      nextBtn.textContent = "Continua con il livello " + nextLevel;
    } else {
      textEl.innerHTML =
        "Hai completato tutti i livelli.<br>" +
        "Risultato eccellente.";
      nextBtn.textContent = "Chiudi";
    }

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");

    launchConfetti();
    try { navigator.vibrate?.([80, 40, 80]); } catch (e) {}

    nextBtn.onclick = () => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");

      if (!isLast) {
        // switch to next level using existing UI controls if present
        currentLevel = nextLevel;
        if (typeof updateLevelSelectUI === "function") updateLevelSelectUI();

        loadBestTimeForLevel(currentLevel);
        updateBestTimeDisplay();
        generateLevelLayout(currentLevel);
      }
    };
  }
  /* ===== END VICTORY OVERLAY + CONFETTI ===== */


function formatSeconds(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function updateTimerDisplay() {
    if (!timerEl) return;
    timerEl.textContent = "⏱️ " + formatSeconds(timerSeconds);
  }

  function loadBestTimeForLevel(level) {
    const raw = localStorage.getItem(levelBestTimeKey(level));
    bestTimeSeconds = raw ? parseInt(raw, 10) : null;
  }

  function updateBestTimeDisplay() {
    const bestTimeEl = document.getElementById("best-time");
    if (!bestTimeEl) return;

    const best = loadBestStats(currentLevel, gameMode);
    const timeStr = (!best || best.bestTimeSeconds === null || isNaN(best.bestTimeSeconds))
      ? "--:--"
      : formatSeconds(best.bestTimeSeconds);

    const hStr = best ? String(best.bestHints ?? 0) : "-";
    const uStr = best ? String(best.bestUndos ?? 0) : "-";

    bestTimeEl.innerHTML =
      '<span class="yawp-version">v83</span> 🏆 Livello ' + currentLevel + ": " + timeStr +
      ' <span class="best-stats">· 💡' + hStr + ' · ↩︎' + uStr + '</span>';
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      timerSeconds += 1;
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

  function syncLastNumberHighlight() {
    clearLastNumberHighlight();
    if (!cells || maxNumber <= 0) return;

    // Find the cell that currently contains maxNumber and highlight it
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === String(maxNumber)) {
        cells[i].classList.add("last-number");
        return;
      }
    }
  }

  function clearLastNumberHighlight() {
    const prev = document.querySelector(".grid button.last-number");
    if (prev) prev.classList.remove("last-number");
  }

  function pulseCell(cell) {

    cell.classList.add("just-placed");
    setTimeout(() => cell.classList.remove("just-placed"), 120);
  }

  function canMove(fromRow, fromCol, toRow, toCol) {
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;

    // Orizzontale/Verticale:
    // - Classica: salto 2 celle (spostamento 3)
    // - Facile: salto 1 o 2 celle (spostamento 2 o 3)
    const orthoDelta = (gameMode === "easy") ? [2, 3] : [3];

    const isOrthogonal =
      (dr === 0 && orthoDelta.includes(Math.abs(dc))) ||
      (dc === 0 && orthoDelta.includes(Math.abs(dr)));

    // Diagonale: salto 1 cella (spostamento 2 in riga e colonna)
    const isDiagonal = (Math.abs(dr) === 2 && Math.abs(dc) === 2);

    // Mossa "cavallo" (solo Facile): L (2,1) o (1,2)
    const isKnight =
      (gameMode === "easy") &&
      ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2));

    return isOrthogonal || isDiagonal || isKnight;
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
    let anyAllowed = false;
    const nextNum = maxNumber + 1;

    // If the next number is fixed, only that cell is allowed (if reachable)
    if (fixedPos[nextNum]) {
      const p = fixedPos[nextNum];
      if (maxNumber === 0 || canMove(lastRow, lastCol, p.row, p.col)) {
        cells[p.idx].classList.add("allowed");
        anyAllowed = true;
      }
      if (!anyAllowed) updateStatus("Nessuna mossa valida: devi raggiungere il " + nextNum + ".");
      return;
    }

    // Normal case: highlight all empty reachable cells, with lookahead if next+1 is fixed
    const nf = fixedPos[nextNum + 1];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = indexFromRowCol(r, c);
        const cell = cells[idx];
        if (cell.textContent.trim() !== "") continue;

        if (maxNumber === 0 || canMove(lastRow, lastCol, r, c)) {
          if (!nf || canMove(r, c, nf.row, nf.col)) {
            cell.classList.add("allowed");
            anyAllowed = true;
          }
        }
      }
    }

    
    // marca celle libere ma non raggiungibili (solo quando la partita è iniziata)
    if (maxNumber > 0) {
      for (const cell of cells) {
        if (cell.textContent.trim() !== "") {
          cell.classList.remove("unreachable");
          continue;
        }
        if (cell.classList.contains("allowed")) {
          cell.classList.remove("unreachable");
        } else {
          cell.classList.add("unreachable");
        }
      }
    } else {
      for (const cell of cells) cell.classList.remove("unreachable");
    }

if (!anyAllowed && maxNumber < maxCells) {
      updateStatus("Nessuna mossa valida: sequenza bloccata a " + maxNumber + ".");
    }
  }


  function invalidMoveFeedback() {
    vibrate([40, 40, 40]);
  }

  function placeNextNumber(cell) {
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    const idxHere = indexFromRowCol(row, col);

    const isFixedCell = cell.dataset.fixed === "true";
    const cellVal = cell.textContent.trim();

    const nextNum = maxNumber + 1;

    // If next number is fixed somewhere else, you must click that exact cell
    if (fixedPos[nextNum] && fixedPos[nextNum].idx !== idxHere) {
      invalidMoveFeedback();
      return;
    }

    // Movement constraint from previous number
    if (maxNumber > 0 && !canMove(lastRow, lastCol, row, col)) {
      invalidMoveFeedback();
      return;
    }

    if (isFixedCell) {
      // Fixed cell can be used only when it matches nextNum
      if (cellVal !== String(nextNum)) {
        invalidMoveFeedback();
        return;
      }
    } else {
      // Normal cell must be empty
      if (cellVal !== "") return;

      // Lookahead: if next+1 is fixed, this move must allow reaching it
      const nf = fixedPos[nextNum + 1];
      if (nf && !canMove(row, col, nf.row, nf.col)) {
        invalidMoveFeedback();
        return;
      }
    }

    if (!hasStarted) {
      hasStarted = true;
      resetTimer();
      startTimer();
    }

    maxNumber = nextNum;
    cell.textContent = String(nextNum);
    clearLastNumberHighlight();
    cell.classList.add("last-number");
    lastRow = row;
    lastCol = col;
    vibrate(20);
    unlockAudio();
    playTick();

    cell.classList.add("just-placed");
    setTimeout(() => cell.classList.remove("just-placed"), 120);

    if (maxNumber === maxCells) {
      resetClasses();
      highlightHighest();
      stopTimer();
      showVictoryOverlay();

      if (timerSeconds > 0) {
        if (bestTimeSeconds === null || timerSeconds < bestTimeSeconds) {
          bestTimeSeconds = timerSeconds;
          localStorage.setItem(levelBestTimeKey(currentLevel), String(bestTimeSeconds));
          updateBestTimeDisplay();
          updateStatus("Completato! Tempo " + formatSeconds(timerSeconds) + ". Nuovo record per il livello " + currentLevel + "!");
        } else {
          updateStatus("Completato! Tempo " + formatSeconds(timerSeconds) + ". Miglior tempo livello " + currentLevel + ": " + formatSeconds(bestTimeSeconds) + ".");
        }
      } else {
        updateStatus("Completato!");
      }

      // Unlock next level (if enabled in this build)
      if (typeof unlockedLevel !== "undefined" && currentLevel === unlockedLevel && unlockedLevel < LEVEL_COUNT) {
        unlockedLevel += 1;
        localStorage.setItem("yawpUnlockedLevel", String(unlockedLevel));
        if (typeof updateLevelSelectUI === "function") updateLevelSelectUI();
      }

      return;
    }

    updateAllowedCells();
  }


  function parseCurrentStateAllowPrefix() {
    let currentMax = 0;
    let currentMaxDynamic = 0;
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
        // I numeri preimpostati (fixed) possono essere "nel futuro" e non devono influenzare il max corrente
        const isFixed = (cells[idx].dataset.fixed === "true");
        if (!isFixed) {
          currentMaxDynamic = Math.max(currentMaxDynamic, v);
        }
        currentMax = Math.max(currentMax, v);
        positions[v - 1] = { row: r, col: c };
      }
    }

    // per la logica della sequenza consideriamo come massimo solo ciò che il giocatore ha inserito
    // (i fixed restano sulla griglia ma non devono far scattare la correzione)
    const effectiveMax = Math.max(currentMaxDynamic, positions[0] ? 1 : 0);
    if (effectiveMax === 0) {
      updateStatus("La griglia è vuota. Inserisci almeno un 1 per iniziare.");
      return null;
    }

    if (!positions[0]) {
      updateStatus("Manca il numero 1: non posso ricostruire una sequenza coerente.");
      return null;
    }

    let prefixK = 1;
    for (let n = 2; n <= effectiveMax; n++) {
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
      currentMax: effectiveMax
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
          const cell = cells[idx];
          if (cell.dataset.fixed === "true") continue; // non toccare i numeri preimpostati
          const vStr = cell.textContent.trim();
          if (vStr === "") continue;
          const v = parseInt(vStr, 10);
          if (!isNaN(v) && v > state.prefixK) {
            cell.textContent = "";
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
        const nextNum = maxNumber + 1;
        if (cell.textContent.trim() === "" || (cell.dataset.fixed === "true" && cell.textContent.trim() === String(nextNum))) {
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
      updateStatus("Stato non coerente, rigenero il livello.");
      generateLevelLayout(currentLevel);
      loadBestTimeForLevel(currentLevel);
      updateBestTimeDisplay();
      invalidMoveFeedback();
      return;
    }

    undosUsed += 1;


    if (cells[foundIdx].dataset.fixed === "true") {
      // Il numero è fisso: non si cancella, ma si torna al numero precedente.
    } else {
      cells[foundIdx].textContent = "";
    }
    maxNumber -= 1;
    vibrate(30);
    syncLastNumberHighlight();

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
      updateStatus("Dopo l'annullamento lo stato non è coerente, rigenero il livello.");
      generateLevelLayout(currentLevel);
      loadBestTimeForLevel(currentLevel);
      updateBestTimeDisplay();
      invalidMoveFeedback();
      return;
    }

    lastRow = newLast.row;
    lastCol = newLast.col;

    syncLastNumberHighlight();

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
    hintsUsed += 1;
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

  
  function updateLevelSelectUI() {
    if (!levelSelect) return;

    // popola opzioni se vuote
    if (levelSelect.options.length === 0) {
      for (let i = 1; i <= LEVEL_COUNT; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = String(i);
        levelSelect.appendChild(opt);
      }
    }

    for (let i = 0; i < levelSelect.options.length; i++) {
      const lv = parseInt(levelSelect.options[i].value, 10);
      levelSelect.options[i].disabled = lv > unlockedLevel;
    }

    levelSelect.value = String(currentLevel);
  }

  function generateLevelLayout(level) {
    hintsUsed = 0;
    undosUsed = 0;
    const best = loadBestStats(level, gameMode);
    bestTimeSeconds = best ? best.bestTimeSeconds : null;

    clearLastNumberHighlight();
    // reset griglia
    cells.forEach(c => {
      c.textContent = "";
      c.classList.remove("allowed", "hint", "highest", "fixed", "just-placed");
      delete c.dataset.fixed;
    });

    maxNumber = 0;
    lastRow = null;
    lastCol = null;
    hasStarted = false;
    fixedPos = {};
    resetTimer();

    const fixedNums = FIXED_BY_LEVEL[level] || [];
    if (fixedNums.length === 0) {
      highlightHighest();
      updateAllowedCells();
      updateStatus("Livello " + level + ": nessun numero pre-inserito. Inserisci l'1 per iniziare.");
      return;
    }

    const maxNeed = Math.max(...fixedNums);

    // Trova un percorso valido abbastanza lungo
    let bestPath = null;
    let tries = 0;

    while (!bestPath && tries < 300) {
      tries += 1;
      const startRow = Math.floor(Math.random() * size);
      const startCol = Math.floor(Math.random() * size);

      const visited = Array.from({ length: size }, () => Array(size).fill(false));
      const positions = new Array(maxCells);
      visited[startRow][startCol] = true;
      positions[0] = { row: startRow, col: startCol };

      const state = { prefixK: 1, positions, visited, currentMax: 1 };
      const res = solveFromState(state);

      if (res.bestLen >= maxNeed) {
        bestPath = res.bestPath;
      }
    }

    // fallback: se non troviamo un path lungo, lasciamo livello senza fissi (molto raro)
    if (!bestPath) {
      highlightHighest();
      updateAllowedCells();
      updateStatus("Livello " + level + ": errore generazione layout. Riprova.");
      return;
    }

    // piazza solo i numeri richiesti come fissi
    fixedNums.forEach(n => {
      const pos = bestPath[n - 1];
      const idx = indexFromRowCol(pos.row, pos.col);
      const cell = cells[idx];
      cell.textContent = String(n);
      cell.dataset.fixed = "true";
      cell.classList.add("fixed");
      fixedPos[n] = { idx, row: pos.row, col: pos.col };
    });

    highlightHighest();
    updateAllowedCells();
    updateStatus(
      "Livello " + level + ": numeri fissi " + fixedNums.join(", ") +
      ". Inserisci l'1 per iniziare."
    );
  }

if (levelSelect) {
    levelSelect.addEventListener("change", () => {
      const lv = parseInt(levelSelect.value, 10);
      if (isNaN(lv)) return;
      if (lv > unlockedLevel) {
        levelSelect.value = String(currentLevel);
        return;
      }
      currentLevel = lv;
      loadBestTimeForLevel(currentLevel);
      updateBestTimeDisplay();
      generateLevelLayout(currentLevel);
    });
  }

  clearBtn.addEventListener("click", () => {
    generateLevelLayout(currentLevel);
    loadBestTimeForLevel(currentLevel);
    updateBestTimeDisplay();
  });
  // init UI
  updateLevelSelectUI();
  loadBestTimeForLevel(currentLevel);
  updateBestTimeDisplay();
  updateTimerDisplay();
  generateLevelLayout(currentLevel);
});