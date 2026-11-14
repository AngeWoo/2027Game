// 顏色：取自附圖布面受光處最鮮豔的一成像素
const PALETTE = [
  { name: "紫",   light: "#D68FCF", mid: "#C16BB9", dark: "#8E3C87" },
  { name: "朱紅", light: "#E8706F", mid: "#DA4B4E", dark: "#A32226" },
  { name: "橄欖", light: "#BAC78F", mid: "#A2B26D", dark: "#6F7D42" },
  { name: "橘",   light: "#EFA188", mid: "#E08167", dark: "#B94626" },
  { name: "金黃", light: "#F0C286", mid: "#E4AA5E", dark: "#BC781F" },
];

const VB_W = 300, VB_H = 376;

// 布袋外形：四角圓潤、左右中段微收、底邊是抓皺的縫份
const BODY =
  "M 54,16 C 120,9 180,9 246,16" +
  " C 278,21 292,42 290,78" +
  " C 287,120 285,160 285,188" +
  " C 285,216 287,252 290,292" +
  " C 292,326 278,344 246,350" +
  " C 214,355 184,352 150,355 C 118,358 88,355 54,350" +
  " C 22,344 8,326 10,292" +
  " C 13,252 15,216 15,188" +
  " C 15,160 13,120 10,78" +
  " C 8,42 22,21 54,16 Z";

// おまもり ── 每個字畫在 100x100 的格子裡，用圓頭筆畫模擬毛筆
const KANA = {
  // お：短橫 + 由上往下左撇再回勾成圈 + 右上一點
  o: [["M 12,30 C 32,24 55,23 73,26", 6.7],
      ["M 52,6 C 50,28 45,50 36,64 C 27,79 31,92 45,90 C 59,88 67,75 60,63 C 53,52 36,53 27,66", 8.2],
      ["M 80,30 C 89,39 90,52 82,61", 5.6]],
  // ま：兩道橫 + 一豎到底回勾
  ma:[["M 16,22 C 36,17 60,16 80,19", 6.7],
      ["M 6,48 C 30,42 62,41 88,44", 7.7],
      ["M 58,4 C 56,30 52,56 47,70 C 42,85 47,95 58,91 C 70,87 73,73 63,64", 8.2]],
  // も：一豎帶大勾 + 兩道橫
  mo:[["M 47,4 C 45,30 42,58 44,73 C 46,87 58,92 72,83", 8.2],
      ["M 17,32 C 38,26 60,25 78,28", 6.7],
      ["M 14,58 C 36,52 59,51 77,54", 6.7]],
  // り：左短 + 右長撇回收
  ri:[["M 32,12 C 28,32 28,50 35,64", 7.9],
      ["M 75,10 C 76,34 75,58 68,74 C 60,91 43,96 27,88", 8.2]],
};

function kana(which, x, y, size) {
  const k = size / 100;
  const strokes = KANA[which].map(([d, w]) => `<path d="${d}" stroke-width="${w}"/>`).join("");
  return `<g transform="translate(${x},${y}) scale(${k})">${strokes}</g>`;
}

