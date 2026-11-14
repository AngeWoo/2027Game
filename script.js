// ---------- tile data ----------
// grid position (row, col) walking clockwise around a 6x6 border, 20 tiles total
const GRID_POS = [
  [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1],
  [1, 2], [1, 3], [1, 4], [1, 5], [1, 6],
  [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
  [6, 5], [6, 4], [6, 3], [6, 2]
];

// regular tiles are renamed to random 全球真如苑 locations at load (see dealTemples)
const TILES = [
  { type: "start", name: "寒修行原點", quote: "每一個偉大的旅程，都從勇敢踏出第一步開始。" },
  { type: "regular", name: "精舍", quote: "慢慢來，比較快。" },
  { type: "regular", name: "精舍", quote: "休息，是為了走更長遠的路。" },
  { type: "chance", name: "機會", quote: "機會，總是留給準備好的人。" },
  { type: "regular", name: "精舍", quote: "你比想像中更勇敢。" },
  { type: "regular", name: "精舍", quote: "有些路只能一個人走，但你並不孤單。" },
  { type: "regular", name: "精舍", quote: "別忘了當初為什麼出發。" },
  { type: "regular", name: "精舍", quote: "感恩，讓平凡變得不凡。" },
  { type: "fate", name: "命運", quote: "命運不是等待，而是選擇。" },
  { type: "regular", name: "精舍", quote: "黑暗之後，總會迎來微光。" },
  { type: "regular", name: "精舍", quote: "放慢腳步，享受此刻的風景。" },
  { type: "regular", name: "精舍", quote: "山頂的風景，屬於堅持到底的人。" },
  { type: "regular", name: "精舍", quote: "微笑，是最好的名片。" },
  { type: "chance", name: "機會", quote: "勇敢踏出第一步，機會就在下一秒。" },
  { type: "regular", name: "精舍", quote: "你的努力，時間都看得見。" },
  { type: "regular", name: "精舍", quote: "先別急著否定自己，深呼吸，再出發。" },
  { type: "regular", name: "精舍", quote: "學會放手，才能擁抱新的開始。" },
  { type: "regular", name: "精舍", quote: "每一次跌倒，都是重新站起的練習。" },
  { type: "fate", name: "命運", quote: "風雨過後，總會遇見屬於你的彩虹。" },
  { type: "regular", name: "精舍", quote: "相信自己，你比昨天更強大。" },
];

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

  // iPhone 的 Web Audio 預設跟側邊的「鈴聲／靜音」開關綁在一起：
  // 撥到靜音就一點聲音都沒有，音量鍵轉到底也沒用。
  // 把 audioSession 宣告成 playback（Safari 16.4+），才會像看影片一樣不受靜音開關影響。
  function claimAudioSession() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) {
      /* 舊瀏覽器沒有這個，忽略 */
    }
  }

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      claimAudioSession();
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // iOS 規定要在使用者手勢裡「真的播出」一次聲音，之後排的聲音才放得出來。
  // 這裡送一個 1 格的無聲 buffer，使用者聽不到，但足以解鎖。
  let unlocked = false;
  function unlockNow() {
    if (!enabled) return; // 使用者自己關掉音效時，不要去搶走他正在聽的音樂
    claimAudioSession();
    const c = getCtx();
    if (!c) return;
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch (e) {
      /* ignore */
    }
    if (c.state === "running") unlocked = true;
  }

  // 不用等到按擲骰：第一次碰到畫面的任何地方就先解鎖
  function firstTouch() {
    unlockNow();
    if (!unlocked) return;
    document.removeEventListener("pointerdown", firstTouch);
    document.removeEventListener("touchend", firstTouch);
  }
  document.addEventListener("pointerdown", firstTouch, { passive: true });
  document.addEventListener("touchend", firstTouch, { passive: true });

  // 切去別的 App 再切回來，手機會把音訊停掉，回來要重新叫醒
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ctx && ctx.state === "suspended") ctx.resume();
  });

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
      unlockNow();
    },
    toggle() {
      enabled = !enabled;
      try {
        localStorage.setItem("monopoly-sound", enabled ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      if (enabled) {
        unlockNow();
        this.click();
      }
      return enabled;
    },
    click() {
      tone({ freq: 720, duration: 0.06, type: "triangle", volume: 0.18 });
    },
    diceHit() {
      tone({ freq: 240 + Math.random() * 80, freqEnd: 110, duration: 0.07, type: "triangle", volume: 0.2 });
      tone({ freq: 1400 + Math.random() * 600, duration: 0.025, type: "square", volume: 0.05 });
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
    // 機會: bright rising C-major fanfare + high sparkle pings
    landChance() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone({ freq: f, duration: 0.22, type: "triangle", volume: 0.2, delay: i * 0.07 })
      );
      tone({ freq: 1046.5, duration: 0.6, type: "sine", volume: 0.14, delay: 0.38 });
      for (let i = 0; i < 6; i++) {
        tone({ freq: 2200 + Math.random() * 1600, duration: 0.08, type: "sine", volume: 0.06, delay: 0.42 + i * 0.07 });
      }
    },
    // 命運: low gong, then slow, mysterious A-minor(add9) bells
    landFate() {
      tone({ freq: 98, freqEnd: 92, duration: 1.8, type: "sine", volume: 0.32 });
      tone({ freq: 196, freqEnd: 188, duration: 1.2, type: "triangle", volume: 0.1 });
      [440, 523.25, 659.25, 987.77].forEach((f, i) =>
        tone({ freq: f, duration: 1.1, type: "sine", volume: 0.12, delay: 0.25 + i * 0.22 })
      );
    },
    landStart() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, duration: 0.26, type: "sine", volume: 0.2, delay: i * 0.08 })
      );
    },
    // 答對：明亮上行三音
    quizRight() {
      [659.25, 880, 1174.66].forEach((f, i) =>
        tone({ freq: f, duration: 0.2, type: "sine", volume: 0.2, delay: i * 0.07 })
      );
    },
    // 御守降下：低沉的鈴聲，再疊上五聲音階的清亮尾音
    omamori() {
      tone({ freq: 196, freqEnd: 190, duration: 1.8, type: "sine", volume: 0.2 });
      tone({ freq: 392, freqEnd: 384, duration: 1.1, type: "triangle", volume: 0.07 });
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
        tone({ freq: f, duration: 0.95, type: "sine", volume: 0.11, delay: 0.3 + i * 0.24 })
      );
    },
    // 答錯：柔和下行兩音（不刺耳）
    quizWrong() {
      tone({ freq: 330, freqEnd: 247, duration: 0.3, type: "triangle", volume: 0.18 });
      tone({ freq: 165, duration: 0.34, type: "sine", volume: 0.12, delay: 0.06 });
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
const diceTrayEl = document.getElementById("diceTray");
const diceTotalEl = document.getElementById("diceTotal");
const hintStepsEl = document.getElementById("hintSteps");
const worldStepsEl = document.getElementById("worldSteps");
const qaRightEl = document.getElementById("qaRight");
const qaWrongEl = document.getElementById("qaWrong");
const rollBtn = document.getElementById("rollBtn");
const toastEl = document.getElementById("toast");
const modalOverlay = document.getElementById("modalOverlay");
const modalCard = document.getElementById("modalCard");
const modalIcon = document.getElementById("modalIcon");
const modalPlace = document.getElementById("modalPlace");
const modalName = document.getElementById("modalName");
const modalQuote = document.getElementById("modalQuote");
const modalNum = document.getElementById("modalNum");
const modalClose = document.getElementById("modalClose");
const quizOverlay = document.getElementById("quizOverlay");
const quizCard = document.getElementById("quizCard");
const quizNo = document.getElementById("quizNo");
const quizQ = document.getElementById("quizQ");
const quizOptions = document.getElementById("quizOptions");
const quizResult = document.getElementById("quizResult");
const quizVerdict = document.getElementById("quizVerdict");
const quizExplain = document.getElementById("quizExplain");
const quizClose = document.getElementById("quizClose");
const quizX = document.getElementById("quizX");
const omamoriOverlay = document.getElementById("omamoriOverlay");
const omamoriCard = document.getElementById("omamoriCard");
const omamoriNo = document.getElementById("omamoriNo");
const omamoriStage = document.getElementById("omamoriStage");
const omamoriImg = document.getElementById("omamoriImg");
const omamoriClose = document.getElementById("omamoriClose");
const omamoriSave = document.getElementById("omamoriSave");
const omamoriX = document.getElementById("omamoriX");
const omamoriCountEl = document.getElementById("omamoriCount");
const omamoriWordText = document.getElementById("omamoriWordText");
const omamoriWordBy = document.getElementById("omamoriWordBy");
const confettiLayer = document.getElementById("confettiLayer");
const soundToggle = document.getElementById("soundToggle");
const soundIcon = document.getElementById("soundIcon");
const stageEl = document.querySelector(".stage");
const boardWrapEl = document.querySelector(".board-wrap");

// ---------- tile icons: sun / moon / blue star / green star, randomly dealt ----------
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function sunRays() {
  let d = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tip = [50 + 46 * Math.cos(a), 50 + 46 * Math.sin(a)];
    const l = [50 + 27 * Math.cos(a - 0.2), 50 + 27 * Math.sin(a - 0.2)];
    const r = [50 + 27 * Math.cos(a + 0.2), 50 + 27 * Math.sin(a + 0.2)];
    d += `M${l.map((v) => v.toFixed(1))}L${tip.map((v) => v.toFixed(1))}L${r.map((v) => v.toFixed(1))}Z`;
  }
  return d;
}

