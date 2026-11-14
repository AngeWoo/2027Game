// ---------- 盒側的星月紋樣 ----------
// 位置與大小量自附圖（原圖 352 x 840），底色橘 #DE6048、紋樣薄荷綠 #60CC84
const MOTIF_GREEN = "#62CE86";

// n 角星：outer 外徑、inner 內徑比例
function starPath(cx, cy, outer, points, innerRatio, rot = -90) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? outer * innerRatio : outer;
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

// 月牙：大圓挖掉偏移的小圓
function crescentPath(cx, cy, r, bite, dx, dy) {
  return `M ${cx},${cy - r} A ${r},${r} 0 1 0 ${cx},${cy + r}` +
         ` A ${bite},${bite} 0 1 1 ${cx},${cy - r} Z`;
}

// Shinnyo 銀色草寫簽名（畫在 160 x 48 的格子裡）
const SHINNYO = [
  "M 10,34 C 14,22 26,18 30,24 C 33,30 18,34 16,41 C 14,47 24,49 32,43",
  "M 38,18 C 36,30 34,40 34,45 M 34,32 C 40,24 49,26 49,35 C 49,40 48,43 48,45",
  "M 57,30 C 57,37 56,42 56,45 M 56,27 L 56,24",
  "M 64,30 C 64,37 63,42 63,45 M 63,33 C 68,25 77,27 77,36 C 77,41 76,43 76,45",
  "M 84,30 C 84,37 83,42 83,45 M 83,33 C 88,25 97,27 97,36 C 97,41 96,43 96,45",
  "M 104,30 C 104,38 107,44 112,44 C 118,44 121,37 120,31 M 120,31 C 119,42 117,52 109,54",
  "M 127,30 C 127,38 130,44 135,44 C 141,44 144,37 143,31 M 143,31 C 142,42 140,52 132,54",
  "M 146,30 C 152,34 158,30 160,24",
];

function shinnyo(x, y, w, uid) {
  const k = w / 170;
  return `<g transform="translate(${x},${y}) scale(${k})" fill="none"
             stroke="url(#silver${uid})" stroke-width="2.6"
             stroke-linecap="round" stroke-linejoin="round">
    ${SHINNYO.map((d) => `<path d="${d}"/>`).join("")}
  </g>`;
}

// 盒側直幅：完全照附圖的排列
function motifStrip(bg, uid, w = 150) {
  return `
<svg viewBox="0 0 352 840" width="${w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="星月紋樣">
  <defs>
    <linearGradient id="silver${uid}" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#dcdfe1"/>
      <stop offset=".58" stop-color="#a7adb1"/><stop offset=".8" stop-color="#e9ebec"/>
      <stop offset="1" stop-color="#c3c8cb"/>
    </linearGradient>
    <filter id="mEmb${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="1" stdDeviation=".8" flood-color="#2a1405" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect width="352" height="840" fill="${bg}"/>
  <g fill="${MOTIF_GREEN}">
    <circle cx="107" cy="36" r="6.5"/>
    <circle cx="190" cy="134" r="58"/>
    <path d="${starPath(144, 312, 34, 6, 0.3)}"/>
    <circle cx="240" cy="310" r="8.5"/>
    <circle cx="115" cy="484" r="8.5"/>
    <path d="${starPath(226, 602, 25, 5, 0.42)}"/>
    <path d="${crescentPath(178, 678, 71, 57)}" transform="rotate(-28 178 678)"/>
    <path d="${starPath(128, 810, 19, 5, 0.42)}"/>
  </g>
  <g filter="url(#mEmb${uid})">${shinnyo(168, 404, 170, uid)}</g>
</svg>`;
}

// 遊戲視窗用：御守背後的星月紋樣（340 x 470，紋樣都排在御守周圍）
function motifPanel(uid) {
  return `
<svg class="deco" viewBox="0 0 340 470" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="silver${uid}" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#dcdfe1"/>
      <stop offset=".58" stop-color="#a7adb1"/><stop offset=".8" stop-color="#e9ebec"/>
      <stop offset="1" stop-color="#c3c8cb"/>
    </linearGradient>
    <filter id="mEmb${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="1" stdDeviation=".8" flood-color="#2a1405" flood-opacity=".35"/>
    </filter>
  </defs>
  <g fill="${MOTIF_GREEN}">
    <circle cx="48" cy="38" r="5"/>
    <circle cx="288" cy="70" r="33"/>
    <path d="${starPath(42, 128, 21, 6, 0.3)}"/>
    <circle cx="300" cy="150" r="6.5"/>
    <circle cx="36" cy="232" r="6.5"/>
    <path d="${starPath(296, 250, 15, 5, 0.42)}"/>
    <path d="${crescentPath(46, 330, 34, 27)}" transform="rotate(-28 46 330)"/>
    <path d="${starPath(300, 352, 12, 5, 0.42)}"/>
    <circle cx="272" cy="404" r="5"/>
  </g>
  <g filter="url(#mEmb${uid})">${shinnyo(106, 404, 130, uid)}</g>
</svg>`;
}
