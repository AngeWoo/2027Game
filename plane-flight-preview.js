/* 小飛機動畫草稿頁的驅動程式（提案用，不是正式流程的一部分）。
   不能寫成 inline script：/2027Game/ 的 CSP 是 script-src 'self'。 */

const MOCK_TILES = [
  "科納佈教所", "真澄寺", "夏威夷精舍", "命運", "應現院", "秘魯佈教所",
  "基輔佈教所", "機會", "阿姆斯特丹", "紐約精舍", "昌原佈教所", "美國本部",
  "寒修行原點", "慕尼黑精舍", "命運", "臺中佈教所", "吉隆坡佈教所", "米蘭精舍",
];

const board = document.getElementById("board");
MOCK_TILES.forEach((name, i) => {
  const el = document.createElement("div");
  // 左下角那一格就是「寒修行原點」，跟正式棋盤一樣
  el.className = "mock-tile" + (name === "寒修行原點" ? " start" : "");
  el.textContent = name;
  board.appendChild(el);
});

const startTile = board.querySelector(".mock-tile.start");
const takeBtn = document.getElementById("takeBtn");
const replay = document.getElementById("replay");
const arcInput = document.getElementById("arc");
const durInput = document.getElementById("dur");
const arcVal = document.getElementById("arcVal");
const durVal = document.getElementById("durVal");
const showPath = document.getElementById("showPath");
const pathGhost = document.getElementById("pathGhost");
const pathLine = document.getElementById("pathLine");

let cancel = null;

function currentArc() {
  return Number(arcInput.value) / 100;
}
function currentDur() {
  return Number(durInput.value);
}

// 把這次要飛的那條弧線畫出來，方便調弧度
function drawPath() {
  if (!showPath.checked) {
    pathGhost.hidden = true;
    return;
  }
  const a = takeBtn.getBoundingClientRect();
  const b = startTile.getBoundingClientRect();
  const p0 = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const p2 = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  const dx = p2.x - p0.x, dy = p2.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const arc = currentArc();
  const c = { x: (p0.x + p2.x) / 2 + nx * len * arc, y: (p0.y + p2.y) / 2 + ny * len * arc };
  pathLine.setAttribute("d", `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`);
  pathGhost.hidden = false;
}

function fly() {
  if (cancel) cancel();
  drawPath();
  cancel = flyPlaneTo(takeBtn, startTile, {
    arc: currentArc(),
    duration: currentDur(),
  });
}

takeBtn.addEventListener("click", fly);
replay.addEventListener("click", fly);
arcInput.addEventListener("input", () => {
  arcVal.textContent = currentArc().toFixed(2);
  drawPath();
});
durInput.addEventListener("input", () => {
  durVal.textContent = currentDur() + "ms";
  drawPath();
});
showPath.addEventListener("change", drawPath);
window.addEventListener("resize", drawPath);

/* 「顯示連續動作」：把飛機沿著路徑的幾個位置同時印出來，
   一張圖就看得懂整段動作（截圖給人看的時候特別有用）。
   用的是 plane-flight.js 裡同一組貝茲與鏡射邏輯，所以跟實際飛的一模一樣。 */
const ghostsBtn = document.getElementById("ghosts");
let ghostLayer = null;

ghostsBtn.addEventListener("click", () => {
  if (ghostLayer) {
    ghostLayer.remove();
    ghostLayer = null;
    ghostsBtn.textContent = "顯示連續動作";
    return;
  }
  drawPath();
  const src = document.querySelector(".modal-plane");
  const a = takeBtn.getBoundingClientRect();
  const b = startTile.getBoundingClientRect();
  const p0 = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const p2 = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  const c = arcControl(p0, p2, currentArc());

  ghostLayer = document.createElement("div");
  ghostLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:68;";
  document.body.appendChild(ghostLayer);

  const START = 86, END = 30, N = 7;
  const RATIO = 40 / 72; // 跟 plane-flight.js 一樣：viewBox 72x40
  for (let i = 0; i < N; i++) {
    const e = i / (N - 1);
    const pos = qBezier(p0, c, p2, e);
    const tan = qTangent(p0, c, p2, e);
    const angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
    const leftward = tan.x < 0;
    const size = START + (END - START) * e;
    const g = src.cloneNode(true);
    g.style.cssText =
      "position:absolute;left:0;top:0;width:" + START + "px;height:auto;" +
      // 起點最清楚、越飛越淡 —— 跟實際動畫的淡出方向一致
      "opacity:" + (1 - 0.5 * (i / (N - 1))) + ";";
    g.style.transform =
      "translate(" + (pos.x - START / 2) + "px," + (pos.y - (START * RATIO) / 2) + "px)" +
      " rotate(" + (leftward ? angle - 180 : angle) + "deg)" +
      (leftward ? " scale(-1,1)" : "") +
      " scale(" + size / START + ")";
    ghostLayer.appendChild(g);
  }
  ghostsBtn.textContent = "清除殘影";
});