const svgIcon = (color, body) =>
  `<svg class="sym" viewBox="0 0 100 100" style="--glow:${color}" aria-hidden="true">${body}</svg>`;

const SYMBOLS = [
  svgIcon("#e8262a", `<path fill="#e8262a" d="${sunRays()}"/><circle cx="50" cy="50" r="24" fill="#e8262a"/>`),
  svgIcon(
    "#f5a800",
    `<path fill="#f5a800" d="M60 12 A40 40 0 1 0 88 66 A32 32 0 0 1 60 12 Z"/>`
  ),
  svgIcon("#c7547a", `<polygon fill="#c7547a" points="${starPoints(50, 53, 46, 19)}"/>`),
  svgIcon("#87a033", `<polygon fill="#87a033" points="${starPoints(50, 53, 46, 19)}"/>`),
];

// deal the 4 symbols evenly (5 each for 20 tiles), shuffled on every page load
function dealSymbols() {
  const deck = TILES.map((_, i) => SYMBOLS[i % SYMBOLS.length]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  TILES.forEach((tile, i) => (tile.icon = deck[i]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// always on the board (日本 總本部 / 應現院, 東京都立川市)
const TEMPLES_REQUIRED = ["真如苑總本部、真澄寺", "應現院"];
// 全球真如苑 locations (Global Shinnyo-en map); the remaining regular tiles get a random pick
const TEMPLES = [
  // 亞洲
  "真如苑台灣", "真如苑韓國", "真如苑香港", "真如苑泰國", "真如苑新加坡", "真如苑斯里蘭卡",
  // 歐洲
  "真如苑法國(歐洲本部)", "真如苑義大利", "真如苑德國慕尼黑", "真如苑比利時", "真如苑英國",
  // 美洲
  "真如苑夏威夷", "真如苑美國本部", "洛杉磯精舍", "西雅圖精舍", "紐約精舍", "芝加哥精舍", "真如苑巴西",
  // 大洋洲
  "真如苑澳洲",
];

// every page load: the required ones plus random others, placed in random order
function dealTemples() {
  const regular = TILES.filter((t) => t.type === "regular");
  const others = shuffle(TEMPLES).slice(0, regular.length - TEMPLES_REQUIRED.length);
  const names = shuffle([...TEMPLES_REQUIRED, ...others]);
  regular.forEach((tile, i) => (tile.name = names[i]));
}

// ---------- build board ----------
const tileEls = [];

function buildBoard() {
  dealSymbols();
  dealTemples();
  TILES.forEach((tile, i) => {
    const [row, col] = GRID_POS[i];
    const el = document.createElement("div");
    el.className = `tile type-${tile.type}`;
    el.style.gridRow = row;
    el.style.gridColumn = col;
    el.innerHTML = `
      <div class="tile-icon">${tile.icon}</div>
      <div class="tile-name">${tile.name.replace(/^真如苑/, "真如苑<wbr>").replace("(", "<wbr>(").replace("、", "、<wbr>")}</div>
    `;
    boardEl.insertBefore(el, centerPanel);
    tileEls.push(el);
  });
}

// ---------- fit board to fill the available viewport (no overflow, no scroll) ----------
// The board stretches to the space it has; only its aspect ratio is kept within
// sane bounds so tiles never get absurdly flat (wide screens) or thin (tall phones).
const BOARD_MAX_WIDE = 2.0; //  width  ≤ 2.0 × height
const BOARD_MAX_TALL = 2.0; //  height ≤ 2.0 × width
const TILE_PASS_GROW = 10; // px added while the token passes a tile
const TILE_LAND_GROW = 7; //  px added to the tile the token lands on
let lastFitKey = "";
function fitBoard() {
  if (!stageEl || !boardWrapEl) return;
  const cs = getComputedStyle(stageEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  let w = Math.max(220, stageEl.clientWidth - padX);
  let h = Math.max(220, stageEl.clientHeight - padY);
  w = Math.min(w, h * BOARD_MAX_WIDE);
  h = Math.min(h, w * BOARD_MAX_TALL);
  // 尺寸跟上次一樣就不必再量一輪字級（那是最貴的部分，約 16ms）
  const fitKey = `${Math.floor(w)}x${Math.floor(h)}`;
  if (fitKey === lastFitKey) return;
  lastFitKey = fitKey;
  boardWrapEl.style.width = `${Math.floor(w)}px`;
  boardWrapEl.style.height = `${Math.floor(h)}px`;

  // grow highlighted tiles by a fixed number of pixels (what looks right on a phone),
  // not a fixed percentage — big desktop tiles would otherwise balloon over their neighbours
  const tile = tileEls[1];
  if (tile) {
    const base = Math.min(tile.offsetWidth, tile.offsetHeight) || 1;
    boardEl.style.setProperty("--pass-scale", (1 + TILE_PASS_GROW / base).toFixed(3));
    boardEl.style.setProperty("--land-scale", (1 + TILE_LAND_GROW / base).toFixed(3));
  }
  fitTileNames();
}

// Largest shared font size at which every place-name tile fits: no word cut mid-way,
// at most 3 lines, and icon + name inside the tile. Big desktop tiles → big text.
const NAME_MIN = 8;
const NAME_MAX = 26;
function fitTileNames() {
  const items = tileEls
    .filter((_, i) => TILES[i].type === "regular" || TILES[i].type === "start")
    .map((tile) => ({ tile, name: tile.querySelector(".tile-name"), icon: tile.querySelector(".tile-icon") }))
    .filter(({ name }) => name.offsetParent !== null && getComputedStyle(name).display !== "none");
  boardEl.style.removeProperty("--name-size");
  if (!items.length) return;

  const fits = (size) => {
    boardEl.style.setProperty("--name-size", `${size}px`);
    return items.every(({ tile, name, icon }) => {
      const iconH = icon && getComputedStyle(icon).display !== "none" ? icon.offsetHeight + 4 : 0;
      return (
        name.scrollWidth <= name.clientWidth + 0.5 &&
        name.offsetHeight <= size * 1.2 * 3 + 1 &&
        iconH + name.offsetHeight <= tile.clientHeight - 6
      );
    });
  };

  let lo = NAME_MIN;
  let hi = NAME_MAX;
  if (!fits(lo)) return fits(lo); // too cramped even at the minimum: keep it at the minimum
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  boardEl.style.setProperty("--name-size", `${lo.toFixed(1)}px`);
}

function placeTokenInstant(index) {
  const tileEl = tileEls[index];
  // layout offsets (relative to the board), unaffected by the tiles' scale animations
  const w = tileEl.offsetWidth;
  const h = tileEl.offsetHeight;
  // sit in the tile's top-right corner so the token never covers the tile's icon/name
  const inset = Math.max(3, Math.min(w, h) * 0.06);
  const x = tileEl.offsetLeft + w - tokenEl.offsetWidth - inset;
  const y = tileEl.offsetTop + inset;
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

const rand = (min, max) => min + Math.random() * (max - min);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function addPiece(className, style) {
  const el = document.createElement("div");
  el.className = className;
  Object.assign(el.style, style);
  confettiLayer.appendChild(el);
  return el;
}

// 機會: golden fireworks burst from the centre — pieces shoot out, then fall under gravity
function spawnChanceBurst() {
  const colors = ["#e2791f", "#d1544a", "#f0a52e", "#b45309", "#e8b230"];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.42;
  const reach = Math.min(window.innerWidth, window.innerHeight) * 0.55;
  for (let i = 0; i < 70; i++) {
    const star = i % 4 === 0;
    const color = pickOne(colors);
    const el = addPiece(star ? "fx-star" : "fx-chip", {
      left: `${cx}px`,
      top: `${cy}px`,
      ...(star ? { color } : { background: color }),
    });
    const angle = rand(0, Math.PI * 2);
    const dist = rand(0.35, 1) * reach;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - reach * 0.25;
    const spin = rand(-720, 720);
    const dur = rand(1500, 2300);
    el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.35, easing: "cubic-bezier(.3,0,.8,.6)" },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + reach * 0.9}px)) scale(0.9) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" }
    ).finished.then(() => el.remove());
  }
}

// 命運: mysterious petals drifting slowly down from the top, swaying and turning
function spawnFatePetals() {
  const colors = [
    "linear-gradient(135deg, #ffb48f, #d9663f)",
    "linear-gradient(135deg, #ffd79a, #e09a3c)",
    "linear-gradient(135deg, #f7a79c, #c75a52)",
    "linear-gradient(135deg, #ffcfae, #e2855a)",
  ];
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < 34; i++) {
    const size = rand(10, 20);
    const el = addPiece("fx-petal", {
      left: `${rand(0, w)}px`,
      top: `${-size * 2}px`,
      width: `${size}px`,
      height: `${size * 1.4}px`,
      background: pickOne(colors),
    });
    const sway = rand(30, 90) * (Math.random() < 0.5 ? -1 : 1);
    const turn = rand(180, 540) * (Math.random() < 0.5 ? -1 : 1);
    const fall = h + size * 4;
    el.animate(
      [
        { transform: "translate(0, 0) rotate(0deg) rotateY(0deg)", opacity: 0 },
        { transform: `translate(${sway}px, ${fall * 0.25}px) rotate(${turn * 0.25}deg) rotateY(180deg)`, opacity: 0.95, offset: 0.15 },
        { transform: `translate(${-sway}px, ${fall * 0.55}px) rotate(${turn * 0.55}deg) rotateY(360deg)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${sway * 0.6}px, ${fall}px) rotate(${turn}deg) rotateY(540deg)`, opacity: 0 },
      ],
      { duration: rand(3200, 4800), delay: rand(0, 900), easing: "linear", fill: "both" }
    ).finished.then(() => el.remove());
  }
}

