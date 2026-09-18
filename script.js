// ---------- tile data ----------
// grid position (row, col) walking clockwise around a 6x6 border, 20 tiles total
const GRID_POS = [
  [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1],
  [1, 2], [1, 3], [1, 4], [1, 5], [1, 6],
  [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
  [6, 5], [6, 4], [6, 3], [6, 2]
];

const TILES = [
  { type: "start", icon: "🚀", name: "起點 · 出發", quote: "每一個偉大的旅程，都從勇敢踏出第一步開始。" },
  { type: "regular", icon: "😊", name: "微笑角", quote: "慢慢來，比較快。" },
  { type: "regular", icon: "🌊", name: "沉澱站", quote: "休息，是為了走更長遠的路。" },
  { type: "chance", icon: "🍀", name: "機會之門", quote: "機會，總是留給準備好的人。" },
  { type: "regular", icon: "🦁", name: "勇氣小徑", quote: "你比想像中更勇敢。" },
  { type: "regular", icon: "🍭", name: "幸運轉角", quote: "有些路只能一個人走，但你並不孤單。" },
  { type: "regular", icon: "🌱", name: "初心亭", quote: "別忘了當初為什麼出發。" },
  { type: "regular", icon: "🙏", name: "感恩驛站", quote: "感恩，讓平凡變得不凡。" },
  { type: "fate", icon: "🎡", name: "命運轉輪", quote: "命運不是等待，而是選擇。" },
  { type: "regular", icon: "✨", name: "微光巷", quote: "黑暗之後，總會迎來微光。" },
  { type: "regular", icon: "🏖️", name: "度假小站", quote: "放慢腳步，享受此刻的風景。" },
  { type: "regular", icon: "⛰️", name: "堅持坡", quote: "山頂的風景，屬於堅持到底的人。" },
  { type: "regular", icon: "😄", name: "微笑驛站", quote: "微笑，是最好的名片。" },
  { type: "chance", icon: "🎯", name: "機遇轉盤", quote: "勇敢踏出第一步，機會就在下一秒。" },
  { type: "regular", icon: "💧", name: "初衷之泉", quote: "你的努力，時間都看得見。" },
  { type: "regular", icon: "🌬️", name: "深呼吸角落", quote: "先別急著否定自己，深呼吸，再出發。" },
  { type: "regular", icon: "🕊️", name: "放手橋", quote: "學會放手，才能擁抱新的開始。" },
  { type: "regular", icon: "🌅", name: "重生港", quote: "每一次跌倒，都是重新站起的練習。" },
  { type: "fate", icon: "🔮", name: "命運交叉口", quote: "風雨過後，總會遇見屬於你的彩虹。" },
  { type: "regular", icon: "🕯️", name: "信念燈塔", quote: "相信自己，你比昨天更強大。" },
];

const TYPE_LABEL = {
  start: "起點",
  regular: "人生小語",
  chance: "機會",
  fate: "命運",
};

const TILE_COUNT = TILES.length; // 20

// ---------- sound engine (synthesized, no audio files needed) ----------
const SFX = (() => {
  let ctx = null;
  let enabled = true;
  try {
    const saved = localStorage.getItem("monopoly-sound");
    if (saved !== null) enabled = saved === "1";
  } catch (e) {
    /* localStorage unavailable, keep sound on */
  }

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, duration = 0.12, type = "sine", volume = 0.2, delay = 0, freqEnd = null }) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  return {
    isEnabled: () => enabled,
    unlock() {
      getCtx();
    },
    toggle() {
      enabled = !enabled;
      try {
        localStorage.setItem("monopoly-sound", enabled ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      if (enabled) {
        getCtx();
        this.click();
      }
      return enabled;
    },
    click() {
      tone({ freq: 720, duration: 0.06, type: "triangle", volume: 0.18 });
    },
    tick() {
      tone({ freq: 850 + Math.random() * 300, duration: 0.035, type: "square", volume: 0.09 });
    },
    step() {
      tone({ freq: 500, duration: 0.08, type: "triangle", volume: 0.15, freqEnd: 720 });
    },
    passStart() {
      [0, 0.09].forEach((d, i) => tone({ freq: 660 + i * 220, duration: 0.18, type: "sine", volume: 0.22, delay: d }));
    },
    landRegular() {
      [523.25, 659.25].forEach((f, i) => tone({ freq: f, duration: 0.22, type: "sine", volume: 0.2, delay: i * 0.08 }));
    },
    landChance() {
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, duration: 0.2, type: "triangle", volume: 0.2, delay: i * 0.09 })
      );
    },
    landFate() {
      [392, 466.16, 587.33].forEach((f, i) =>
        tone({ freq: f, duration: 0.26, type: "sawtooth", volume: 0.13, delay: i * 0.1 })
      );
    },
    landStart() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, duration: 0.26, type: "sine", volume: 0.2, delay: i * 0.08 })
      );
    },
  };
})();

