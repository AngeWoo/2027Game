/* 題庫檢查 — 讀 Google 試算表，預覽題目並檢查格式
   題目的新增／修改／刪除都在試算表裡做，這頁只負責「看」和「挑錯」。
   來源順序和遊戲一致：試算表 → quiz.json。                            */

const SHEET_ID = "10XOptiWlH3KWV1nI9bP9odEpemr1dndmH8Lc0cjUMwo";
const SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const SHEET_EDIT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const OPT_KEYS = ["A", "B", "C", "D", "E", "F"];

/* ---------- 密碼鎖 ----------
   純前端的「擋一下」，不是真正的安全機制：會看原始碼的人還是進得來。
   真正的保護在試算表那邊 —— 要改題庫得有你的 Google 帳號權限。      */
const PASS_SALT = "2027Game|";
const PASS_HASH = "0c58bc042054e72c09a7594f24592f41afe1ec78b5ff3f95d7206ab45435178f";
const UNLOCK_FLAG = "hx2027.qaUnlocked";

const lock = document.getElementById("lock");
const lockForm = document.getElementById("lockForm");
const lockInput = document.getElementById("lockInput");
const lockError = document.getElementById("lockError");
const adminHead = document.getElementById("adminHead");
const adminMain = document.getElementById("adminMain");

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unlock() {
  lock.hidden = true;
  adminHead.hidden = false;
  adminMain.hidden = false;
  try {
    sessionStorage.setItem(UNLOCK_FLAG, "1");
  } catch (e) {}
  start();
}

lockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  lockError.hidden = true;
  let ok = false;
  try {
    ok = (await sha256Hex(PASS_SALT + lockInput.value)) === PASS_HASH;
  } catch (err) {
    ok = false;
  }
  if (ok) {
    unlock();
    return;
  }
  lockError.hidden = false;
  lockInput.value = "";
  lockInput.focus();
  lockForm.classList.remove("shake");
  void lockForm.offsetWidth;
  lockForm.classList.add("shake");
});

/* ---------- 共用 ---------- */
const listEl = document.getElementById("list");
const countLabel = document.getElementById("countLabel");
const emptyHint = document.getElementById("emptyHint");
const linkState = document.getElementById("linkState");
const verdictEl = document.getElementById("verdict");
const cardTpl = document.getElementById("cardTpl");
const toastEl = document.getElementById("toast");

document.getElementById("sheetBtn").href = SHEET_EDIT;

let rows = [];
let issues = [];
let source = "";

let toastTimer = null;
function toast(msg, bad) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("bad", !!bad);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2800);
}