const LAND_FX = { chance: spawnChanceBurst, fate: spawnFatePetals };

// ---------- quotes ----------
// Each pool: live Google Sheet first; if blocked/offline, the local snapshot; then a built-in list.
// 今日實踐 pool — used by the regular tiles.
const YUANGE = {
  // 今日實踐句（不再讀取舊的苑歌月曆 Google Sheet）
  sheet: null,
  local: "quotes.csv",
  rows: [
    "禮讓行人",
    "面帶笑容 耐心傾聽",
    "說好語 給予正面回應",
    "表達感謝 謙虛待人",
    "主動打招呼 表達關懷",
    "垃圾分類做資源回收",
    "為戰事與受災者祈福",
    "為別人祈福",
    "站在對方立場設想",
    "溫柔說好 謝謝 對不起",
    "與他人分享我會的事",
    "善用資源 不浪費",
    "尊重他人",
    "喜悅之事 樂於分享",
    "大方讚美他人",
    "讓他人感到愉悅和放鬆 營造和諧",
  ],
  last: -1,
};
// 機會 / 命運 pool — same sheet as wt_2025/index.html
const WT = {
  sheet:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlArx460gMLKbiCQT1yroqX1tEkLFGRjBn7CB8f4eXtuek_5HKQ0FEQhZ1cAUfeDZl1m_SagzPGrHE/pub?gid=0&single=true&output=csv",
  local: "wt_quotes.csv",
  rows: [
    "(摘錄《這時候。深呼吸》)心痛悲傷時，失去信心時，請閉上眼睛想一想，自己是與佛陀同在的。",
    "(摘錄《這時候。深呼吸》)想要努力，想做得更好，這也是一種幸福。",
    "(摘錄《真如人生》)抬起頭、深呼吸，一步一步走出去，積極面對人生。",
  ],
  last: -1,
};

async function loadCsv(url) {
  const res = await fetch(url, { cache: "no-cache" }); // 每次都向伺服器確認有沒有更新
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.text())
    .split("\n")
    .map((row) => row.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
    .filter(Boolean);
  if (rows.length === 0) throw new Error("No data fetched");
  return rows;
}

async function fetchPool(pool) {
  for (const url of [pool.sheet, pool.local].filter(Boolean)) {
    try {
      pool.rows = await loadCsv(url);
      return;
    } catch (err) {
      console.warn(`讀取 ${url} 失敗:`, err);
    }
  }
  console.error("獲取 Sheet 數據失敗，使用默認數據");
}

function fetchQuotes() {
  fetchPool(YUANGE);
  fetchPool(WT);
}

// 苑歌: "《92》佛陀之恩澤,廣庇全天下(苑歌月曆–常樂1)" → { num, text, source }
function parseYuange(raw) {
  let num = "";
  let text = raw.trim();
  let source = "";
  const numMatch = text.match(/^《\s*(\d+)\s*》\s*(.*)$/) || text.match(/^(\d+)\s*》?\s*(.*)$/);
  if (numMatch) {
    num = numMatch[1];
    text = numMatch[2].trim();
  }
  const srcMatch = text.match(/^(.*?)\s*[(（]([^()（）]+)[)）]\s*$/);
  if (srcMatch && srcMatch[1]) {
    text = srcMatch[1];
    source = srcMatch[2];
  }
  return { num, text, source };
}