function omamori(p, uid, opts = {}) {
  const cord = opts.cord;
  const vbH = cord ? VB_H + 186 : VB_H;
  const yOff = cord ? 186 : 0;

  const cordArt = cord ? `
    <g>
      <g fill="none" stroke-linecap="round">
        <path d="M 150,6 C 116,22 110,70 150,98 C 190,70 184,22 150,6" stroke="#f1e8d6" stroke-width="8"/>
        <path d="M 150,6 C 116,22 110,70 150,98 C 190,70 184,22 150,6" stroke="#cfc0a2" stroke-width="2.4" stroke-dasharray="4 8"/>
      </g>
      <rect x="140" y="96" width="20" height="44" rx="7" fill="#f1e8d6"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M 141,${100 + i * 7.2} L 159,${105 + i * 7.2}" stroke="${
        ["#e2544b", "#f0b23c", "#6fa85c", "#4f8fd0", "#c76cc0", "#e2544b"][i]}" stroke-width="3.4" stroke-linecap="round"/>`).join("")}
      <ellipse cx="150" cy="154" rx="16" ry="14" fill="url(#bead${uid})"/>
      <ellipse cx="144" cy="149" rx="5.5" ry="3.6" fill="#ffffff" opacity=".5"/>
      <g stroke-linecap="round" fill="none">
        ${Array.from({ length: 23 }, (_, i) => {
          const x = 124 + i * 2.3, len = 104 + (i % 4) * 12;
          const c = ["#ec5f86", "#f7ebb0", "#ffffff", "#ec5f86", "#9ad8c6"][i % 5];
          return `<path d="M ${x},166 C ${x - 2},${166 + len * .55} ${x - 3.5},${166 + len * .8} ${x - 5},${166 + len}"
                   stroke="${c}" stroke-width="2.4" opacity=".95"/>`;
        }).join("")}
      </g>
    </g>` : "";

  // 底邊抓皺的縫份
  const hem = Array.from({ length: 8 }, (_, i) => {
    const x = 36 + i * 29;
    return `<path d="M ${x},336 C ${x + 7},348 ${x + 22},348 ${x + 29},336"
             stroke="#2b1608" stroke-opacity=".13" stroke-width="2" fill="none"/>`;
  }).join("");

  return `
<svg viewBox="0 0 ${VB_W} ${vbH}" width="${opts.w || 150}" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="${p.name}色御守">
  <defs>
    <linearGradient id="cloth${uid}" x1="16%" y1="2%" x2="84%" y2="100%">
      <stop offset="0"   stop-color="${p.light}"/>
      <stop offset=".5"  stop-color="${p.mid}"/>
      <stop offset="1"   stop-color="${p.dark}"/>
    </linearGradient>
    <radialGradient id="hi${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0"   stop-color="#ffffff" stop-opacity=".24"/>
      <stop offset=".6"  stop-color="#ffffff" stop-opacity=".06"/>
      <stop offset="1"   stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="edge${uid}" cx="46%" cy="42%" r="66%">
      <stop offset="0"   stop-color="#2b1608" stop-opacity="0"/>
      <stop offset=".72" stop-color="#2b1608" stop-opacity=".04"/>
      <stop offset="1"   stop-color="#2b1608" stop-opacity=".24"/>
    </radialGradient>
    <radialGradient id="bead${uid}" cx="36%" cy="30%" r="72%">
      <stop offset="0" stop-color="#d7f0ab"/>
      <stop offset=".6" stop-color="#8dc96a"/>
      <stop offset="1" stop-color="#5d9739"/>
    </radialGradient>
    <linearGradient id="silver${uid}" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0"   stop-color="#ffffff"/>
      <stop offset=".3"  stop-color="#dcdfe1"/>
      <stop offset=".58" stop-color="#a7adb1"/>
      <stop offset=".8"  stop-color="#e9ebec"/>
      <stop offset="1"   stop-color="#c3c8cb"/>
    </linearGradient>
    <filter id="weave${uid}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95 0.6" numOctaves="4" seed="${uid}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
    <filter id="soft${uid}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <!-- 乾筆：讓銀色筆畫的邊緣毛毛的，再壓一道影子 -->
    <filter id="brush${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="${uid * 7}" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="2.6"
                         xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feDropShadow in="d" dx="0" dy="1.2" stdDeviation="1" flood-color="#2a1405" flood-opacity=".4"/>
    </filter>
    <clipPath id="clip${uid}"><path d="${BODY}"/></clipPath>
  </defs>


  <g transform="translate(0,${yOff})">
    <path d="${BODY}" fill="url(#cloth${uid})"/>
    <g clip-path="url(#clip${uid})">
      <ellipse cx="112" cy="122" rx="168" ry="162" fill="url(#hi${uid})"/>
      <rect width="${VB_W}" height="${VB_H}" fill="url(#edge${uid})"/>
      <g fill="none" filter="url(#soft${uid})">
        <path d="M 32,52 C 110,42 190,42 268,52" stroke="#2b1608" stroke-opacity=".09" stroke-width="7"/>
        <path d="M 32,318 C 110,328 190,328 268,318" stroke="#2b1608" stroke-opacity=".09" stroke-width="7"/>
        <path d="M 150,26 C 146,130 154,240 150,336" stroke="#2b1608" stroke-opacity=".06" stroke-width="7"/>
      </g>
      <g fill="none">
        <path d="M 32,48 C 110,38 190,38 268,48" stroke="#ffffff" stroke-opacity=".13" stroke-width="1.5"/>
        <path d="M 32,322 C 110,332 190,332 268,322" stroke="#ffffff" stroke-opacity=".10" stroke-width="1.5"/>
      </g>
      ${hem}
      <rect width="${VB_W}" height="${VB_H}" filter="url(#weave${uid})" opacity=".12" style="mix-blend-mode:overlay"/>
    </g>
    <path d="${BODY}" fill="none" stroke="#ffffff" stroke-opacity=".2" stroke-width="1.4"/>

    <g fill="none" stroke="url(#silver${uid})" stroke-linecap="round" stroke-linejoin="round"
       filter="url(#brush${uid})">
      ${kana("o",  152,  48, 86)}
      ${kana("ma", 152, 136, 86)}
      ${kana("mo",  58, 120, 86)}
      ${kana("ri",  58, 208, 86)}
      <!-- 落款：Shin 草簽 + 方印 -->
      <g stroke-width="1.7">
        <path d="M 72,302 C 70,296 62,295 59,300 C 56,306 68,309 69,315 C 70,321 62,323 57,319"/>
        <path d="M 76,292 C 75,303 74,312 74,320 M 74,308 C 78,302 85,303 85,311 C 85,316 85,318 85,320"/>
        <path d="M 92,307 C 92,313 92,317 92,320"/>
        <path d="M 99,307 C 99,313 99,317 99,320 M 99,311 C 103,304 110,306 110,313 C 110,317 110,318 110,320"/>
        <path d="M 110,320 C 115,322 119,320 121,316"/>
      </g>
      <g stroke-width="1.3">
        <rect x="112" y="308" width="14" height="14" rx="2.4"/>
        <path d="M 115.4,312 L 122.6,312 M 115.4,316 L 122.6,316 M 119,310.5 L 119,318.5"/>
      </g>
    </g>
  </g>
  ${cordArt}