/* ---------- CSV ---------- */
function parseCsvTable(text) {
  const out = [];
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
      out.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

// 回傳 { rows, issues } —— issues 是給人看的錯誤清單，標上試算表的實際列號
function readSheetCsv(text) {
  const table = parseCsvTable(text).filter((r) => r.some((c) => c && c.trim()));
  if (table.length < 2) throw new Error("試算表沒有資料");
  const head = table[0].map((h) => (h || "").trim());
  const qi = head.indexOf("題目");
  const ai = head.indexOf("正解");
  const ei = head.indexOf("解說");
  if (qi < 0 || ai < 0) throw new Error("標題列要有「題目」和「正解」這兩欄");
  const optCols = OPT_KEYS.map((k) => head.indexOf("選項" + k));
  if (optCols.every((c) => c < 0)) throw new Error("標題列至少要有「選項A」「選項B」");

  const good = [];
  const bad = [];
  table.slice(1).forEach((r, n) => {
    const line = n + 2; // 試算表上的列號（含標題列）
    const q = (r[qi] || "").trim();
    const want = (r[ai] || "").trim().toUpperCase();
    if (!q) {
      if (r.some((c) => c && c.trim())) bad.push(`第 ${line} 列：有資料但沒填題目`);
      return;
    }
    const options = [];
    let answer = -1;
    optCols.forEach((ci, k) => {
      if (ci < 0) return;
      const v = (r[ci] || "").trim();
      if (!v) return;
      if (OPT_KEYS[k] === want) answer = options.length;
      options.push(v);
    });
    if (options.length < 2) {
      bad.push(`第 ${line} 列：「${q.slice(0, 14)}…」只有 ${options.length} 個選項，至少要兩個`);
      return;
    }
    if (!want) {
      bad.push(`第 ${line} 列：「${q.slice(0, 14)}…」沒填正解`);
      return;
    }
    if (answer < 0) {
      bad.push(`第 ${line} 列：「${q.slice(0, 14)}…」正解填了 ${want}，但選項${want} 是空的`);
      return;
    }
    good.push({ q, options, answer, explain: ei >= 0 ? (r[ei] || "").trim() : "", line });
  });

  // 重複題目也挑出來
  const seen = new Map();
  good.forEach((it) => {
    const key = it.q.replace(/\s+/g, "");
    if (seen.has(key)) bad.push(`第 ${it.line} 列和第 ${seen.get(key)} 列題目重複`);
    else seen.set(key, it.line);
  });

  return { rows: good, issues: bad };
}

/* ---------- 讀取 ---------- */
async function loadBank() {
  countLabel.textContent = "讀取中…";
  linkState.textContent = "資料來源：讀取中…";
  linkState.classList.remove("linked", "warn");

  // 1) Google 試算表
  try {
    const res = await fetch(SHEET_CSV + "&t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const got = readSheetCsv(await res.text());
    rows = got.rows;
    issues = got.issues;
    source = "Google 試算表";
    linkState.textContent = "資料來源：Google 試算表（遊戲讀的就是這份）";
    linkState.classList.add("linked");
    render();
    return;
  } catch (e) {
    console.warn("試算表讀取失敗：", e);
    var sheetErr = e.message || String(e);
  }

  // 2) quiz.json
  try {
    const res = await fetch("quiz.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    rows = (Array.isArray(data) ? data : []).map((d, i) => ({ ...d, line: i + 1 }));
    issues = [`讀不到 Google 試算表（${sheetErr}），目前顯示的是本機 quiz.json 備份。`];
    source = "quiz.json";
    linkState.textContent = "資料來源：quiz.json 備份（試算表讀不到）";
    linkState.classList.add("warn");
    render();
    return;
  } catch (e) {
    rows = [];
    issues = [`試算表讀不到（${sheetErr}），quiz.json 也讀不到（${e.message}）。`];
    source = "";
    linkState.textContent = "資料來源：都讀不到";
    linkState.classList.add("warn");
    render();
  }
}

/* ---------- 畫面 ---------- */
function render() {
  listEl.textContent = "";
  rows.forEach((item, idx) => listEl.appendChild(buildCard(item, idx)));
  countLabel.textContent = rows.length ? `共 ${rows.length} 題` : "沒有題目";
  emptyHint.hidden = rows.length > 0;

  verdictEl.textContent = "";
  if (!issues.length && rows.length) {
    verdictEl.className = "verdict ok";
    verdictEl.textContent = `✓ 格式檢查通過，${rows.length} 題都可以出`;
    verdictEl.hidden = false;
  } else if (issues.length) {
    verdictEl.className = "verdict bad";
    const h = document.createElement("strong");
    h.textContent = `有 ${issues.length} 個地方要處理：`;
    const ul = document.createElement("ul");
    issues.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    verdictEl.append(h, ul);
    verdictEl.hidden = false;
  } else {
    verdictEl.hidden = true;
  }
}

function buildCard(item, idx) {
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".card-no").textContent = `第 ${idx + 1} 題`;
  const flag = node.querySelector(".card-flag");
  if (source === "Google 試算表") flag.textContent = `試算表第 ${item.line} 列`;
  node.querySelector(".card-q").textContent = item.q;

  const ol = node.querySelector(".ro-options");
  item.options.forEach((text, i) => {
    const li = document.createElement("li");
    li.className = i === item.answer ? "is-answer" : "";
    const k = document.createElement("span");
    k.className = "opt-key";
    k.textContent = OPT_KEYS[i] || i + 1;
    const t = document.createElement("span");
    t.textContent = text;
    li.append(k, t);
    ol.appendChild(li);
  });

  const ex = node.querySelector(".card-explain");
  if (item.explain) ex.textContent = item.explain;
  else ex.hidden = true;

  return node;
}

/* ---------- 下載備份 ---------- */
function download() {
  if (!rows.length) {
    toast("沒有題目可以備份", true);
    return;
  }
  if (issues.length && source === "Google 試算表") {
    if (!confirm(`試算表還有 ${issues.length} 個問題，有問題的題目不會被收進備份。要繼續下載嗎？`))
      return;
  }
  const clean = rows.map((r) => ({
    q: r.q,
    options: r.options,
    answer: r.answer,
    explain: r.explain || "",
  }));
  const blob = new Blob([JSON.stringify(clean, null, 2) + "\n"], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quiz.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`已下載 ${clean.length} 題，蓋回網站資料夾就更新備份`);
}

document.getElementById("reloadBtn").addEventListener("click", () => loadBank());
document.getElementById("downloadBtn").addEventListener("click", download);

/* ---------- 起步 ---------- */
async function start() {
  await loadBank();
}

let alreadyUnlocked = false;
try {
  alreadyUnlocked = sessionStorage.getItem(UNLOCK_FLAG) === "1";
} catch (e) {}
if (alreadyUnlocked) unlock();
else lockInput.focus();