// wt_2025: "(摘錄《真如人生》)誠實面對自己的感覺是很重要的。" → { text, source: "《真如人生》" }
function parseWt(raw) {
  const m = raw.trim().match(/^[(（]([^)）]*)[)）]\s*(.*)$/);
  if (!m) return { num: "", text: raw.trim(), source: "" };
  return { num: "", text: m[2].trim(), source: m[1].replace(/^摘錄\s*/, "").trim() };
}

function pickFrom(pool) {
  let i = Math.floor(Math.random() * pool.rows.length);
  if (pool.rows.length > 1 && i === pool.last) i = (i + 1) % pool.rows.length;
  pool.last = i;
  return pool.rows[i];
}

// ---------- 彈窗的焦點管理 ----------
// 開啟：背景設成 inert（不能 Tab、不能點、讀螢幕軟體也略過），焦點移進視窗，雪花暫停。
// 關閉：把這一切還原，焦點回到擲骰按鈕。
const BG_SELECTORS = ".page-head, .stage, #soundToggle, .admin-dot";

function setBackgroundInert(on) {
  document.querySelectorAll(BG_SELECTORS).forEach((el) => {
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}

function dialogOpened(card, focusEl) {
  setBackgroundInert(true);
  if (snowCtl) snowCtl.pause();
  (focusEl || card).focus({ preventScroll: true }); // 視窗只是透明度 0，不是 display:none，可以直接收焦點
}

function dialogsClosed() {
  setBackgroundInert(false);
  if (snowCtl) snowCtl.resume();
}

function focusablesIn(root) {
  return [
    ...root.querySelectorAll('button:not([disabled]):not([hidden]), [href], input:not([disabled])'),
  ].filter((el) => el.offsetParent !== null);
}

// 視窗開著時，Tab 只在視窗裡面繞圈
function trapTab(e, card) {
  if (e.key !== "Tab") return;
  const list = focusablesIn(card);
  if (!list.length) {
    e.preventDefault();
    card.focus();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || at === card)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && at === last) {
    e.preventDefault();
    first.focus();
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
  const isLuck = tile.type === "chance" || tile.type === "fate";
  const q = isLuck ? parseWt(pickFrom(WT)) : parseYuange(pickFrom(YUANGE));
  modalIcon.innerHTML = tile.icon;
  modalPlace.textContent = tile.name;
  modalName.textContent = q.source || (isLuck ? tile.name : "今日實踐");
  modalNum.textContent = q.num ? `《${q.num}》` : "";
  modalQuote.textContent = q.text || tile.quote;
  afterModal = true; // 每一格關閉後都接一個小視窗（機會／命運也含在內）
  modalOverlay.classList.add("show");
  dialogOpened(modalCard, modalClose);
  (LAND_SOUND[tile.type] || LAND_SOUND.regular)();
  if (LAND_FX[tile.type] && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    LAND_FX[tile.type]();
  }
}

// 任何一格的視窗關閉後都接一個小視窗：
// index.html 送一張御守；舊的 index - Q&A.html 還是出一題檢定。
let afterModal = false;

function closeModal() {
  modalOverlay.classList.remove("show");
  SFX.click();
  if (afterModal) {
    afterModal = false;
    if (omamoriOverlay) {
      setTimeout(openOmamori, 260);
      return;
    }
    if (quizOverlay) {
      setTimeout(openQuiz, 220);
      return;
    }
  }
  endTurn();
}

function endTurn() {
  busy = false;
  rollBtn.disabled = false;
  dialogsClosed();
  rollBtn.focus({ preventScroll: true }); // 鍵盤使用者按 Enter 就能直接再擲
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ---------- 寒修行與教義檢定小視窗 ----------
// 題庫來源，依序嘗試：
//   1. Google 試算表（發布為 CSV）— 平常就在那裡新增／修改／刪除題目
//   2. quiz.json          — 同資料夾的快照，試算表讀不到時頂著
//   3. quiz.js 內建的 QUIZ — 最後的保險
// quiz.js 以 const 宣告，不會掛在 window 上，所以用 typeof 判斷。
const QUIZ_BANK = {
  sheet:
    "https://docs.google.com/spreadsheets/d/10XOptiWlH3KWV1nI9bP9odEpemr1dndmH8Lc0cjUMwo/gviz/tq?tqx=out:csv&gid=0",
  local: "quiz.json",
};

const QUIZ_POOL = {
  rows: typeof QUIZ !== "undefined" && Array.isArray(QUIZ) ? QUIZ : [],
  last: -1,
  from: "內建",
};

const OPT_KEYS = ["A", "B", "C", "D", "E", "F"];

function isValidQuizItem(q) {
  return (
    q &&
    typeof q.q === "string" &&
    q.q.trim() &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    q.options.every((o) => typeof o === "string" && o.trim()) &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer < q.options.length
  );
}

// 正規的 CSV 解析：處理引號包起來的欄位、欄位裡的逗號／換行／雙引號
function parseCsvTable(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// 試算表欄位：題目 | 選項A…選項F | 正解 | 解說（靠標題列對應，欄位順序可以換）
function quizFromCsv(text) {
  const table = parseCsvTable(text).filter((r) => r.some((c) => c && c.trim()));
  if (table.length < 2) throw new Error("試算表沒有資料");
  const head = table[0].map((h) => (h || "").trim());
  const qi = head.indexOf("題目");
  const ai = head.indexOf("正解");
  const ei = head.indexOf("解說");
  if (qi < 0 || ai < 0) throw new Error("標題列要有「題目」和「正解」");
  const optCols = OPT_KEYS.map((k) => head.indexOf("選項" + k));

  const out = [];
  for (const r of table.slice(1)) {
    const q = (r[qi] || "").trim();
    if (!q) continue;
    const want = (r[ai] || "").trim().toUpperCase();
    const options = [];
    let answer = -1;
    optCols.forEach((ci, n) => {
      if (ci < 0) return;
      const v = (r[ci] || "").trim();
      if (!v) return;
      if (OPT_KEYS[n] === want) answer = options.length;
      options.push(v);
    });
    const item = { q, options, answer, explain: ei >= 0 ? (r[ei] || "").trim() : "" };
    if (isValidQuizItem(item)) out.push(item);
  }
  if (!out.length) throw new Error("沒有讀到有效題目");
  return out;
}

async function loadQuizBank() {
  const sources = [
    { url: QUIZ_BANK.sheet, kind: "csv", name: "Google 試算表" },
    { url: QUIZ_BANK.local, kind: "json", name: "quiz.json" },
  ].filter((s) => s.url);

  for (const src of sources) {
    try {
      const sep = src.url.includes("?") ? "&" : "?";
      const res = await fetch(src.url + sep + "t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const rows =
        src.kind === "csv"
          ? quizFromCsv(text)
          : (JSON.parse(text) || []).filter(isValidQuizItem);
      if (rows.length) {
        QUIZ_POOL.rows = rows;
        QUIZ_POOL.last = -1;
        QUIZ_POOL.from = src.name;
        return;
      }
      throw new Error("沒有有效題目");
    } catch (e) {
      console.warn(`題庫 ${src.name} 讀取失敗：`, e.message || e);
    }
  }
  console.warn("改用 quiz.js 內建題庫");
}

function pickQuiz() {
  const n = QUIZ_POOL.rows.length;
  if (!n) return null;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === QUIZ_POOL.last) i = (i + 1) % n;
  QUIZ_POOL.last = i;
  return { item: QUIZ_POOL.rows[i], index: i };
}

let quizServed = 0; // 這次開啟頁面已經出了幾題
function openQuiz() {
  const picked = pickQuiz();
  if (!picked) {
    endTurn();
    return;
  }
  const { item } = picked;

  quizServed += 1;
  quizNo.textContent = `本次第 ${quizServed} 題`;
  quizQ.textContent = item.q;
  quizResult.hidden = true;
  quizVerdict.className = "quiz-verdict";
  quizClose.hidden = true;
  quizOptions.innerHTML = "";

  item.options.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-opt";
    btn.innerHTML = `<span class="opt-key">${OPT_KEYS[i] || i + 1}</span><span class="opt-text"></span>`;
    btn.querySelector(".opt-text").textContent = text;
    btn.addEventListener("click", () => gradeQuiz(item, i), { once: true });
    quizOptions.appendChild(btn);
  });

  quizOverlay.classList.add("show");
  dialogOpened(quizCard, quizOptions.querySelector(".quiz-opt"));
}

function gradeQuiz(item, chosen) {
  const right = chosen === item.answer;
  const btns = [...quizOptions.querySelectorAll(".quiz-opt")];
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === item.answer) b.classList.add("is-right");
    else if (i === chosen) b.classList.add("is-wrong");
    else b.classList.add("dimmed");
  });

  quizVerdict.className = `quiz-verdict ${right ? "right" : "wrong"}`;
  quizVerdict.textContent = right
    ? "✓ 答對了！"
    : `✗ 答錯了，正解是 ${OPT_KEYS[item.answer]}`;
  quizExplain.textContent = item.explain || "";
  quizResult.hidden = false;
  quizClose.hidden = false;
  quizClose.focus({ preventScroll: true }); // 答完直接 Enter 就能關
  bumpCounter(right ? "qaRight" : "qaWrong");

  if (right) {
    SFX.quizRight();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) spawnChanceBurst();
  } else {
    SFX.quizWrong();
  }
}

