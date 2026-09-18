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
const rollBtn = document.getElementById("rollBtn");
const toastEl = document.getElementById("toast");
const modalOverlay = document.getElementById("modalOverlay");
const modalCard = document.getElementById("modalCard");
const modalIcon = document.getElementById("modalIcon");
const modalType = document.getElementById("modalType");
const modalName = document.getElementById("modalName");
const modalQuote = document.getElementById("modalQuote");
const modalNum = document.getElementById("modalNum");
const modalClose = document.getElementById("modalClose");
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
  svgIcon("#3034a8", `<polygon fill="#3034a8" points="${starPoints(50, 53, 46, 19)}"/>`),
  svgIcon("#1f8a42", `<polygon fill="#1f8a42" points="${starPoints(50, 53, 46, 19)}"/>`),
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
function fitBoard() {
  if (!stageEl || !boardWrapEl) return;
  const cs = getComputedStyle(stageEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  let w = Math.max(220, stageEl.clientWidth - padX);
  let h = Math.max(220, stageEl.clientHeight - padY);
  w = Math.min(w, h * BOARD_MAX_WIDE);
  h = Math.min(h, w * BOARD_MAX_TALL);
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
  const colors = ["#ffd166", "#ff9f43", "#ffe8a3", "#ffb627", "#fff6d5"];
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
    "linear-gradient(135deg, #ff8fc4, #c04aa0)",
    "linear-gradient(135deg, #c9a4ff, #6a3fd6)",
    "linear-gradient(135deg, #8fb8ff, #3b4fc9)",
    "linear-gradient(135deg, #ffc2e0, #ff5c8a)",
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
// 苑歌 pool — same sheet as Train17/index2; used by the regular tiles.
const YUANGE = {
  sheet:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJvh4hp9JZWYOKyACPM-TDXKe-4aMTNQfqNxbBloYlZjsZJ_2wSVSjL88TS340Bf7CeBqVwIXCM3KA/pub?gid=0&single=true&output=csv",
  local: "quotes.csv",
  rows: [
    "01 具備充滿自己特性的美德", "02 勿忘身為真如教徒", "03 溫柔且堅強", "04 不以自我為中心",
    "05 莫讓他人難過", "06 批評別人之前先反省自己", "07 不在背後道人長短", "08 勿堅持己見",
    "09 設身處地為他人著想", "10 身心清淨", "11 經常微笑待人", "12 成為令人珍惜的人",
    "13 為人誠實", "14 不引起爭執", "15 謙恭穩重", "16 尊重他人", "17 不說不必要的話",
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.text())
    .split("\n")
    .map((row) => row.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
    .filter(Boolean);
  if (rows.length === 0) throw new Error("No data fetched");
  return rows;
}

async function fetchPool(pool) {
  for (const url of [pool.sheet, pool.local]) {
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
  modalType.textContent = "台灣真如苑";
  modalName.textContent = q.source || tile.name;
  // 機會/命運 show the tile's name where 苑歌 shows its number
  modalNum.textContent = isLuck ? tile.name : q.num ? `《${q.num}》` : "";
  modalQuote.textContent = q.text || tile.quote;
  modalOverlay.classList.add("show");
  (LAND_SOUND[tile.type] || LAND_SOUND.regular)();
  if (LAND_FX[tile.type] && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    LAND_FX[tile.type]();
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

// ---------- dice (3D cubes) ----------
const DICE_COUNT = 3;
// pip slots on a 3x3 grid (1..9, row-major)
const PIPS = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
// how each face sits on the cube
const FACE_TRANSFORM = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  3: "rotateY(90deg)",
  4: "rotateY(-90deg)",
  2: "rotateX(90deg)",
  5: "rotateX(-90deg)",
};
// cube rotation [x, y] that brings each face to the front
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

const dice = [];

function cubeTransform([x, y, z = 0]) {
  return `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

function buildDice() {
  for (let i = 0; i < DICE_COUNT; i++) {
    const slot = document.createElement("div");
    slot.className = "die-slot";
    const faces = Object.keys(FACE_TRANSFORM)
      .map((n) => {
        const pips = PIPS[n].map((p) => `<i style="grid-area:p${p}"></i>`).join("");
        return `<div class="die-face face-${n}" style="--face:${FACE_TRANSFORM[n]}">${pips}</div>`;
      })
      .join("");
    slot.innerHTML = `
      <div class="die-shadow"></div>
      <div class="die-hop">
        <div class="die-view">
          <div class="die-cube">
            <div class="die-core cx"></div><div class="die-core cy"></div><div class="die-core cz"></div>
            ${faces}
          </div>
        </div>
      </div>`;
    diceTrayEl.appendChild(slot);
    const die = {
      hop: slot.querySelector(".die-hop"),
      view: slot.querySelector(".die-view"),
      cube: slot.querySelector(".die-cube"),
      shadow: slot.querySelector(".die-shadow"),
      rot: FACE_ROT[1 + Math.floor(Math.random() * 6)].slice(),
    };
    die.cube.style.transform = cubeTransform(die.rot);
    die.view.style.setProperty("--yaw", `${-20 + Math.random() * 40}deg`);
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
  const amp = 0.85 + Math.random() * 0.35; // jump height, in die sizes

  const [fx, fy] = FACE_ROT[value];
  const from = [die.rot[0], die.rot[1], 0];
  // extra whole turns on every axis so it tumbles, but still lands on `value`
  const to = [fx + randSpin(2, 3), fy + randSpin(2, 3), randSpin(1, 2)];

  die.view.style.setProperty("--yaw", `${-22 + Math.random() * 44}deg`);

  const spin = die.cube.animate(
    [{ transform: cubeTransform(from) }, { transform: cubeTransform(to) }],
    { duration: duration * 0.9, delay: delayMs, easing: "cubic-bezier(.12,.62,.25,1)", fill: "both" }
  );

  // bounces: jump → land → smaller hop → land → tiny hop → settle
  const H = (k) => `translateY(calc(var(--die) * ${-amp * k}))`;
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
    die.rot = [fx, fy];
    die.cube.style.transform = cubeTransform(die.rot);
    spin.cancel();
    hop.cancel();
  });
}

async function rollDiceAnimation(values) {
  diceTotalEl.classList.remove("show");
  diceTotalEl.textContent = "…";
  SFX.tick();
  await Promise.all(dice.map((die, i) => rollOneDie(die, values[i], i)));
  diceTotalEl.textContent = `${values.join(" + ")} = ${values.reduce((a, b) => a + b, 0)}`;
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

async function handleRoll() {
  if (busy) return;
  busy = true;
  rollBtn.disabled = true;
  SFX.unlock();
  SFX.click();

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
    ctx.fillStyle = "#fff";
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
    requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  if (reduceMotion) draw();
  else requestAnimationFrame(tick);
}

function init() {
  buildBoard();
  buildDice();
  startSnow();
  syncSoundIcon();
  fetchQuotes();
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  // mobile browser bars showing/hiding change the visible height without a window resize
  if (window.visualViewport) window.visualViewport.addEventListener("resize", handleResize);
  // wait a frame so layout is ready before sizing the board and placing the token
  requestAnimationFrame(() => {
    fitBoard();
    moveTokenTo(position, false);
  });
}

init();