// ---------- state ----------
let position = 0;
let laps = 0;
let busy = false;

// ---------- DOM ----------
const boardEl = document.getElementById("board");
const centerPanel = document.getElementById("centerPanel");
const tokenEl = document.getElementById("token");
const diceEl = document.getElementById("dice");
const diceNumberEl = document.getElementById("diceNumber");
const rollBtn = document.getElementById("rollBtn");
const posLabel = document.getElementById("posLabel");
const rollLabel = document.getElementById("rollLabel");
const lapLabel = document.getElementById("lapLabel");
const historyList = document.getElementById("historyList");
const toastEl = document.getElementById("toast");
const modalOverlay = document.getElementById("modalOverlay");
const modalCard = document.getElementById("modalCard");
const modalIcon = document.getElementById("modalIcon");
const modalType = document.getElementById("modalType");
const modalName = document.getElementById("modalName");
const modalQuote = document.getElementById("modalQuote");
const modalClose = document.getElementById("modalClose");
const confettiLayer = document.getElementById("confettiLayer");
const soundToggle = document.getElementById("soundToggle");
const soundIcon = document.getElementById("soundIcon");
const stageEl = document.querySelector(".stage");
const boardWrapEl = document.querySelector(".board-wrap");

// ---------- build board ----------
const tileEls = [];

function buildBoard() {
  TILES.forEach((tile, i) => {
    const [row, col] = GRID_POS[i];
    const el = document.createElement("div");
    el.className = `tile type-${tile.type}`;
    el.style.gridRow = row;
    el.style.gridColumn = col;
    el.innerHTML = `
      <div class="tile-icon">${tile.icon}</div>
      <div class="tile-name">${tile.name}</div>
    `;
    boardEl.insertBefore(el, centerPanel);
    tileEls.push(el);
  });
}

// ---------- fit board to the available viewport (no overflow, no scroll) ----------
function fitBoard() {
  if (!stageEl || !boardWrapEl) return;
  const cs = getComputedStyle(stageEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = stageEl.clientWidth - padX;
  const availH = stageEl.clientHeight - padY;
  const size = Math.max(220, Math.min(availW, availH, 760));
  boardWrapEl.style.width = `${size}px`;
  boardWrapEl.style.height = `${size}px`;
}

function placeTokenInstant(index) {
  const tileEl = tileEls[index];
  const boardRect = boardEl.getBoundingClientRect();
  const rect = tileEl.getBoundingClientRect();
  const x = rect.left - boardRect.left + rect.width / 2 - tokenEl.offsetWidth / 2;
  const y = rect.top - boardRect.top + rect.height / 2 - tokenEl.offsetHeight / 2;
  tokenEl.style.left = `${x}px`;
  tokenEl.style.top = `${y}px`;
}

function moveTokenTo(index, hop = true) {
  placeTokenInstant(index);
  if (hop) {
    tokenEl.classList.remove("hop");
    // force reflow so the animation restarts
    void tokenEl.offsetWidth;
    tokenEl.classList.add("hop");
  }
}

function highlightTile(index, cls, duration) {
  const el = tileEls[index];
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duration);
}