function closeQuiz() {
  quizOverlay.classList.remove("show");
  SFX.click();
  endTurn();
}

if (quizOverlay) {
  quizClose.addEventListener("click", closeQuiz);
  quizX.addEventListener("click", closeQuiz);
  quizOverlay.addEventListener("click", (e) => {
    if (e.target === quizOverlay) closeQuiz(); // 和今日實踐視窗一樣：點背景就關
  });
}

// ---------- 今日御守小視窗 ----------
// 圖片放在同資料夾的 1122 底下，五款顏色各一張。
// 之後要增減御守，改這張清單就好，其他地方都不用動。
const OMAMORI = {
  dir: "1122",
  // webp 是用同資料夾的原始 png 壓出來的：一樣 1086x1448，但一張只有
  // 2 百多 KB（原始 png 約 2 MB），顯示和下載都用這一份。
  ext: ".webp",
  names: [
    "omamori-red-transparent",
    "omamori-gold-transparent",
    "omamori-green-transparent",
    "omamori-purple-transparent",
    "omamori-orange-transparent",
  ],
};

function omamoriPaths() {
  return OMAMORI.names.map((n) => encodeURI(OMAMORI.dir + "/" + n + OMAMORI.ext));
}

// 舊版二十張御守印在布袋上的法語（重複的已合併）。
// 現在圖案和法語分開抽：同一款御守每次配到的話都不一樣。
const OMAMORI_WORDS = [
  { text: "把自己打扮得漂漂亮亮固然很好，但僅止於此是無法為「美」下定義。透過真誠的話語和行為，每個人都能擁有真正的美麗。", by: "苑主 伊藤真聰 師父" },
  { text: "開朗、真誠、善良、溫暖，我們每個人都有一些尊貴的特質可為他人付出。", by: "苑主 伊藤真聰 師父" },
  { text: "開始努力關懷身邊所有一切，就是貢獻的開始。所謂「同心」，就是一如，是相互尊重、協調、凝聚力量。「融合」是「摒除個人主義，溫馨交融」。", by: "苑主 伊藤真聰 師父" },
  { text: "人生，根據看法或見解的不同，可以顯現出淨土，也可以顯現出穢土。", by: "伊藤真乘 師父" },
  { text: "心態，是讓自己掉進因緣苦海，或引導自己走向與佛陀共存的歡喜世界之分歧點。", by: "伊藤真乘 師父" },
  { text: "做讓人家高興的事，看起來好像自己有所損失。但是，佛陀的教法是因為給予他人歡喜，所以自己才會幸福。", by: "教導院/真導院 師父" },
  { text: "只要向前進，就可以和佛陀的足跡一如，後退的話，則與邪惡一如。要向後退，還是向前進，都靠自己的心。", by: "教導院/真導院 師父" },
  { text: "要奉修正道，如果只是表面上在做，並且看起來好像很熱心，但是自己的心卻和因緣同在，那是與信仰完全無關的。", by: "教導院/真導院 師父" },
  { text: "「要知心是行為之根，必常保持內心清淨。」想讓自己得到認同，若主張自我，內心則會混濁，且阻礙自己的道路。", by: "攝受心院 師父" },
  { text: "只要反省自己是否真的擁有讓對方了解的真誠，即可知道家裡的和平及正法的建立都是在於自己。", by: "攝受心院 師父" },
  { text: "「燈明是，滅己身給予人們光明」。可是一旦要去做時，卻並非那麼容易。犧牲自己，感謝讓自己成為眾人的基石，就是完全成為燈明。", by: "攝受心院 師父" },
];

// 洗牌袋：整袋抽完才重洗，所以每一張都會輪到，不會一直跳同幾張
const OMAMORI_POOL = {
  all: omamoriPaths(),
  bag: [],
  last: "",
};

// 法語也是同一套洗牌袋，十一句講完才重頭，不會連著兩次抽到同一句
const OMAMORI_WORD_POOL = {
  all: OMAMORI_WORDS.slice(),
  bag: [],
  last: null,
};

