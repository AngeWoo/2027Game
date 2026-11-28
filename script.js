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
  let stopPlaneSound = null;
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

  function isRunning() {
    return !!ctx && ctx.state === "running";
  }

  /* 把 AudioContext 叫醒。
     非 running 的狀態有三種，以前只處理了第一種：
       suspended   － 自動播放政策擋住，或閒置太久被瀏覽器停掉
       interrupted － iOS 專有：來電、鬧鐘、Siri、別的 App 搶走音訊就會變這個狀態。
                     舊版只檢查 suspended，所以 iPhone 被打斷過一次之後就再也醒不過來，
                     這就是「有時會忽然沒有音效」最主要的原因。
       closed      － 救不回來了，只能整個重建（見 getCtx）
     另外 resume() 是非同步的，而且「不在使用者手勢裡」呼叫會被拒絕。
     以前沒接 rejection 也沒重試，叫不醒就永遠醒不來了；
     現在失敗就把「下次碰到畫面再試一次」的監聽掛回去。 */
  function wakeCtx() {
    if (!ctx || ctx.state === "closed" || ctx.state === "running") return;
    armUnlock(); // 先上保險；真的叫醒了會自己拆掉
    let p;
    try {
      p = ctx.resume();
    } catch (e) {
      return;
    }
    if (p && p.then) {
      p.then(
        () => { if (isRunning()) disarmUnlock(); },
        () => {} // 被拒絕很正常（不在手勢裡），交給上面掛好的監聽重試
      );
    }
  }

  function getCtx() {
    if (ctx && ctx.state === "closed") ctx = null; // 關掉的救不回來，重建一個
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      claimAudioSession();
      ctx = new AC();
      // 只要掉出 running（被打斷、被停掉），就重新掛上「下次碰畫面叫醒」的監聽。
      // 沒有這個的話，中途斷掉就只能靠使用者重新整理頁面。
      ctx.addEventListener("statechange", () => {
        if (!isRunning()) armUnlock();
      });
    }
    wakeCtx();
    return ctx;
  }

  // iOS 規定要在使用者手勢裡「真的播出」一次聲音，之後排的聲音才放得出來。
  // 這裡送一個 1 格的無聲 buffer，使用者聽不到，但足以解鎖。
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
  }

  /* 「下次碰到畫面就把音訊叫醒」的監聽。
     以前解鎖成功就把監聽永久移除，所以後來被打斷時沒有任何東西會把它救回來。
     現在改成可以重複掛上、醒了就拆掉，被打斷幾次都能自己恢復。 */
  let unlockArmed = false;
  function onUserGesture() {
    unlockNow();
    if (isRunning()) disarmUnlock();
  }
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    document.addEventListener("pointerdown", onUserGesture, { passive: true });
    document.addEventListener("touchend", onUserGesture, { passive: true });
    document.addEventListener("keydown", onUserGesture);
  }
  function disarmUnlock() {
    if (!unlockArmed) return;
    unlockArmed = false;
    document.removeEventListener("pointerdown", onUserGesture);
    document.removeEventListener("touchend", onUserGesture);
    document.removeEventListener("keydown", onUserGesture);
  }
  armUnlock(); // 不用等到按擲骰：第一次碰到畫面的任何地方就先解鎖

  /* 在使用者手勢裡，把音訊弄回「真的出得了聲」的狀態。
     resume() 叫不醒就整個重建一個 —— 這是最後的保險。
     沒有它的話，使用者按喇叭只會看到圖示變了卻一點聲音都沒有，以為是按鈕壞掉。 */
  function revive() {
    const c = getCtx();
    if (!c) return Promise.resolve(false);
    if (c.state === "running") return Promise.resolve(true);
    let p;
    try {
      p = c.resume();
    } catch (e) {
      p = null;
    }
    const settled = p && p.then
      ? p.then(() => isRunning(), () => false)
      : Promise.resolve(isRunning());
    return settled.then((ok) => {
      if (ok) return true;
      try {
        c.close();
      } catch (e) {
        /* ignore */
      }
      ctx = null;
      const fresh = getCtx(); // 手勢裡新建的 context 多半直接就是 running
      return !!fresh && fresh.state === "running";
    });
  }

  // 切去別的 App 再切回來，手機會把音訊停掉，回來要重新叫醒。
  // iOS 從背景回來有時只發 pageshow、不發 visibilitychange，所以兩個都聽。
  function wakeOnReturn() {
    if (!ctx || isRunning()) return;
    wakeCtx();
    armUnlock(); // resume 若被擋下來，下次碰畫面還有機會
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wakeOnReturn();
  });
  window.addEventListener("pageshow", wakeOnReturn);

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

  const api = {
    isEnabled: () => enabled,
    unlock() {
      unlockNow();
    },
    toggle() {
      enabled = !enabled;
      if (!enabled && stopPlaneSound) stopPlaneSound();
      try {
        localStorage.setItem("monopoly-sound", enabled ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      if (enabled) {
        claimAudioSession();
        // 這裡是使用者手勢，是最可靠的復原時機：叫不醒就重建，
        // 確保「按下喇叭」一定伴隨一聲回饋音，而不是只有圖示變了。
        revive().then((ok) => {
          if (ok) api.click();
        });
      }
      return enabled;
    },
    // 目前的音訊狀態，給測試和除錯用
    audioState: () => (ctx ? ctx.state : "none"),
    click() {
      tone({ freq: 720, duration: 0.06, type: "triangle", volume: 0.18 });
    },
    // 小飛機：低沉引擎疊上氣流與螺旋槳脈動，起飛漸強、降落漸弱。
    plane(duration) {
      if (stopPlaneSound) stopPlaneSound();
      if (!enabled) return null;
      const c = getCtx();
      if (!c) return null;
      const t0 = c.currentTime;
      const seconds = duration / 1000;
      const end = t0 + seconds;
      const noise = c.createBufferSource();
      const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const samples = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < samples.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
        samples[i] = brown * 3.5;
      }
      noise.buffer = buffer;
      noise.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, t0);
      filter.frequency.linearRampToValueAtTime(1800, t0 + seconds * 0.4);
      filter.frequency.linearRampToValueAtTime(350, end);
      const engine = c.createOscillator();
      engine.type = "sawtooth";
      engine.frequency.setValueAtTime(65, t0);
      engine.frequency.linearRampToValueAtTime(115, t0 + seconds * 0.35);
      engine.frequency.linearRampToValueAtTime(55, end);
      const engineGain = c.createGain();
      engineGain.gain.value = 0.22;
      const propeller = c.createOscillator();
      propeller.frequency.value = 22;
      const pulse = c.createGain();
      pulse.gain.value = 0.07;
      const envelope = c.createGain();
      envelope.gain.setValueAtTime(0, t0);
      envelope.gain.linearRampToValueAtTime(0.3, t0 + seconds * 0.18);
      envelope.gain.linearRampToValueAtTime(0.2, t0 + seconds * 0.65);
      envelope.gain.linearRampToValueAtTime(0, end);
      noise.connect(filter);
      engine.connect(engineGain);
      propeller.connect(pulse);
      pulse.connect(engineGain.gain);
      engineGain.connect(filter);
      filter.connect(envelope);
      envelope.connect(c.destination);
      const sources = [noise, engine, propeller];
      sources.forEach((source) => { source.start(t0); source.stop(end); });
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        envelope.gain.cancelScheduledValues(c.currentTime);
        envelope.gain.setTargetAtTime(0, c.currentTime, 0.015);
        sources.forEach((source) => source.stop(c.currentTime + 0.06));
        if (stopPlaneSound === stop) stopPlaneSound = null;
      };
      noise.onended = () => {
        [noise, engine, propeller, engineGain, pulse, filter, envelope].forEach((node) => node.disconnect());
        if (stopPlaneSound === stop) stopPlaneSound = null;
      };
      stopPlaneSound = stop;
      return stop;
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
  return api;
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
const modalInviteCta = document.getElementById("modalInviteCta");
const modalPlace = document.getElementById("modalPlace");
const modalName = document.getElementById("modalName");
const modalQuote = document.getElementById("modalQuote");
const modalNum = document.getElementById("modalNum");
const modalClose = document.getElementById("modalClose");
const modalX = document.getElementById("modalX");
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
const inviteBtn = document.getElementById("inviteBtn");
const inviteOverlay = document.getElementById("inviteOverlay");
const inviteCard = document.getElementById("inviteCard");
const inviteX = document.getElementById("inviteX");
const invitePreview = document.getElementById("invitePreview");
const inviteNote = document.getElementById("inviteNote");
const inviteName = document.getElementById("inviteName");
const inviteRoute = document.getElementById("inviteRoute");
const inviteStat = document.getElementById("inviteStat");
const inviteSave = document.getElementById("inviteSave");
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

// 地點資料庫在 temples.js（TEMPLE_LIST）。沒載入時（舊版頁面）退回下面這份簡易清單。
// always on the board (日本 總本部 / 應現院, 東京都立川市)
const TEMPLES_REQUIRED = ["真如苑總本部、真澄寺", "應現院"];
// 全球真如苑 locations (Global Shinnyo-en map); the remaining regular tiles get a random pick
const TEMPLES_FALLBACK = [
  // 亞洲
  "真如苑台灣", "真如苑韓國", "真如苑香港", "真如苑泰國", "真如苑新加坡", "真如苑斯里蘭卡",
  // 歐洲
  "真如苑法國(歐洲本部)", "真如苑義大利", "真如苑德國慕尼黑", "真如苑比利時", "真如苑英國",
  // 美洲
  "真如苑夏威夷", "真如苑美國本部", "洛杉磯精舍", "西雅圖精舍", "紐約精舍", "芝加哥精舍", "真如苑巴西",
  // 大洋洲
  "真如苑澳洲",
];

const MAX_PER_COUNTRY = 2; // 同一國最多幾格（美國、德國地點很多，避免整盤都是同一國）

function templePool() {
  if (typeof TEMPLE_LIST !== "undefined" && Array.isArray(TEMPLE_LIST) && TEMPLE_LIST.length) {
    return TEMPLE_LIST.filter((t) => t.enabled !== false);
  }
  return [
    ...TEMPLES_REQUIRED.map((name) => ({ name, short: name, required: true })),
    ...TEMPLES_FALLBACK.map((name) => ({ name, short: name })),
  ];
}

// every page load: the required ones, then one per continent, then random others —
// placed in random order, so each game is a trip around the world
function dealTemples() {
  const regular = TILES.filter((t) => t.type === "regular");
  const pool = templePool();
  const picked = pool.filter((t) => t.required).slice(0, regular.length);
  const countryCount = {};
  const take = (t) => {
    picked.push(t);
    if (t.country) countryCount[t.country] = (countryCount[t.country] || 0) + 1;
  };
  picked.forEach((t) => t.country && (countryCount[t.country] = (countryCount[t.country] || 0) + 1));
  const free = () => pool.filter((t) => !picked.includes(t));

  // 每一洲至少一格
  const continents = shuffle([...new Set(pool.map((t) => t.continent).filter(Boolean))]);
  for (const c of continents) {
    if (picked.length >= regular.length) break;
    if (picked.some((t) => t.continent === c)) continue;
    const cand = shuffle(free().filter((t) => t.continent === c));
    if (cand.length) take(cand[0]);
  }
  // 剩下的隨機補滿，同一國不超過 MAX_PER_COUNTRY；不夠時才放寬
  for (const t of shuffle(free())) {
    if (picked.length >= regular.length) break;
    if (!t.country || (countryCount[t.country] || 0) < MAX_PER_COUNTRY) take(t);
  }
  for (const t of shuffle(free())) {
    if (picked.length >= regular.length) break;
    take(t);
  }

  shuffle(picked).forEach((t, i) => {
    regular[i].name = t.short || t.name;
    regular[i].fullName = t.name;
    regular[i].place = t;
  });
}

// 棋盤格名稱只在 <wbr> 處換行（CSS keep-all）：真如苑之後、括號前、頓號後、精舍／佈教所／本部之前
function tileNameHtml(name) {
  return name
    .replace(/^真如苑(?=.)/, "真如苑<wbr>")
    .replace(/(.)(?=[(（])/, "$1<wbr>")
    .replace("、", "、<wbr>")
    .replace(/(.)(佈教所|精舍|本部)$/, "$1<wbr>$2");
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
      <div class="tile-name">${tileNameHtml(tile.name)}</div>
    `;
    boardEl.insertBefore(el, centerPanel);
    tileEls.push(el);
    if (tile.place) wireTileMapIcon(el, tile);
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
  const res = await fetch(url, { cache: "no-store" });
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
const BG_SELECTORS = ".page-head, .stage, #soundToggle, .admin-dot, .invite-dot";

function setBackgroundInert(on) {
  document.querySelectorAll(BG_SELECTORS).forEach((el) => {
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}

function dialogOpened(card, focusEl) {
  setBackgroundInert(true);
  if (snowCtl) snowCtl.pause();
  // 視窗只是透明度 0，不是 display:none，可以直接收焦點。
  // 但手機上不要自動把焦點放進文字框：那會立刻彈出鍵盤，視窗一打開就被鍵盤
  // 擠掉一半（邀請函的卡片預覽會縮成一條）。改成先 focus 視窗本身，
  // 使用者自己點輸入框時鍵盤才出來。電腦沒有這個問題，維持原本的行為。
  let target = focusEl || card;
  if (target && target.tagName === "INPUT" && isHandheld()) target = card;
  target.focus({ preventScroll: true });
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

// ---------- 精舍小卡（照片＋國家洲別，資料在 temples.js） ----------
const modalTemple = document.getElementById("modalTemple");
const modalTempleImg = document.getElementById("modalTempleImg");
const modalTempleMeta = document.getElementById("modalTempleMeta");
const templeImgCache = new Map();

// 棋子還在走的時候先把落點的照片抓下來，彈窗打開就不用等
function preloadTemple(tile) {
  const src = tile && tile.place && tile.place.img;
  if (!src || templeImgCache.has(src)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  templeImgCache.set(src, img);
}

function showTemple(tile) {
  const place = tile.type === "regular" ? tile.place : null;
  if (!modalTemple) return;
  if (!place || !place.img) {
    modalTemple.hidden = true;
    modalCard.classList.remove("has-temple");
    return;
  }
  modalTemple.hidden = false;
  modalCard.classList.add("has-temple");
  modalTempleImg.classList.remove("loaded");
  modalTempleImg.onload = () => modalTempleImg.classList.add("loaded");
  modalTempleImg.onerror = () => {
    modalTemple.hidden = true;
    modalCard.classList.remove("has-temple");
  };
  modalTempleImg.alt = place.name;
  modalTempleImg.src = place.img;
  if (modalTempleImg.complete && modalTempleImg.naturalWidth) modalTempleImg.classList.add("loaded");

  // 不放國旗 emoji：Windows 不支援，會顯示成「KE」這種字母
  modalTempleMeta.textContent = "📍 " + [place.country, place.continent].filter(Boolean).join("・");
  fitModal();
  setTimeout(fitModal, 400);
}

// 卡片內容比畫面高時，把照片縮矮（最矮 90px），讓整張卡片不用捲動
const PHOTO_MIN = 90;
function fitModal() {
  const photo = modalTemple && !modalTemple.hidden ? modalTemple.querySelector(".modal-temple-photo") : null;
  if (!photo) return;
  photo.style.height = "";
  photo.style.aspectRatio = "";
  photo.style.maxHeight = "";
  // 照片在左、文字在右的寬螢幕排法不動，照片高度跟著文字走
  if (modalCard.classList.contains("temple-wide")) return;

  // 視窗現在是固定高度，scrollHeight 會等於 clientHeight，直接比較量不出內容多高。
  // 要先讓高度跟著內容走 —— 而且光設 height:auto 沒用：卡片是外框的 flex 子項，
  // 外框的 align-items:stretch 會把它拉滿，所以 align-self 也要一起解除。
  function contentGap() {
    const keepH = modalCard.style.height;
    const keepA = modalCard.style.alignSelf;
    modalCard.style.alignSelf = "center";
    modalCard.style.height = "auto";
    const contentH = modalCard.scrollHeight;
    modalCard.style.height = keepH;
    modalCard.style.alignSelf = keepA;
    return contentH - modalCard.clientHeight; // 正的＝塞不下，負的＝還有空間
  }

  // 一次算不準：照片一改高度，標題和內文會重新換行，高度又變了。
  // 所以反覆調整幾次讓它收斂，而不是一次算死。
  photo.style.aspectRatio = "auto";
  photo.style.maxHeight = "none"; // CSS 上有 max-height: 34vh 的上限，要先解開才長得大
  for (let i = 0; i < 4; i++) {
    const gap = contentGap();
    if (gap > 0) {
      const next = Math.max(PHOTO_MIN, photo.offsetHeight - gap - 2);
      if (next === photo.offsetHeight) break;
      photo.style.height = `${next}px`;
    } else if (gap < -8) {
      photo.style.height = `${photo.offsetHeight - gap - 6}px`;
    } else {
      break;
    }
  }
}
// 矮又寬的螢幕（筆電橫放）：照片放左邊、文字放右邊，省下垂直空間
const templeWideMQ = window.matchMedia("(max-height: 760px) and (min-width: 700px)");
function applyTempleWide() {
  modalCard.classList.toggle("temple-wide", templeWideMQ.matches);
}
applyTempleWide();
templeWideMQ.addEventListener("change", () => {
  applyTempleWide();
  fitModal();
});

// 彈窗標題：只在「真如苑／精舍／佈教所」等詞的邊界換行；括號內的地區縮小放第二行
function setPlaceName(full) {
  const m = full.match(/^(.*?)[（(]([^）)]*)[）)]$/);
  const main = m ? m[1] : full;
  const parts = main
    .replace(/^真如苑(?=.)/, "真如苑\u0000")
    .replace(/、/g, "、\u0000")
    .replace(/(.)(佈教所|精舍|本部|中心)/g, "$1\u0000$2")
    .split("\u0000");
  const nodes = [];
  parts.forEach((p, i) => {
    if (i) nodes.push(document.createElement("wbr"));
    nodes.push(document.createTextNode(p));
  });
  if (m) nodes.push(Object.assign(document.createElement("span"), { className: "modal-place-sub", textContent: m[2] }));
  modalPlace.replaceChildren(...nodes);
}

// ---------- 地圖小視窗：點棋盤格子上的小圖示，看 Google 地圖上的位置 ----------
const mapOverlay = document.getElementById("mapOverlay");
const mapCard = document.getElementById("mapCard");
const mapTitle = document.getElementById("mapTitle");
const mapPhoto = document.getElementById("mapPhoto");
const mapPhotoImg = document.getElementById("mapPhotoImg");
const mapFrame = document.getElementById("mapFrame");
const mapX = document.getElementById("mapX");

function placeMapQuery(place) {
  // mapq 是官網查到的實際地址（見 temples.js），有就直接用，Google 地圖才會釘在正確位置。
  // 沒有 mapq 的話才退回「名稱＋國家」去搜，但那常常只會停在國家中心。
  if (place.mapq) return place.mapq;
  return [place.name, place.country].filter(Boolean).join(" ");
}

function openPlaceMap(place) {
  if (!mapOverlay || !place) return;
  mapTitle.textContent = place.name;
  // 照片跟「精舍小卡」共用同一張圖（temples.js），不需要另外申請 Google 的付費圖片 API
  if (place.img) {
    mapPhotoImg.onerror = () => { mapPhoto.hidden = true; };
    mapPhotoImg.alt = place.name;
    mapPhotoImg.src = place.img;
    mapPhoto.hidden = false;
  } else {
    mapPhoto.hidden = true;
  }
  mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(placeMapQuery(place))}&output=embed`;
  mapOverlay.classList.add("show");
  dialogOpened(mapCard, mapX);
  SFX.click();
}

function closePlaceMap() {
  mapOverlay.classList.remove("show");
  mapFrame.src = ""; // 關閉時清空，背景分頁就不會一直耗流量
  dialogsClosed();
}

if (mapOverlay) {
  mapX.addEventListener("click", closePlaceMap);
  mapOverlay.addEventListener("click", (e) => {
    if (e.target === mapOverlay) closePlaceMap();
  });
}

// 棋盤格子上的小圖示：點下去看那個地點在 Google 地圖上的位置（跟擲骰子、走格子是各自獨立的）
function wireTileMapIcon(el, tile) {
  const icon = el.querySelector(".tile-icon");
  if (!icon) return;
  icon.classList.add("tile-icon-mappable");
  icon.setAttribute("role", "button");
  icon.setAttribute("tabindex", "0");
  icon.setAttribute("aria-label", `在 Google 地圖查看「${tile.place.name}」`);
  const open = (e) => {
    e.stopPropagation();
    openPlaceMap(tile.place);
  };
  icon.addEventListener("click", open);
  icon.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(e);
    }
  });
}