</svg>`;
}

let uid = 0;
const mk = (p, opts) => {
  const f = document.createElement("figure");
  f.className = "cell";
  f.style.margin = "0";
  f.innerHTML = omamori(p, ++uid, opts) + `<figcaption>${p.name}</figcaption>`;
  return f;
};

PALETTE.forEach((p) => document.getElementById("row5").appendChild(mk(p, { w: 155 })));
document.getElementById("rowBig").appendChild(mk(PALETTE[1], { w: 290 }));
PALETTE.forEach((p) => {
  const f = document.createElement("figure");
  f.className = "cell strip";
  f.style.margin = "0";
  f.innerHTML = motifStrip(p.mid, ++uid, 112) + `<figcaption>${p.name}</figcaption>`;
  document.getElementById("rowStrip").appendChild(f);
});

PALETTE.forEach((p) => {
  const f = document.createElement("figure");
  f.className = "cell";
  f.style.margin = "0";
  const u = ++uid;
  f.innerHTML =
    `<div class="panel" style="background:${p.mid}">` +
      motifPanel(u) +
      `<div class="pouch">${omamori(p, ++uid, { w: 300 })}</div>` +
    `</div><figcaption>${p.name}</figcaption>`;
  document.getElementById("rowPanel").appendChild(f);
});

PALETTE.forEach((p) => document.getElementById("rowCord").appendChild(mk(p, { w: 134, cord: true })));