function shuffleInto(pool) {
  const bag = pool.all.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // 新的一輪，第一個別跟上一輪的最後一個撞在一起
  if (bag.length > 1 && bag[bag.length - 1] === pool.last) {
    [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
  }
  pool.bag = bag;
}

function drawOmamoriWord() {
  if (!OMAMORI_WORD_POOL.all.length) return null;
  if (!OMAMORI_WORD_POOL.bag.length) shuffleInto(OMAMORI_WORD_POOL);
  const word = OMAMORI_WORD_POOL.bag.pop();
  OMAMORI_WORD_POOL.last = word;
  return word;
}

function refillOmamoriBag() {
  shuffleInto(OMAMORI_POOL);
}

function drawOmamori() {
  if (!OMAMORI_POOL.all.length) return "";
  if (!OMAMORI_POOL.bag.length) refillOmamoriBag();
  const src = OMAMORI_POOL.bag.pop();
  OMAMORI_POOL.last = src;
  return src;
}

// 圖檔不小，先把下一張偷偷抓回來，下次就是秒出
function preloadNextOmamori() {
  if (!OMAMORI_POOL.bag.length) refillOmamoriBag();
  const next = OMAMORI_POOL.bag[OMAMORI_POOL.bag.length - 1];
  if (next) new Image().src = next;
}

// 存到手機／電腦裡時的檔名：用整組御守裡的編號，一看就知道是第幾張
function omamoriFileName(src) {
  const i = OMAMORI_POOL.all.indexOf(src);
  const no = String(i >= 0 ? i + 1 : 0).padStart(2, "0");
  return `寒修行世界GO_御守_${no}${OMAMORI.ext}`;
}

// 手機／平板？有 userAgentData 就問它，沒有就看是不是觸控裝置（iOS Safari 走這條）
function isHandheld() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
    return navigator.userAgentData.mobile;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

// 網頁不能自己寫進相簿，但手機的分享選單裡就有「儲存影像」，按下去就是存進相簿
function canSaveToAlbum(file) {
  return !!file && isHandheld() && !!navigator.canShare && navigator.canShare({ files: [file] });
}

let omamoriFile = null; // 這張御守的檔案，先備好才能一按就分享

// 先把圖抓成檔案放著。iOS 上如果等到按下去才抓，使用者手勢已經過期，分享會被擋掉。
async function prepareOmamoriFile(src, name) {
  try {
    const res = await fetch(src, { cache: "force-cache" });
    const blob = await res.blob();
    if (omamoriSave.download !== name) return; // 中途又抽了下一張，這份就不要了
    omamoriFile = new File([blob], name, { type: blob.type || "image/webp" });
    if (canSaveToAlbum(omamoriFile)) omamoriSave.textContent = "⤓ 存到相簿";
  } catch (e) {
    omamoriFile = null; // 抓不到就退回瀏覽器原本的下載
  }
}

// 瀏覽器預設的下載（存到預設下載資料夾）
function omamoriFallbackDownload() {
  const a = document.createElement("a");
  a.href = omamoriSave.href;
  a.download = omamoriSave.download;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// 電腦版 Chrome／Edge：跳出「另存新檔」，使用者自己挑資料夾
async function saveOmamoriAs() {
  const name = omamoriSave.download || "御守" + OMAMORI.ext;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "圖檔", accept: { "image/*": [OMAMORI.ext] } }],
    });
    const blob = omamoriFile || (await (await fetch(omamoriSave.href)).blob());
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    showToast("🧧 御守已存檔");
  } catch (err) {
    if (err && err.name === "AbortError") return; // 使用者自己按取消
    omamoriFallbackDownload();
  }
}

if (omamoriSave) {
  omamoriSave.addEventListener("click", (e) => {
    // 手機：叫出分享選單，按「儲存影像」就會進相簿
    if (canSaveToAlbum(omamoriFile)) {
      e.preventDefault();
      navigator.share({ files: [omamoriFile], title: "今日御守" }).catch((err) => {
        if (err && err.name === "AbortError") return; // 使用者自己關掉選單
        omamoriFallbackDownload();
      });
      return;
    }
    // 電腦（Chrome／Edge）：自己挑存放目錄
    if (window.showSaveFilePicker) {
      e.preventDefault();
      saveOmamoriAs();
      return;
    }
    // 其他瀏覽器：交給 <a download>，存到預設下載資料夾
  });
}

let omamoriServed = 0; // 這次開啟頁面已經領了幾張
function openOmamori() {
  const src = drawOmamori();
  if (!src) {
    endTurn();
    return;
  }

  omamoriServed += 1;
  omamoriNo.textContent = "本次第 " + omamoriServed + " 張";

  // 法語先放好，等御守落定時再一起亮出來
  const word = drawOmamoriWord();
  if (omamoriWordText) omamoriWordText.textContent = word ? word.text : "";
  if (omamoriWordBy) omamoriWordBy.textContent = word ? word.by : "";
  omamoriStage.classList.remove("revealed"); // 先收起來，等圖到了才由上往下降
  omamoriImg.removeAttribute("src");
  omamoriSave.removeAttribute("href"); // 圖還沒到，先不讓人按下載
  omamoriSave.textContent = "⤓ 下載圖檔";
  omamoriFile = null;
  omamoriOverlay.classList.add("show");
  dialogOpened(omamoriCard, omamoriClose);

  const reveal = () => {
    if (!omamoriOverlay.classList.contains("show")) return; // 已經被關掉就算了
    const name = omamoriFileName(src);
    omamoriImg.src = src;
    omamoriSave.href = src;
    omamoriSave.download = name;
    prepareOmamoriFile(src, name);
    requestAnimationFrame(() => {
      omamoriStage.classList.add("revealed");
      SFX.omamori();
      bumpCounter("omamori");
      preloadNextOmamori();
    });
  };

  const probe = new Image();
  probe.decoding = "async";
  probe.onload = reveal;
  probe.onerror = reveal; // 載不到也別卡住，讓 alt 文字頂著
  probe.src = src;
}

function closeOmamori() {
  omamoriOverlay.classList.remove("show");
  omamoriStage.classList.remove("revealed");
  omamoriFile = null;
  SFX.click();
  endTurn();
}

if (omamoriOverlay) {
  omamoriClose.addEventListener("click", closeOmamori);
  omamoriX.addEventListener("click", closeOmamori);
  omamoriOverlay.addEventListener("click", (e) => {
    if (e.target === omamoriOverlay) closeOmamori(); // 和今日實踐視窗一樣：點背景就關
  });
}