let currentModalTile = null; // 目前今日實踐視窗顯示的格子，給「邀朋友」關掉邀請函後回來用

function openModal(tile) {
  currentModalTile = tile;
  const isLuck = tile.type === "chance" || tile.type === "fate";
  const q = isLuck ? parseWt(pickFrom(WT)) : parseYuange(pickFrom(YUANGE));
  modalIcon.innerHTML = tile.icon;
  setPlaceName(tile.fullName || tile.name);
  showTemple(tile);
  if (modalInviteCta) {
    if (tile.place) {
      modalInviteCta.hidden = false;
      modalInviteCta.textContent = `💌 邀朋友從${tile.place.country}一起出發，參加2027年寒修行`;
    } else {
      modalInviteCta.hidden = true;
    }
  }
  modalName.textContent = q.source || (isLuck ? tile.name : "今日實踐");
  modalNum.textContent = q.num ? `《${q.num}》` : "";
  modalQuote.textContent = q.text || tile.quote;
  fitModal(); // 文字都放好之後再量一次高度
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
if (modalX) modalX.addEventListener("click", closeModal);
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
// 圖片放在同資料夾的「御守」底下，一共 20 張，每張圖上都已經印好法語和署名。
// 之後要增減御守，改這張清單就好，其他地方都不用動。
const OMAMORI_DIR = "御守";

function loadOmamoriImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
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

// 每張御守圖上都已經印好其中一句法語，這裡記著「哪張圖配哪句話」（對照 OMAMORI_WORDS 的索引），
// 存檔案名、下載明信片時都照這份對照表走，圖和字永遠一致。
const OMAMORI_FILES = [
  ["44884AD1-F26B-47BB-B19C-CB5832B3BE04.png", 0],
  ["E9A65113-3B8C-418D-9D75-CEC95AE80B53.png", 0],
  ["91A0044D-6A21-46BE-B200-2ABF3601197D.png", 1],
  ["C0F00D28-13E0-4749-B3AD-353CC4A464FA.png", 1],
  ["2B3F45F5-C805-46E4-96C1-1EB90865DD17.png", 2],
  ["F742BC86-624F-4421-AC89-5F5D2A33EB2C.png", 2],
  ["0BFF62B2-F26D-4515-BEE7-F827F44A291F.png", 3],
  ["0559612C-B62B-4557-A47E-F804E1382B8D.png", 4],
  ["873027D8-2F2E-4490-B819-360732C6E08B.png", 4],
  ["A8505736-5080-4749-986C-8989D4141CF7.png", 5],
  ["7210F157-CB7E-4AD2-92E8-360E1860DAF5.png", 6],
  ["69CECE95-61F9-46DC-87B8-D2DDB8D0A6C1.png", 6],
  ["D66FFC78-0558-4400-893A-CFA387C54E73.png", 6],
  ["620C8471-42EA-471D-A252-32547D665CD6.png", 7],
  ["C18B1673-29BF-4006-9895-C839ACCB9171.png", 7],
  ["0864D3C0-1E5E-4DAC-8B07-5C48679E2B09.png", 8],
  ["E99A9EE6-A6B1-4B7C-A352-7479DC26AB88.png", 8],
  ["35FCCFA6-8E1B-41E5-AB5E-404B809022F0.png", 9],
  ["D98B82BF-3B0B-4FCC-955A-D2DBFFABE969.png", 9],
  ["080024A9-D3A1-47D7-80C7-E3D889E1D733.png", 10],
];

const OMAMORI_ENTRIES = OMAMORI_FILES.map(([file, wordIndex]) => ({
  src: encodeURI(OMAMORI_DIR + "/" + file) + "?v=1",
  word: OMAMORI_WORDS[wordIndex],
}));

// 亂數抽一張（跟洗牌一樣，不特別避免連續抽到同一張）
function drawOmamori() {
  return shuffle(OMAMORI_ENTRIES)[0] ?? null;
}

// 存到手機／電腦裡時的檔名：用整組御守裡的編號，一看就知道是第幾張
function omamoriFileName(src) {
  const i = OMAMORI_ENTRIES.findIndex((entry) => entry.src === src);
  const no = String(i >= 0 ? i + 1 : 0).padStart(2, "0");
  return `真如世界大冒險 Going_御守明信片_${no}.png`;
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

let omamoriDownload = null;

function clearOmamoriDownload() {
  const url = omamoriSave.getAttribute("href");
  if (url) URL.revokeObjectURL(url);
  omamoriSave.removeAttribute("href");
  omamoriDownload = null;
}

function setOmamoriDownload(file, date, render) {
  clearOmamoriDownload();
  omamoriSave.href = URL.createObjectURL(file);
  omamoriSave.download = file.name;
  omamoriSave.textContent = canSaveToAlbum(file) ? "⤓ 存到相簿" : "⤓ 下載明信片";
  omamoriDownload = { file, date, render };
}

// 先合成圖檔，讓手機可在點擊當下叫出分享選單。
async function prepareOmamoriFile(image, box, src, word, drawNumber) {
  const isCurrentDraw = () => drawNumber === omamoriServed && omamoriOverlay.classList.contains("show");
  try {
    const note = document.getElementById("omamoriNote").textContent.trim();
    const date = omamoriPostcardDate();
    const render = (stampDate) => renderOmamoriPostcard(image, word, note, stampDate, box);
    const canvas = render(date);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!isCurrentDraw()) return;
    if (!blob) throw new Error("明信片轉檔失敗");
    const file = new File([blob], omamoriFileName(src), { type: "image/png" });
    setOmamoriDownload(file, date, render);
  } catch {
    if (isCurrentDraw()) omamoriSave.textContent = "明信片製作失敗";
  }
}

function currentOmamoriFile() {
  if (!omamoriDownload) return null;
  const { file, date, render } = omamoriDownload;
  const today = omamoriPostcardDate();
  if (date === today) return file;

  // 視窗開著跨日時，同步更新 PNG，保留這次點擊開啟分享或另存選單的權限。
  const dataUrl = render(today).toDataURL("image/png");
  const png = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = Uint8Array.from(png, (byte) => byte.charCodeAt(0));
  const updatedFile = new File([bytes], file.name, { type: "image/png" });
  setOmamoriDownload(updatedFile, today, render);
  return updatedFile;
}

// 瀏覽器預設的下載（存到預設下載資料夾）
function omamoriFallbackDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// 畫面尺寸一變就重算邀請卡版面：轉向、視窗縮放，
// 以及手機網址列收合造成的可視高度變化（visualViewport）。
window.addEventListener("resize", fitInviteCard);
window.addEventListener("orientationchange", fitInviteCard);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitInviteCard);

