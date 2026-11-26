/* 小飛機飛向「寒修行原點」—— 收下御守之後的收尾動畫（提案用草稿）

   做法重點：
   1. 飛機不另外做圖：直接 clone 頁面上「今日實踐」視窗那隻綿羊小飛機（.modal-plane），
      樣式和配色自然一致，也不用多一份 SVG 要維護。
   2. 路徑是二次貝茲曲線（弧線），控制點取「起迄點中點」再往垂直方向推出去，
      所以弧度大小用一個比例值就能調。
   3. 機頭對齊切線 —— 但往左飛時若直接轉到切線角度，整架飛機會翻過來、
      小羊變成頭下腳上。所以往左飛時改成「水平鏡射 + 角度補 180°」，小羊永遠是正的。
   4. 飛到終點時縮小淡出，並在原點那一格留一圈擴散的光環，像降落。
*/

// 二次貝茲：位置
function qBezier(p0, c, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
  };
}
// 二次貝茲：切線方向（微分）
function qTangent(p0, c, p2, t) {
  const u = 1 - t;
  return {
    x: 2 * u * (c.x - p0.x) + 2 * t * (p2.x - c.x),
    y: 2 * u * (c.y - p0.y) + 2 * t * (p2.y - c.y),
  };
}

// 取控制點：中點往「垂直於起迄連線」的方向推，arc 是相對於連線長度的比例。
// 預設往上凸（螢幕座標 y 往下為正，所以取 y 比較小的那一側）。
function arcControl(p0, p2, arc) {
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  // 垂直向量有兩個方向，挑往上的那個
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mx + nx * len * arc, y: my + ny * len * arc };
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/* 讓一架小飛機從 from 飛到 to。
   from / to 可以是 DOM 元素或 {x, y}（視窗座標）。
   opts:
     arc       弧度，相對於起迄連線長度的比例（0 = 直線，0.3 ≈ 明顯的弧）
     duration  飛行時間（毫秒）
     playSound 播放同步音效，接收飛行時間並回傳停止音效的函式
     startSize / endSize  飛機寬度（px），從大縮到小
     onDone    結束後的 callback
   回傳一個可以提前中止的函式。 */
function flyPlaneTo(from, to, opts = {}) {
  const {
    arc = 0.32,
    duration = 5000,
    startSize = 86,
    endSize = 30,
    fadeFrom = 0.72, // 飛到幾成之後開始淡出
    landRing = true,
    playSound = null,
    onDone = null,
  } = opts;

  const source = document.querySelector(".modal-plane");
  if (!source) return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (onDone) onDone();
    return () => {};
  }

  const p0 = from && from.nodeType ? centerOf(from) : from;
  const p2 = to && to.nodeType ? centerOf(to) : to;
  if (!p0 || !p2) return () => {};
  const c = arcControl(p0, p2, arc);

  // 飛機 SVG 的 viewBox 是 72x40，所以實際高度 = 寬度 x (40/72)。
  // 垂直置中要用真正的半高，用寬度的一半會讓整架往上偏約 19px，
  // 起點就不會剛好落在「收下御守」按鈕上。
  const PLANE_RATIO = 40 / 72;

  const plane = source.cloneNode(true);
  plane.classList.add("plane-flying");
  plane.removeAttribute("id");
  plane.style.cssText =
    "position:fixed;left:0;top:0;width:" + startSize + "px;height:auto;" +
    "z-index:70;pointer-events:none;will-change:transform,opacity;";
  document.body.appendChild(plane);
  const stopSound = playSound ? playSound(duration) : null;

  let raf = 0;
  let stopped = false;
  const t0 = performance.now();

  function frame(now) {
    if (stopped) return;
    const t = Math.min(1, (now - t0) / duration);
    // 起飛慢、中段快、降落再慢一點
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const pos = qBezier(p0, c, p2, e);
    const tan = qTangent(p0, c, p2, e);
    const angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
    // 往左飛就鏡射，並把角度補 180°，小羊才不會頭下腳上
    const leftward = tan.x < 0;
    const rot = leftward ? angle - 180 : angle;
    const size = startSize + (endSize - startSize) * e;
    const scale = size / startSize;
    const opacity = t <= fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / (1 - fadeFrom));

    plane.style.opacity = String(opacity);
    plane.style.transform =
      "translate(" + (pos.x - startSize / 2) + "px," + (pos.y - (startSize * PLANE_RATIO) / 2) + "px)" +
      " rotate(" + rot + "deg)" +
      (leftward ? " scale(-1,1)" : "") +
      " scale(" + scale + ")";

    if (t < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    plane.remove();
    if (stopSound) stopSound();
    if (landRing) showLandRing(p2);
    if (onDone) onDone();
  }
  // 第一幀要馬上同步畫出來，不能等 requestAnimationFrame：
  // 元素一加進頁面還沒有 transform，會先在畫面左上角 (0,0) 閃現一幀，
  // 看起來像飛機從角落蹦出來再瞬移到按鈕上。
  frame(performance.now());

  return function cancel() {
    stopped = true;
    cancelAnimationFrame(raf);
    plane.remove();
    if (stopSound) stopSound();
  };
}

// 降落的光環：在原點那一格擴散一圈就消失
function showLandRing(p) {
  const ring = document.createElement("span");
  ring.className = "plane-land-ring";
  ring.style.left = p.x + "px";
  ring.style.top = p.y + "px";
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);
}