document.addEventListener("keydown", (e) => {
  const omamoriOpen = !!omamoriOverlay && omamoriOverlay.classList.contains("show");
  const quizOpen = !!quizOverlay && quizOverlay.classList.contains("show");
  const modalOpen = modalOverlay.classList.contains("show");
  if (e.key === "Escape") {
    if (omamoriOpen) closeOmamori();
    else if (quizOpen) closeQuiz();
    else if (modalOpen) closeModal();
    return;
  }
  if (omamoriOpen) trapTab(e, omamoriCard);
  else if (quizOpen) trapTab(e, quizCard);
  else if (modalOpen) trapTab(e, modalCard);
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

// ---------- dice (cute sheep) ----------
const DICE_COUNT = 3;

// hand-drawn sheep: viewBox 100x115, the number sits on a badge held at its belly
function sheepSVG(skin) {
  // skin 0: cream + pink bow · skin 1: toffee, one ear tipped out · skin 2: lavender + flower
  const earR = skin === 1 ? 22 : 6;
  const accessory = [
    `<g><path d="M30 44 L19 38 L19 50 Z" fill="#f4796a"/><path d="M30 44 L41 38 L41 50 Z" fill="#f4796a"/><circle cx="30" cy="44" r="3.4" fill="#df5347"/></g>`,
    "",
    `<g stroke="#e8a184" stroke-width=".6" fill="#ffe0c9"><circle cx="74" cy="41" r="3.4"/><circle cx="71.2" cy="44.8" r="3.4"/><circle cx="66.8" cy="43.4" r="3.4"/><circle cx="66.8" cy="38.6" r="3.4"/><circle cx="71.2" cy="37.2" r="3.4"/><circle cx="70" cy="41" r="2.4" fill="#ffd166" stroke="none"/></g>`,
  ][skin];

  // the wool is a cluster of puffs, drawn twice: once fat for the outline,
  // once filled on top, so the overlaps read as one fluffy silhouette
  const wool = `
    <ellipse cx="50" cy="74" rx="33" ry="27"/>
    <circle cx="50" cy="42" r="13"/>
    <circle cx="28" cy="48" r="12"/><circle cx="72" cy="48" r="12"/>
    <circle cx="15" cy="66" r="12"/><circle cx="85" cy="66" r="12"/>
    <circle cx="19" cy="86" r="11"/><circle cx="81" cy="86" r="11"/>
    <circle cx="38" cy="96" r="11"/><circle cx="62" cy="96" r="11"/>`;

  return `<svg class="sheep v${skin}" viewBox="0 0 100 115" aria-hidden="true">
    <g class="legs">
      <rect class="leg" x="28" y="92" width="10" height="20" rx="5"/>
      <rect class="leg" x="62" y="92" width="10" height="20" rx="5"/>
      <rect class="hoof" x="28" y="104" width="10" height="8" rx="4"/>
      <rect class="hoof" x="62" y="104" width="10" height="8" rx="4"/>
    </g>
    <g class="wool-edge">${wool}</g>
    <g class="wool">${wool}</g>
    <ellipse class="shade" cx="50" cy="92" rx="28" ry="9"/>
    <g class="curl">
      <path d="M30 80 Q36 74 42 80"/><path d="M58 80 Q64 74 70 80"/>
      <path d="M22 68 Q28 62 34 68"/><path d="M66 68 Q72 62 78 68"/>
    </g>
    <g transform="rotate(-6 34 56)"><g class="ear ear-l">
      <ellipse class="fur" cx="19" cy="62" rx="14" ry="8" transform="rotate(20 19 62)"/>
      <ellipse class="ear-in" cx="20" cy="62.5" rx="8" ry="4" transform="rotate(20 20 62.5)"/>
    </g></g>
    <g transform="rotate(${-earR} 66 56)"><g class="ear ear-r">
      <ellipse class="fur" cx="81" cy="62" rx="14" ry="8" transform="rotate(-20 81 62)"/>
      <ellipse class="ear-in" cx="80" cy="62.5" rx="8" ry="4" transform="rotate(-20 80 62.5)"/>
    </g></g>
    <g class="horn">
      <path d="M36 50 Q27 46 26.5 53.5 Q26 60 33 59.5"/>
      <path d="M64 50 Q73 46 73.5 53.5 Q74 60 67 59.5"/>
    </g>
    <ellipse class="face" cx="50" cy="63" rx="20" ry="17.5"/>
    <ellipse cx="50" cy="51" rx="8" ry="2.6" fill="#fff8ef" opacity=".5"/>
    ${accessory}
    <ellipse cx="33" cy="70" rx="5.2" ry="3.2" fill="#ffae92" opacity=".5"/>
    <ellipse cx="67" cy="70" rx="5.2" ry="3.2" fill="#ffae92" opacity=".5"/>
    <g class="eyes-open blink" fill="#4a2e22">
      <ellipse cx="41" cy="61" rx="4.4" ry="5.8"/><ellipse cx="59" cy="61" rx="4.4" ry="5.8"/>
      <circle cx="39.6" cy="58.8" r="1.8" fill="#fff"/><circle cx="57.6" cy="58.8" r="1.8" fill="#fff"/>
      <circle cx="42.6" cy="63.2" r=".9" fill="#fff"/><circle cx="60.6" cy="63.2" r=".9" fill="#fff"/>
    </g>
    <g class="eyes-happy" fill="none" stroke="#4a2e22" stroke-width="2.6" stroke-linecap="round">
      <path d="M36.5 62 Q41 55 45.5 62"/><path d="M54.5 62 Q59 55 63.5 62"/>
    </g>
    <ellipse cx="50" cy="70" rx="3.4" ry="2.4" fill="#ef8a74"/>
    <g class="mouth-closed" fill="none" stroke="#bf7a62" stroke-width="1.8" stroke-linecap="round">
      <path d="M50 72.4 L50 74.6"/><path d="M50 74.6 Q46 79.5 42.5 75.5"/><path d="M50 74.6 Q54 79.5 57.5 75.5"/>
    </g>
    <g class="mouth-open">
      <path d="M44 73 Q50 73 56 73 Q54.5 80.5 50 80.5 Q45.5 80.5 44 73 Z" fill="#c4564a"/>
      <ellipse cx="50" cy="78.4" rx="3" ry="1.6" fill="#ffa48d"/>
    </g>
    <g class="badge">
      <circle cx="50" cy="93" r="13" fill="#ffb340" stroke="#fff6e8" stroke-width="2.4"/>
      <text class="num" x="50" y="93" dy=".35em" text-anchor="middle" font-size="17" font-weight="900"
        font-family="'PingFang TC','Noto Sans TC',-apple-system,sans-serif"
        fill="#fff6e8" stroke="#c75f08" stroke-width=".9" style="paint-order:stroke">?</text>
    </g>
  </svg>`;
}

const dice = [];

function buildDice() {
  for (let i = 0; i < DICE_COUNT; i++) {
    const slot = document.createElement("div");
    slot.className = "sheep-slot";
    slot.innerHTML = `
      <div class="sheep-shadow"></div>
      <div class="sheep-hop"><div class="sheep-spin">${sheepSVG(i % 3)}</div></div>`;
    diceTrayEl.appendChild(slot);
    const die = {
      slot,
      hop: slot.querySelector(".sheep-hop"),
      spin: slot.querySelector(".sheep-spin"),
      shadow: slot.querySelector(".sheep-shadow"),
      num: slot.querySelector(".num"),
      badge: slot.querySelector(".badge"),
      tilt: -6 + Math.random() * 12,
    };
    die.spin.style.transform = `rotate(${die.tilt}deg)`;
    dice.push(die);
  }
}

function randSpin(min, max) {
  const turns = min + Math.floor(Math.random() * (max - min + 1));
  return (Math.random() < 0.5 ? -1 : 1) * turns * 360;
}

function rollOneDie(die, value, index) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduceMotion ? 450 : 1250 + Math.random() * 250;
  const delayMs = reduceMotion ? 0 : index * 90 + Math.random() * 60;
  const amp = 0.85 + Math.random() * 0.35; // jump height, in sheep sizes

  // somersault in the air, still landing upright (a whole number of turns + a fresh little tilt)
  const from = die.tilt;
  const nextTilt = -6 + Math.random() * 12;
  const to = nextTilt + randSpin(1, 2);

  die.slot.classList.add("is-rolling");
  const flicker = setInterval(() => {
    die.num.textContent = 1 + Math.floor(Math.random() * 6);
  }, 85);

  const spin = die.spin.animate(
    [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }],
    { duration: duration * 0.9, delay: delayMs, easing: "cubic-bezier(.12,.62,.25,1)", fill: "both" }
  );

  // bounces: jump → land → smaller hop → land → tiny hop → settle
  const H = (k) => `translateY(calc(var(--sheep) * ${-amp * k}))`;
  const up = "cubic-bezier(.2,.7,.4,1)";
  const down = "cubic-bezier(.6,0,.8,.4)";
  const hop = die.hop.animate(
    [
      { offset: 0, transform: `${H(0)} scale(1, 1)`, easing: up },
      { offset: 0.24, transform: `${H(1.1)} scale(1, 1)`, easing: down },
      { offset: 0.44, transform: `${H(0)} scale(1.08, 0.9)`, easing: up },
      { offset: 0.6, transform: `${H(0.42)} scale(1, 1)`, easing: down },
      { offset: 0.74, transform: `${H(0)} scale(1.05, 0.94)`, easing: up },
      { offset: 0.84, transform: `${H(0.13)} scale(1, 1)`, easing: down },
      { offset: 0.92, transform: `${H(0)} scale(1.02, 0.98)` },
      { offset: 1, transform: `${H(0)} scale(1, 1)` },
    ],
    { duration, delay: delayMs, fill: "both" }
  );
  const S = (k) => ({ transform: `scale(${1 - 0.45 * k})`, opacity: 1 - 0.6 * k });
  die.shadow.animate(
    [
      { offset: 0, ...S(0), easing: up },
      { offset: 0.24, ...S(1.1), easing: down },
      { offset: 0.44, ...S(0), easing: up },
      { offset: 0.6, ...S(0.42), easing: down },
      { offset: 0.74, ...S(0), easing: up },
      { offset: 0.84, ...S(0.13), easing: down },
      { offset: 0.92, ...S(0) },
      { offset: 1, ...S(0) },
    ],
    { duration, delay: delayMs }
  );

  if (!reduceMotion) {
    [0.44, 0.74, 0.92].forEach((t) => setTimeout(() => SFX.diceHit(), delayMs + duration * t));
  }

  // if the page isn't rendering (background tab), animations stay pending — don't hang the game
  const done = Promise.all([spin.finished, hop.finished]).catch(() => {});
  return Promise.race([done, delay(delayMs + duration + 400)]).then(() => {
    clearInterval(flicker);
    die.tilt = nextTilt;
    die.spin.style.transform = `rotate(${die.tilt}deg)`;
    spin.cancel();
    hop.cancel();
    die.num.textContent = value;
    die.slot.classList.remove("is-rolling");
    die.badge.classList.remove("pop");
    void die.badge.getBoundingClientRect();
    die.badge.classList.add("pop");
  });
}