// 電腦版 Chrome／Edge：跳出「另存新檔」，使用者自己挑資料夾
async function saveOmamoriAs(file) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: file.name,
      types: [{ description: "PNG 圖檔", accept: { "image/png": [".png"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    showToast("🧧 御守明信片已存檔");
  } catch (err) {
    if (err && err.name === "AbortError") return; // 使用者自己按取消
    omamoriFallbackDownload(file);
  }
}

if (omamoriSave) {
  omamoriSave.addEventListener("click", (e) => {
    let file;
    try {
      file = currentOmamoriFile();
    } catch {
      e.preventDefault();
      showToast("明信片日期更新失敗，請再試一次");
      return;
    }
    if (!file) {
      e.preventDefault();
      return;
    }
    // 手機：叫出分享選單，按「儲存影像」就會進相簿
    if (canSaveToAlbum(file)) {
      e.preventDefault();
      navigator.share({ files: [file], title: "今日御守明信片" }).catch((err) => {
        if (err && err.name === "AbortError") return; // 使用者自己關掉選單
        omamoriFallbackDownload(file);
      });
      return;
    }
    // 電腦（Chrome／Edge）：自己挑存放目錄
    if (window.showSaveFilePicker) {
      e.preventDefault();
      saveOmamoriAs(file);
      return;
    }
    // 其他瀏覽器：交給 <a download>，存到預設下載資料夾
  });
}

let omamoriServed = 0; // 這次開啟頁面已經領了幾張
async function openOmamori() {
  const entry = drawOmamori();
  if (!entry) {
    endTurn();
    return;
  }
  const { src, word } = entry;

  omamoriServed += 1;
  const drawNumber = omamoriServed;
  omamoriNo.textContent = "本次第 " + omamoriServed + " 張";

  // 法語先放好，等御守落定時再一起亮出來（圖上印的就是這句話）
  if (omamoriWordText) omamoriWordText.textContent = word ? word.text : "";
  if (omamoriWordBy) omamoriWordBy.textContent = word ? word.by : "";
  omamoriStage.classList.remove("revealed"); // 先收起來，等圖到了才由上往下降
  omamoriImg.removeAttribute("src");
  clearOmamoriDownload();
  omamoriSave.textContent = "明信片製作中…";
  omamoriOverlay.classList.add("show");
  dialogOpened(omamoriCard, omamoriClose);

  const image = await loadOmamoriImage(src);
  if (drawNumber !== omamoriServed || !omamoriOverlay.classList.contains("show")) return;

  omamoriImg.src = src;

  requestAnimationFrame(() => {
    if (drawNumber !== omamoriServed || !omamoriOverlay.classList.contains("show")) return;
    omamoriStage.classList.add("revealed");
    SFX.omamori();
    bumpCounter("omamori");
    if (image) {
      prepareOmamoriFile(image, null, src, word, drawNumber);
    } else {
      omamoriSave.textContent = "無法載入御守圖檔";
    }
  });
}

/* 小飛機的起飛點：牌面中央面板的右下角，往內縮一點，
   不然飛機會有一半掛在面板外面、看起來像從隔壁格子冒出來的。 */
function omamoriFlightStart() {
  const panel = document.getElementById("centerPanel") || document.getElementById("board");
  if (!panel) return null;
  const r = panel.getBoundingClientRect();
  if (!r.width || !r.height) return null; // 版面還沒算好（或被藏起來）就讓呼叫端用備案
  const inset = Math.min(40, r.width * 0.08, r.height * 0.08);
  return { x: r.right - inset, y: r.bottom - inset };
}

/* 按下「收下御守」：關掉視窗，並讓小飛機沿弧線飛向左下角的「寒修行原點」。

   起飛點用中央面板的右下角，不是「收下御守」那顆按鈕 ——
   按鈕在畫面正中央、位置又隨視窗大小跑，每次起飛的地方都不一樣；
   固定從牌面右下角出發，弧線才會每次都一樣橫跨整個牌面。
   面板量不到時（理論上不會）才退回按鈕，而按鈕的座標一定要在 closeOmamori() 之前量：
   視窗一關按鈕就不在畫面上了，getBoundingClientRect() 會全部變成 0，飛機會從左上角起飛。

   只有這顆按鈕會放飛機：按右上角的 × 或點背景關掉是「跳過」，不給這個收尾。 */
function takeOmamori() {
  const r = omamoriClose.getBoundingClientRect();
  const from = omamoriFlightStart() || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  closeOmamori();
  const startTile = document.querySelector(".tile.type-start");
  if (startTile && typeof flyPlaneTo === "function") {
    flyPlaneTo(from, startTile, { arc: 0.32, playSound: (duration) => SFX.plane(duration) });
  }
}

function closeOmamori() {
  omamoriOverlay.classList.remove("show");
  omamoriStage.classList.remove("revealed");
  clearOmamoriDownload();
  SFX.click();
  endTurn();
}

if (omamoriOverlay) {
  omamoriClose.addEventListener("click", takeOmamori);
  omamoriX.addEventListener("click", closeOmamori);
  omamoriOverlay.addEventListener("click", (e) => {
    if (e.target === omamoriOverlay) closeOmamori(); // 和今日實踐視窗一樣：點背景就關
  });
}

// ---------- 發送邀請函：自己打話、簽名字，疊在邀請卡印章上方，分享出去 ----------
// 不需要密碼——這是給所有玩家用的功能，跟題庫管理（admin-dot）完全不同。
// 最後做出來的檔案是會動的 GIF（仙鶴拍翅膀），用 gif.js 在背景執行緒編碼。
//
// 打字的時候完全不做任何重的事——不即時重畫動畫、不背景編 GIF。
// 之前試過「邊打字邊在背景做 GIF」，結果在比較慢的裝置上這段工作會跟打字搶主執行緒，
// 越打越卡，看起來就像字打不進去、被吃掉。改成只有在按下「下載」／「用 LINE 傳送」
// 那一刻才真正開始做圖，輸入框全程不受任何背景工作干擾。
let inviteAssets = null; // 毛筆字圖＋QR code，只載入一次
let invitePlaceImage = null; // 從「邀朋友」按鈕帶過來的當地照片，每次打開都可能不一樣，不能跟上面那份共用快取
let inviteFile = null; // 目前已經做好、可以直接用的 GIF 檔
let inviteDirty = true; // 文字改過、還沒重做 GIF
let inviteBuildToken = 0; // 每次做 GIF +1，讓做到一半又被取代的結果自動作廢
let inviteBuilding = null; // 正在做的那一份 GIF（閒置預做跟使用者點擊共用，不會做兩次）
let inviteWarmTimer = null; // 閒置多久之後開始偷偷預做 GIF
let invitePreviewTimer = null; // 靜態預覽圖的 debounce（只是重畫一次 canvas，不編碼）
let invitePhotos = null; // 「回到親苑」要用的五張照片（見 invite-return-anim.js），每次打開重抽
let invitePhotoToken = 0; // 連續開關兩次時，讓前一次還在載的照片自動作廢
let invitePreviewResumeTimer = null; // 打完字之後把輪播接回去的計時器
let invitePreviewRaf = 0; // 預覽輪播的 requestAnimationFrame id，0 ＝ 沒在播
let invitePreviewT0 = 0; // 這一輪動畫從什麼時候開始
let invitePreviewLast = 0; // 上一幀畫在什麼時候（用來壓到 20fps，不用每個畫面更新都畫）
let invitePreviewCanvas = null; // 固定重複使用的畫布，避免每秒配置 20 張 900×600

// 對話框裡的預覽用輪播的方式播：播一趟 → 停在親苑一下下 → 再播一次。
// 跟輸出的 GIF 是同一組畫面（GIF 只播一次就停在親苑，預覽才會重播）。
const INVITE_PLAY_MS = 3600; // 播一趟
const INVITE_HOLD_MS = 1400; // 停在親苑多久再重來
const INVITE_FPS_MS = 50; // 最多 20fps；這個內容不需要更滑順，省下來的都是手機的電

async function getInviteAssets() {
  if (!inviteAssets) {
    const [titleImage, qrImage] = await Promise.all([loadInviteTitleImage(), loadInviteQrImage()]);
    inviteAssets = { titleImage, qrImage };
  }
  return inviteAssets;
}

// 全球統計：沿用首頁那兩個公開計數（COUNTERS），沒有數字就整行不顯示
function updateInviteStat() {
  if (!inviteStat) return;
  const steps = COUNTERS.items.steps.value;
  const omamori = COUNTERS.items.omamori.value;
  if (steps == null && omamori == null) {
    inviteStat.hidden = true;
    return;
  }
  const parts = [];
  if (steps != null) parts.push(["全球已跨出 ", steps.toLocaleString("en-US"), " 步"]);
  if (omamori != null) parts.push(["已領受御守 ", omamori.toLocaleString("en-US"), " 張"]);
  const nodes = [];
  parts.forEach((p, i) => {
    if (i) nodes.push(document.createTextNode("　·　"));
    nodes.push(document.createTextNode(p[0]));
    nodes.push(Object.assign(document.createElement("b"), { textContent: p[1] }));
    nodes.push(document.createTextNode(p[2]));
  });
  inviteStat.replaceChildren(...nodes);
  inviteStat.hidden = false;
}

// 用照片檔名回查是哪一間精舍（pickReturnPhotos 回傳的是 Image，沒有帶名字）
function templeByImgSrc(src) {
  if (typeof TEMPLE_LIST === "undefined" || !Array.isArray(TEMPLE_LIST) || !src) return null;
  return TEMPLE_LIST.find((t) => t.img && src.endsWith(t.img)) || null;
}

// 這張卡走過哪裡：跟動畫裡一張一張飛回親苑的那幾張是同一組
function updateInviteRoute() {
  if (!inviteRoute) return;
  if (!invitePhotos || invitePhotos.length < 2) {
    inviteRoute.hidden = true;
    return;
  }
  const stops = [];
  invitePhotos.slice(0, -1).forEach((img) => {
    const t = img && templeByImgSrc(img.src);
    const label = t && (t.country || t.short);
    if (label && stops[stops.length - 1] !== label) stops.push(label);
  });
  if (!stops.length) {
    inviteRoute.hidden = true;
    return;
  }
  inviteRoute.replaceChildren(
    document.createTextNode("✈️ 這張卡走過：" + stops.join(" → ") + " → "),
    Object.assign(document.createElement("span"), { className: "invite-route-home", textContent: "原點・親苑" })
  );
  inviteRoute.hidden = false;
}

function inviteFileName(name) {
  const who = name.trim();
  return who ? `寒修行邀請函_${who}.gif` : "寒修行邀請函.gif";
}

// 只重畫一次 canvas（固定姿勢，不是動畫迴圈），讓對話框裡可以看到文字疊上去的樣子。
// 用 debounce 延遲一下、而且只畫一次就停，不會跟打字搶主執行緒。
// 畫動畫的某一幀到對話框的預覽畫布上。
// 照片還沒載完（或親苑的圖掛了）就退回原本的靜態卡片，不讓對話框空著。
function drawInvitePreviewAt(t) {
  if (!inviteAssets) return;
  if (!invitePreviewCanvas) invitePreviewCanvas = document.createElement("canvas");
  const opts = {
    ...inviteAssets,
    personalNote: inviteNote.value.trim(),
    personalName: inviteName.value.trim(),
    pixelScale: 1,
    canvas: invitePreviewCanvas, // 固定重複使用，不要每一幀配一張新的
  };
  const canvas = invitePhotos
    ? renderReturnFrame(opts, invitePhotos, t)
    : renderInviteCardDraft({ ...opts, placeImage: invitePlaceImage, flap: 0 });
  const pctx = invitePreview.getContext("2d");
  pctx.drawImage(canvas, 0, 0, invitePreview.width, invitePreview.height);
}

// 只畫一張不會動的：停在親苑那一幀，也就是收件人最後看到的畫面
function drawInvitePreviewOnce() {
  drawInvitePreviewAt(invitePhotos ? 1 : 0);
}

/* 手機版面：量出「除了預覽圖以外」的東西佔掉多少高度，把剩下的全部給預覽圖，
   讓邀請卡在不被裁切的前提下盡可能大。

   為什麼需要用 JS 動態算：
   1. 手機瀏覽器的網址列會收合，vh 算的是收起來之後的高度，網址列還在時卡片就超出畫面；
      visualViewport.height 才是「現在真的看得到」的高度，而且它會隨著捲動即時變。
   2. 底下那行提示字會因為裝置支不支援分享選單而變長變短，高度不是固定的。
   預覽圖是 3:2，所以寬度 = 可用高度 × 1.5。 */
const INVITE_PREVIEW_MIN_W = 210; // 再小就看不清楚了，寧可讓卡片可以捲
const INVITE_PREVIEW_COMFORT_W = 300; // 預覽圖窄到這個程度，就把說明區塊收起來把空間還給它

function fitInviteCard() {
  if (!inviteOverlay.classList.contains("show")) return;
  const wrap = invitePreview.parentElement;
  if (!wrap) return;

  const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  // 外框的 padding 會因為手機安全區和「讓開上方兩顆按鈕」而變，所以要實際量，不能寫死比例
  const ov = getComputedStyle(inviteOverlay);
  const avail = vh - parseFloat(ov.paddingTop) - parseFloat(ov.paddingBottom);
  // 高度原則上交給 CSS（才會跟其他視窗一樣高）；只有在手機網址列把可視高度吃掉時，
  // 才自己夾一個高度上限，不然視窗下半部會被網址列蓋住。
  inviteCard.style.maxHeight = vh < window.innerHeight - 1 ? Math.round(avail) + "px" : "";

  // 鍵盤彈出來時可視高度會被砍掉一大半，那時候不要重算版面
  // （不然圖會縮成一條，收鍵盤之後又彈回來，畫面一直跳）
  if (vh < window.innerHeight * 0.7) return;

  // 先把預覽縮到幾乎沒有，量出其他內容的真實高度。
  // 卡片現在是固定高度（CSS 的 height:100%），scrollHeight 會等於 clientHeight，
  // 所以量之前要先讓高度跟著內容走，量完馬上還原。
  // 量「除了預覽圖以外」有多高，再把剩下的高度全部給預覽圖（預覽是 3:2，寬＝高×1.5）。
  // 光設 height:auto 沒用：卡片是外框的 flex 子項，外框會把它拉滿，
  // 所以 align-self 也要一起解除，才量得到真正的內容高度。
  function previewWidthFor() {
    const beforeW = wrap.style.width;
    const beforeH = inviteCard.style.height;
    const beforeA = inviteCard.style.alignSelf;
    wrap.style.width = "1px";
    inviteCard.style.alignSelf = "center";
    inviteCard.style.height = "auto";
    const others = inviteCard.scrollHeight - wrap.getBoundingClientRect().height;
    inviteCard.style.height = beforeH;
    inviteCard.style.alignSelf = beforeA;
    wrap.style.width = beforeW;

    const cs = getComputedStyle(inviteCard);
    const innerW = inviteCard.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = inviteCard.clientHeight - others - 4;
    return Math.max(INVITE_PREVIEW_MIN_W, Math.min(innerW, availH * 1.5));
  }

  // 先試著把說明區塊顯示出來（它的用途就是補滿空白）；
  // 如果這樣會把預覽圖擠得太小，就收起來 —— 要寄出去的是那張卡片，它優先。
  inviteCard.classList.remove("hide-about");
  let w = previewWidthFor();
  if (w < INVITE_PREVIEW_COMFORT_W) {
    inviteCard.classList.add("hide-about");
    w = previewWidthFor();
  }
  wrap.style.width = Math.round(w) + "px";
}

function inviteReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stopInvitePreviewAnim() {
  if (invitePreviewRaf) cancelAnimationFrame(invitePreviewRaf);
  invitePreviewRaf = 0;
}

// 輪播：播一趟 → 停在親苑 INVITE_HOLD_MS → 再播。
// 整張 900×600 重畫一次實測 0.5ms，壓在 20fps 等於 1% 的主執行緒，不會跟打字搶。
// （原本程式碼註解提到的卡頓是 GIF 編碼造成的，那個現在還是只在按下按鈕時才做。）
function invitePreviewTick(now) {
  invitePreviewRaf = requestAnimationFrame(invitePreviewTick);
  if (now - invitePreviewLast < INVITE_FPS_MS) return;
  invitePreviewLast = now;
  const elapsed = now - invitePreviewT0;
  if (elapsed >= INVITE_PLAY_MS + INVITE_HOLD_MS) {
    invitePreviewT0 = now;
    drawInvitePreviewAt(0);
    return;
  }
  drawInvitePreviewAt(Math.min(1, elapsed / INVITE_PLAY_MS));
}

function startInvitePreviewAnim() {
  stopInvitePreviewAnim();
  if (!inviteOverlay.classList.contains("show") || !inviteAssets) return;
  // 沒有照片就沒有動畫可播；使用者要求減少動態效果時也只給一張靜態圖
  if (!invitePhotos || inviteReducedMotion()) {
    drawInvitePreviewOnce();
    return;
  }
  invitePreviewT0 = performance.now();
  invitePreviewLast = 0;
  invitePreviewRaf = requestAnimationFrame(invitePreviewTick);
}

// 打字的當下把輪播停掉，只用原本的 debounce 重畫一張，讓剛打的字馬上看得到；
// 停手之後再把動畫接回去。這是照原本檔案的設計意圖做的：輸入框全程不跟任何背景工作搶。
function queueInvitePreview() {
  invalidateInviteFile();
  stopInvitePreviewAnim();
  clearTimeout(inviteWarmTimer);
  clearTimeout(invitePreviewResumeTimer);
  clearTimeout(invitePreviewTimer);
  invitePreviewTimer = setTimeout(() => {
    drawInvitePreviewOnce();
    invitePreviewResumeTimer = setTimeout(startInvitePreviewAnim, 450);
    warmInviteFile(); // 停手之後才把 GIF 先做起來放著
  }, 250);
}

// 系統的分享面板吃不吃得下檔案 —— 不限手機。
// Windows 上 Chrome 的 navigator.share() 會叫出系統分享面板，而 Microsoft Store 版的 LINE
// 在 manifest 裡宣告了 windows.shareTarget（支援 StorageItems，也就是檔案），
// 所以電腦上也能把 GIF 直接交給 LINE，不必經過剪貼簿、也不用使用者自己附加圖片。
// 跟實際檔案內容無關，用一個假檔案探一次就好。
function canSystemShareFiles() {
  try {
    const probe = new File([new Uint8Array([0])], "p.gif", { type: "image/gif" });
    return !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// 要不要把事情交給系統分享面板。
//
// 2026-11-28 改回只在手機／平板走分享：Windows 的分享面板「列得出」LINE
// （Store 版 LINE 的 manifest 確實宣告了 windows.shareTarget），canShare() 也回 true，
// 但實測點下去檔案並沒有真的進到 LINE 對話，等於按了沒反應；
// 而且那時電腦上只剩這一條路——存檔和「用 LINE 傳送」兩顆按鈕都被藏起來了，
// 使用者變成既存不了圖也傳不出去。所以電腦一律走「下載 ＋ 剪貼簿開 LINE」這條確定可行的路。
// canSystemShareFiles() 本身留著，是因為手機上還是要先確認面板吃得下檔案。
function useSystemShare() {
  return isHandheld() && canSystemShareFiles();
}

function syncInviteButtonLabel() {
  inviteSave.textContent = useSystemShare() ? "⤓ 分享 / 存到相簿" : "⤓ 下載邀請卡";
}

// 文字（或照片）換過了：現有的 GIF 作廢，正在做的那份就算做完也要丟掉。
function invalidateInviteFile() {
  inviteDirty = true;
  inviteBuildToken += 1; // 正在跑的那份回來時 token 已經對不上，會自動作廢
  inviteBuilding = null;
}

// 真正做 GIF。回傳的 promise 由「閒置時預做」和「使用者點下去」共用，同一份不會做兩次。
function startInviteBuild() {
  const token = ++inviteBuildToken;
  const pending = (async () => {
    const assets = await getInviteAssets();
    const personalNote = inviteNote.value.trim();
    const personalName = inviteName.value.trim();
    const cardOpts = { ...assets, personalNote, personalName };
    const blob = invitePhotos
      ? await buildReturnGif(cardOpts, invitePhotos)
      : await buildInviteGif({ ...cardOpts, placeImage: invitePlaceImage }); // 照片沒載到就退回原本只有仙鶴拍翅的版本
    if (token !== inviteBuildToken) return inviteFile; // 做到一半文字又改了，這份不要了
    inviteFile = new File([blob], inviteFileName(personalName), { type: "image/gif" });
    inviteDirty = false;
    return inviteFile;
  })();
  inviteBuilding = pending;
  pending.catch(() => {}).then(() => {
    if (inviteBuilding === pending) inviteBuilding = null; // 別把後來那份蓋掉
  });
  return pending;
}

// silent = 閒置時偷偷先做，不動按鈕上的字（不然使用者什麼都沒按就看到「製作動畫中…」）
async function ensureInviteFile({ silent = false } = {}) {
  if (inviteFile && !inviteDirty) return inviteFile;
  const pending = inviteBuilding || startInviteBuild();
  if (silent) return pending;
  const label = inviteSave.textContent;
  inviteSave.textContent = "製作動畫中…";
  try {
    return await pending;
  } catch {
    inviteSave.textContent = label;
    throw new Error("邀請卡製作失敗");
  }
}

// navigator.share() 和 showSaveFilePicker() 都要求「使用者剛剛才點過」（Chrome 只給約 5 秒）。
// 這張 GIF 有 2MB、24 幀，在慢一點的手機上要好幾秒才做得完，等按下去才開始做，
// 做完時那個授權早就過期了 —— 分享選單叫不出來、另存視窗也跳不出來，
// 只會默默掉進最後的 <a download>，看起來就像「按了沒反應」。
// 所以趁使用者沒在打字的空檔先把 GIF 做起來放著，按下去時就是現成的，授權還在。
// 只在閒置時做：打字當下絕對不碰（見上面那段「越打越卡」的說明）。
function warmInviteFile() {
  clearTimeout(inviteWarmTimer);
  inviteWarmTimer = setTimeout(() => {
    if (!inviteOverlay.classList.contains("show")) return;
    ensureInviteFile({ silent: true }).catch(() => {}); // 先做失敗沒關係，按下去還會再做一次
  }, 700);
}

function openInvite({ defaultNote = "", placeImg = null } = {}) {
  SFX.click();
  // 每次打開都換一組亂數 name／id，讓瀏覽器的自動完成沒辦法把這次的欄位
  // 跟之前任何一次測試對上號、生出下拉建議——這是這類問題最常見的成因。
  const rnd = Math.random().toString(36).slice(2, 10);
  inviteNote.name = `inviteNote_${rnd}`;
  inviteName.name = `inviteName_${rnd}`;
  inviteNote.value = defaultNote;
  inviteName.value = "";
  invalidateInviteFile();
  invitePlaceImage = null; // 先清掉上一次的照片，等這次的（如果有）載完再換上
  invitePhotos = null;
  inviteOverlay.classList.add("show");
  dialogOpened(inviteCard, inviteNote);
  if (inviteRoute) inviteRoute.hidden = true; // 等這次的照片抽好再顯示
  updateInviteStat();
  syncInviteButtonLabel();
  fitInviteCard();
  getInviteAssets().then(() => {
    if (!inviteOverlay.classList.contains("show")) return;
    drawInvitePreviewOnce();
    fitInviteCard();
  });
  // 「回到親苑」要的五張照片：先把當地那張載進來（有的話），再抽三間不同洲的世界精舍，
  // 最後加上親苑。中間三間每次重抽，所以每張邀請卡走過的路都不一樣。
  // token 是為了連續開關兩次時，讓前一次還在載的那組自動作廢。
  const token = ++invitePhotoToken;
  (placeImg ? loadOmamoriImage(placeImg) : Promise.resolve(null))
    .then((image) => {
      if (token !== invitePhotoToken) return null;
      invitePlaceImage = image;
      inviteDirty = true;
      if (inviteOverlay.classList.contains("show")) drawInvitePreviewOnce();
      return pickReturnPhotos(image, loadOmamoriImage);
    })
    .then((photos) => {
      if (token !== invitePhotoToken || !photos) return;
      invitePhotos = photos;
      invalidateInviteFile();
      updateInviteRoute();
      if (!inviteOverlay.classList.contains("show")) return;
      fitInviteCard();
      startInvitePreviewAnim();
      warmInviteFile(); // 照片到齊了，趁使用者還在看預覽先把 GIF 做好
    });
}

// 從「今日實踐」視窗的「邀朋友」按鈕打開邀請函時，記著要回去的那張小卡
let inviteReturnTile = null;

function closeInvite() {
  inviteOverlay.classList.remove("show");
  SFX.click();
  stopInvitePreviewAnim();
  clearTimeout(inviteWarmTimer);
  clearTimeout(invitePreviewResumeTimer);
  clearTimeout(invitePreviewTimer);
  if (inviteReturnTile) {
    inviteReturnTile = null;
    modalOverlay.classList.add("show");
    dialogOpened(modalCard, modalClose);
  } else {
    dialogsClosed();
    inviteBtn.focus({ preventScroll: true });
  }
}

if (modalInviteCta) {
  modalInviteCta.addEventListener("click", () => {
    inviteReturnTile = currentModalTile;
    modalOverlay.classList.remove("show");
    openInvite({
      defaultNote: `剛走到了${inviteReturnTile.place.country}，一起參加2027年寒修行吧！`,
      placeImg: inviteReturnTile.place.img,
    });
  });
}

if (inviteBtn) {
  inviteBtn.addEventListener("click", () => openInvite());
  inviteX.addEventListener("click", closeInvite);
  inviteOverlay.addEventListener("click", (e) => {
    if (e.target === inviteOverlay) closeInvite(); // 和其他視窗一樣：點背景就關
  });
  inviteNote.addEventListener("input", queueInvitePreview);
  inviteName.addEventListener("input", queueInvitePreview);

  inviteSave.addEventListener("click", async (e) => {
    e.preventDefault(); // 檔案是點了才現做，href 不會預先準備好，全程自己接管
    let file;
    try {
      file = await ensureInviteFile();
    } catch {
      showToast("邀請卡製作失敗，請再試一次");
      syncInviteButtonLabel();
      return;
    }
    syncInviteButtonLabel();
    if (!file) {
      showToast("邀請卡製作失敗，請再試一次");
      return;
    }
    // 手機／平板交給系統分享選單（裡面就有 LINE）；電腦走下面的存檔那條。
    if (useSystemShare()) {
      SFX.click();
      navigator.share({ files: [file], title: "寒修行邀請函" }).catch((err) => {
        if (err && err.name === "AbortError") return; // 使用者自己關掉選單
        saveInviteFallback(file); // 分享被拒（例如授權過期）就至少把檔案存下來
      });
      return;
    }
    saveInviteFallback(file);
  });
}

// 畫面尺寸一變就重算邀請卡版面：轉向、視窗縮放，
// 以及手機網址列收合造成的可視高度變化（visualViewport）。
window.addEventListener("resize", fitInviteCard);
window.addEventListener("orientationchange", fitInviteCard);
if (window.visualViewport) window.visualViewport.addEventListener("resize", fitInviteCard);

// 分享不成（或這台裝置本來就不能分享）時的存檔出口：
// Chrome／Edge 跳「另存新檔」讓使用者挑資料夾，其他瀏覽器就存到預設下載資料夾。
function saveInviteFallback(file) {
  if (window.showSaveFilePicker) saveInviteAs(file);
  else omamoriFallbackDownload(file);
}

// 電腦版 Chrome／Edge：跳出「另存新檔」，使用者自己挑資料夾
async function saveInviteAs(file) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: file.name,
      types: [{ description: "GIF 圖檔", accept: { "image/gif": [".gif"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    showToast("💌 邀請卡已存檔");
  } catch (err) {
    if (err && err.name === "AbortError") return; // 使用者自己按取消
    omamoriFallbackDownload(file);
  }
}

document.addEventListener("keydown", (e) => {
  const inviteOpen = !!inviteOverlay && inviteOverlay.classList.contains("show");
  const omamoriOpen = !!omamoriOverlay && omamoriOverlay.classList.contains("show");
  const quizOpen = !!quizOverlay && quizOverlay.classList.contains("show");
  const mapOpen = !!mapOverlay && mapOverlay.classList.contains("show");
  const modalOpen = modalOverlay.classList.contains("show");
  if (e.key === "Escape") {
    if (inviteOpen) closeInvite();
    else if (omamoriOpen) closeOmamori();
    else if (quizOpen) closeQuiz();
    else if (mapOpen) closePlaceMap();
    else if (modalOpen) closeModal();
    return;
  }
  if (inviteOpen) trapTab(e, inviteCard);
  else if (omamoriOpen) trapTab(e, omamoriCard);
  else if (quizOpen) trapTab(e, quizCard);
  else if (mapOpen) trapTab(e, mapCard);
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
  preloadTemple(TILES[(position + roll) % TILE_COUNT]);

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