// ---------- helpers ----------
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

function spawnConfetti() {
  const colors = ["#7c5cff", "#ff5ca8", "#35e0ff", "#ffd166", "#35e0a0"];
  const count = 36;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.background = color;
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}

function addHistory(roll, tile) {
  const li = document.createElement("li");
  li.textContent = `擲出 ${roll} → 走到「${tile.name}」`;
  historyList.appendChild(li);
  while (historyList.children.length > 30) {
    historyList.removeChild(historyList.firstChild);
  }
}

// ---------- modal ----------
const LAND_SOUND = {
  start: () => SFX.landStart(),
  chance: () => SFX.landChance(),
  fate: () => SFX.landFate(),
  regular: () => SFX.landRegular(),
};

function openModal(tile) {
  modalIcon.textContent = tile.icon;
  modalType.textContent = TYPE_LABEL[tile.type];
  modalName.textContent = tile.name;
  modalQuote.textContent = tile.quote;
  modalOverlay.classList.add("show");
  (LAND_SOUND[tile.type] || LAND_SOUND.regular)();
  if (tile.type !== "regular" && tile.type !== "start") {
    spawnConfetti();
  }
}

function closeModal() {
  modalOverlay.classList.remove("show");
  SFX.click();
  busy = false;
  rollBtn.disabled = false;
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ---------- sound toggle ----------
function syncSoundIcon() {
  const on = SFX.isEnabled();
  soundIcon.textContent = on ? "🔊" : "🔇";
  soundToggle.classList.toggle("muted", !on);
  soundToggle.setAttribute("aria-label", on ? "關閉音效" : "開啟音效");
}

soundToggle.addEventListener("click", () => {
  SFX.toggle();
  syncSoundIcon();
});

// ---------- dice roll ----------
async function rollDiceAnimation(finalValue) {
  diceEl.classList.add("rolling");
  const cycles = 14;
  for (let i = 0; i < cycles; i++) {
    diceNumberEl.textContent = 1 + Math.floor(Math.random() * TILE_COUNT);
    SFX.tick();
    await delay(45 + i * 4);
  }
  diceEl.classList.remove("rolling");
  diceNumberEl.textContent = finalValue;
}

async function walk(steps) {
  let passedStart = false;
  for (let i = 0; i < steps; i++) {
    position = (position + 1) % TILE_COUNT;
    moveTokenTo(position, true);
    if (position === 0) {
      laps += 1;
      passedStart = true;
      lapLabel.textContent = String(laps);
      showToast("🎉 經過起點！");
      SFX.passStart();
    } else {
      highlightTile(position, "passing", 300);
      SFX.step();
    }
    await delay(150);
  }
  return passedStart;
}

async function handleRoll() {
  if (busy) return;
  busy = true;
  rollBtn.disabled = true;
  SFX.unlock();
  SFX.click();

  const roll = 1 + Math.floor(Math.random() * TILE_COUNT);
  rollLabel.textContent = String(roll);

  await rollDiceAnimation(roll);
  await delay(150);

  await walk(roll);

  const tile = TILES[position];
  posLabel.textContent = tile.name;
  addHistory(roll, tile);
  tileEls[position].classList.add("active-tile");
  setTimeout(() => tileEls[position].classList.remove("active-tile"), 1400);

  await delay(200);
  openModal(tile);
  // busy / rollBtn re-enabled when modal closes
}

rollBtn.addEventListener("click", handleRoll);

// ---------- init ----------
let resizeRAF = null;
function handleResize() {
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(() => {
    fitBoard();
    moveTokenTo(position, false);
  });
}

function init() {
  buildBoard();
  syncSoundIcon();
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  // wait a frame so layout is ready before sizing the board and placing the token
  requestAnimationFrame(() => {
    fitBoard();
    moveTokenTo(position, false);
    posLabel.textContent = TILES[0].name;
  });
}

init();