async function rollDiceAnimation(values) {
  diceTotalEl.classList.remove("show");
  diceTotalEl.textContent = "…";
  hintStepsEl.textContent = "？";
  SFX.tick();
  await Promise.all(dice.map((die, i) => rollOneDie(die, values[i], i)));
  const total = values.reduce((a, b) => a + b, 0);
  diceTotalEl.textContent = `${values.join(" + ")} = ${total}`;
  hintStepsEl.textContent = total;
  void diceTotalEl.offsetWidth;
  diceTotalEl.classList.add("show");
}

async function walk(steps) {
  let passedStart = false;
  for (let i = 0; i < steps; i++) {
    position = (position + 1) % TILE_COUNT;
    moveTokenTo(position, true);
    if (position === 0) {
      laps += 1;
      passedStart = true;
      showToast("🎉 經過寒修行原點！");
      SFX.passStart();
    } else {
      highlightTile(position, "passing", 300);
      SFX.step();
    }
    await delay(150);
  }
  return passedStart;
}

/* ---------- 全球累計統計 ----------
   所有人（不分裝置、不分瀏覽器）共用同一組數字：
     steps    每擲一次骰子 +1
     omamori  每領受一張御守 +1
     qa-right Q&A 答對 +1（只有舊的 index - Q&A.html 會用到）
     qa-wrong Q&A 答錯 +1（同上）
   走公開的免費計數服務 abacus.jasoncameron.dev，只存數字，不傳任何個資。
   連不到時就沿用本機快取的數字，不會卡住畫面。                      */
const COUNTERS = {
  base: "https://abacus.jasoncameron.dev",
  ns: "hanxiuxing-2027game",
  items: {
    steps: { key: "steps", el: worldStepsEl, value: null },
    qaRight: { key: "qa-right", el: qaRightEl, value: null },
    qaWrong: { key: "qa-wrong", el: qaWrongEl, value: null },
    omamori: { key: "omamori", el: omamoriCountEl, value: null },
  },
};

function counterCacheRead(key) {
  try {
    const n = Number(localStorage.getItem("hx2027.c." + key));
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch (e) {
    return null;
  }
}
function counterCacheWrite(key, n) {
  try {
    localStorage.setItem("hx2027.c." + key, String(n));
  } catch (e) {}
}

function counterRender(name, bump) {
  const it = COUNTERS.items[name];
  if (!it || !it.el) return;
  it.el.textContent = it.value == null ? "？" : it.value.toLocaleString("en-US");
  if (!bump) return;
  it.el.classList.remove("bump");
  void it.el.offsetWidth;
  it.el.classList.add("bump");
}

async function counterCall(path, key) {
  const res = await fetch(`${COUNTERS.base}/${path}/${COUNTERS.ns}/${key}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (typeof data.value === "number") return data.value;
  if (/not found/i.test(data.error || "")) return 0; // 還沒有人計過
  throw new Error(data.error || "bad response");
}

function loadCounters() {
  Object.keys(COUNTERS.items).forEach(async (name) => {
    const it = COUNTERS.items[name];
    if (!it.el) return; // 這一版畫面上沒有這個數字，就不用去拿
    it.value = counterCacheRead(it.key);
    counterRender(name, false);
    try {
      it.value = await counterCall("get", it.key); // 只讀，不加
      counterCacheWrite(it.key, it.value);
      counterRender(name, false);
    } catch (e) {
      // 離線或服務暫時不通：沿用本機快取
    }
  });
}

async function bumpCounter(name) {
  const it = COUNTERS.items[name];
  if (!it) return;
  // 先樂觀 +1，畫面馬上有反應
  if (it.value != null) {
    it.value += 1;
    counterRender(name, true);
  }
  try {
    it.value = await counterCall("hit", it.key); // 真正的全球計數
    counterCacheWrite(it.key, it.value);
    counterRender(name, false);
  } catch (e) {
    // 連不到就先留著本機加上去的數字
  }
}

async function handleRoll() {
  if (busy) return;
  busy = true;
  rollBtn.disabled = true;
  SFX.unlock();
  SFX.click();
  bumpCounter("steps");

  const values = Array.from({ length: DICE_COUNT }, () => 1 + Math.floor(Math.random() * 6));
  const roll = values.reduce((a, b) => a + b, 0);

  await rollDiceAnimation(values);
  await delay(150);

  await walk(roll);

  const tile = TILES[position];
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

// ---------- background snowfall ----------
let snowCtl = null; // startSnow 會填入 { pause, resume }
function startSnow() {
  const canvas = document.getElementById("snow");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0;
  let h = 0;
  let flakes = [];

  const makeFlake = (anywhere) => {
    const r = 0.8 + Math.random() * 2.6; // bigger flakes feel closer: fall faster, brighter
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -r * 2,
      r,
      vy: 0.12 + r * 0.1,
      sway: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.12 + (r / 3.4) * 0.3,
    };
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.round(Math.min(70, Math.max(20, (w * h) / 22000)));
    while (flakes.length < target) flakes.push(makeFlake(true));
    flakes.length = target;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    for (const f of flakes) {
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(3, (now - last) / 16.7); // frames elapsed at 60fps, capped after tab switches
    last = now;
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.phase += 0.006 * dt;
      f.y += f.vy * dt;
      f.x += Math.sin(f.phase) * f.sway * 0.4 * dt;
      if (f.y - f.r > h) flakes[i] = makeFlake(false);
      else if (f.x < -5) f.x = w + 5;
      else if (f.x > w + 5) f.x = -5;
    }
    draw();
    rafId = requestAnimationFrame(tick);
  }

  let rafId = 0;
  snowCtl = {
    pause() {
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    resume() {
      if (reduceMotion || rafId) return;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    },
  };

  resize();
  window.addEventListener("resize", resize);
  if (reduceMotion) draw();
  else rafId = requestAnimationFrame(tick);
}

function init() {
  buildBoard();
  buildDice();
  startSnow();
  syncSoundIcon();
  fetchQuotes();
  if (quizOverlay) loadQuizBank();
  if (omamoriOverlay) preloadNextOmamori();
  loadCounters();
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  // mobile browser bars showing/hiding change the visible height without a window resize
  if (window.visualViewport) window.visualViewport.addEventListener("resize", handleResize);
  // wait a frame so layout is ready before sizing the board and placing the token
  requestAnimationFrame(() => {
    fitBoard();
    moveTokenTo(position, false);
  });
  // 字型載入完文字寬度會變，要重新量一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      lastFitKey = "";
      fitBoard();
      moveTokenTo(position, false);
    });
  }
}

init();
