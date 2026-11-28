/* 「回到親苑」動畫疊層 —— 邀請卡動畫版草稿（提案用，還沒接進正式流程）

   概念：寒修行的原點在親苑。遊戲帶著玩家走到世界各地的精舍，
         邀請卡的動畫就把這段路收回來 —— 世界各地的精舍照片一張一張
         飛回右上角那個相片框，最後落定的那一張是親苑：
         它會放大、相框轉金、旭日亮一下，然後整支動畫就停在這裡。

   做法：不改 invite-card-draft.js。這裡只負責「疊在卡片上的那一層」，
         底下的卡片照樣由 renderInviteCardDraft() 畫（placeImage 傳 null，
         右上角那張照片改由這一層自己管，才能做飛入、換張和放大）。

   時間軸 t 從 0 到 1：
     0.00-0.06  起：框裡是你抽到的那間精舍
     0.06-0.60  行：三張世界精舍依序飛入疊上去（每張錯開 0.12）
     0.42-0.60  歸：最後一張「親苑」從旭日裡浮出來飛進框
     0.60-0.74  放：親苑放大到 1.55 倍、相框轉金、金色光環擴散、旭日呼吸、
                    走過的那幾張往左下散開一點點，像壓在底下的一疊
     0.66-0.78  題：框下浮出「原點：回歸親苑」
     0.78-1.00  停：整支動畫停在親苑不動（GIF 用 repeat:-1 只播一次，
                    最後一幀就是這張，不會跳回開頭）
*/

const RETURN_FRAME = { w: 112, h: 82, x: 900 - 72 - 112, y: 30, tilt: Math.PI / 44 };
const RETURN_SUN = { x: 560, y: 150, r: 118 };

// 親苑落定後放大的倍率，以及放大時框心要飄到哪裡
// （往左下挪一點，才不會頂到卡片上緣，也讓底下那疊照片露得出來）
const HOME_SCALE = 1.55;
const HOME_DRIFT = [-12, 17];
const ZOOM_AT = 0.60, ZOOM_DUR = 0.14;

// 每張飛入照片的航線：from 起點（畫面外）、ctrl 貝茲控制點（決定弧度）、at 起飛時間
const RETURN_FLIGHTS = [
  { from: [1040, 260], ctrl: [980, 90], at: 0.06 },   // 從右邊來
  { from: [470, 720], ctrl: [700, 330], at: 0.18 },   // 從下面來
  { from: [-160, 300], ctrl: [250, -110], at: 0.30 }, // 從左邊來，弧線走卡片上緣，盡量不壓到題字
  { from: null, ctrl: [660, 50], at: 0.42, home: true }, // 親苑：從旭日裡浮出來（起點在畫的時候才算，要跟著 skyShiftX）
];
const FLIGHT_DUR = 0.18;

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, p) => a + (b - a) * p;

function bezier(from, ctrl, to, p) {
  const q = 1 - p;
  return [
    q * q * from[0] + 2 * q * p * ctrl[0] + p * p * to[0],
    q * q * from[1] + 2 * q * p * ctrl[1] + p * p * to[1],
  ];
}

function roundRectPathLocal(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 一張拍立得小照片：白邊、圓角、陰影、歪一點點
function drawPolaroid(ctx, img, cx, cy, scale, rot, alpha, frameColor) {
  if (!img || !img.naturalWidth || alpha <= 0) return;
  const { w, h } = RETURN_FRAME;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = "rgba(46, 42, 38, 0.32)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = frameColor;
  roundRectPathLocal(ctx, -4, -4, w + 8, h + 8, 9);
  ctx.fill();
  ctx.shadowColor = "transparent";
  roundRectPathLocal(ctx, 0, 0, w, h, 7);
  ctx.save();
  ctx.clip();
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  ctx.restore();
}

// 簡筆仙鶴，跟卡片上原本那群同一個畫法，這裡用來畫「朝著親苑收攏」的那幾隻
function drawCrane(ctx, cx, cy, scale, alpha, wingPhase) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(46, 42, 38, " + alpha + ")";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const lift = Math.sin(wingPhase * Math.PI * 2);
  const wingY = -18 - lift * 11;
  const tipY = 6 - lift * 5;
  ctx.beginPath();
  ctx.moveTo(-40, tipY);
  ctx.quadraticCurveTo(-10, wingY, 0, 0);
  ctx.quadraticCurveTo(10, wingY, 40, tipY - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, 10, 4, 22);
  ctx.stroke();
  ctx.restore();
}

/* 把動畫層畫到已經畫好底圖的 ctx 上。
   photos：[你抽到的那間, 世界精舍1, 世界精舍2, 世界精舍3, 親苑]
           不足 5 張也能跑，會自動只飛拿得到的那幾張（最後一張一律當成親苑）。*/
function drawReturnOverlay(ctx, photos, t, skyShiftX) {
  skyShiftX = skyShiftX || 0;
  const sunX = RETURN_SUN.x + skyShiftX;
  const F = RETURN_FRAME;
  const to = [F.x + F.w / 2, F.y + F.h / 2];
  const GOLD = "243, 199, 107";

  const first = photos[0] || null;
  const flying = photos.slice(1); // 要飛進來的那幾張
  const flights = RETURN_FLIGHTS.slice(RETURN_FLIGHTS.length - flying.length);
  const homeFlight = flights[flights.length - 1];
  const landed = homeFlight ? (t - homeFlight.at) / FLIGHT_DUR >= 1 : false;

  // 放大進度：親苑落定後，整張照片往左下飄一點並放大到 HOME_SCALE
  const zoom = easeOutCubic(clamp01((t - ZOOM_AT) / ZOOM_DUR));
  const homeTo = [to[0] + HOME_DRIFT[0] * zoom, to[1] + HOME_DRIFT[1] * zoom];
  const homeScale = lerp(1, HOME_SCALE, zoom);
  const homeHalfH = (F.h / 2) * homeScale;

  // 底下那疊「走過的精舍」：放大的同時主要往左散開（往下只挪一點點），
  // 像壓在親苑底下的一疊照片；往下挪太多會壓到下面那行「原點：回歸親苑」
  function stackOffset(i) {
    return [-(72 + i * 22) * zoom, (16 + i * 7) * zoom];
  }

  // ---------- 航跡線：每張照片飛的時候，身後留一條淡金色虛線 ----------
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.lineWidth = 1.3;
  flying.forEach((img, i) => {
    const f = flights[i];
    if (!f) return;
    const p = clamp01((t - f.at) / FLIGHT_DUR);
    if (p <= 0 || p >= 1) return;
    const fade = Math.sin(p * Math.PI); // 中途最明顯，起飛和落地時淡掉
    ctx.strokeStyle = "rgba(" + GOLD + ", " + 0.55 * fade + ")";
    ctx.beginPath();
    const steps = 18;
    for (let s = 0; s <= steps; s++) {
      const sp = (s / steps) * easeOutCubic(p);
      const pt = bezier(f.from || [sunX, RETURN_SUN.y], f.ctrl, to, sp);
      s === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
  });
  ctx.restore();

  // ---------- 底下那張：你抽到的那間精舍，一直墊在最底層 ----------
  if (first) {
    const off = stackOffset(flying.length - 1);
    drawPolaroid(ctx, first, to[0] + off[0], to[1] + off[1], 1, F.tilt + 0.05 * zoom, 1, "#fdf8ee");
  }

  // ---------- 飛入的照片，依序疊上去 ----------
  flying.forEach((img, i) => {
    const f = flights[i];
    if (!f) return;
    const raw = (t - f.at) / FLIGHT_DUR;
    if (raw < 0) return;
    const p = clamp01(raw);
    const done = p >= 1;
    const ep = easeOutCubic(p);

    // 親苑（最後一張）落定後走放大那條路；其他幾張落定後往左下散開一點
    let cx, cy, scale, rot, frameColor = "#fdf8ee";
    if (done && f.home) {
      cx = homeTo[0];
      cy = homeTo[1];
      scale = homeScale;
      rot = F.tilt * (1 - zoom); // 放大完全部收掉歪度：最後定格的親苑要正正地擺著
      const g = clamp01((t - ZOOM_AT) / 0.1);
      frameColor = "rgb(" + Math.round(lerp(253, 243, g)) + "," + Math.round(lerp(248, 199, g)) + "," + Math.round(lerp(238, 107, g)) + ")";
    } else if (done) {
      const off = stackOffset(flying.length - 2 - i);
      cx = to[0] + off[0];
      cy = to[1] + off[1];
      scale = 1;
      rot = F.tilt + 0.04 * zoom * (i + 1);
    } else {
      const pt = bezier(f.from || [sunX, RETURN_SUN.y], f.ctrl, to, ep);
      cx = pt[0];
      cy = pt[1];
      scale = lerp(0.55, 1, easeOutBack(p));
      rot = lerp(f.home ? -0.5 : 0.55, F.tilt, ep);
    }
    const alpha = done ? 1 : clamp01(p * 3.2);

    // 拖影：同一張照片在稍早的位置再畫兩次，透明度很低，製造速度感
    if (!done) {
      [[0.09, 0.2], [0.17, 0.09]].forEach(([lag, ghostAlpha]) => {
        const lp = easeOutCubic(clamp01(p - lag));
        if (lp <= 0) return;
        const g = bezier(f.from || [sunX, RETURN_SUN.y], f.ctrl, to, lp);
        drawPolaroid(ctx, img, g[0], g[1], lerp(0.55, 1, lp), lerp(0.55, F.tilt, lp), alpha * ghostAlpha, "#fdf8ee");
      });
    }

    drawPolaroid(ctx, img, cx, cy, scale, rot, alpha, frameColor);
  });

  if (landed) {
    // ---------- 親苑落定的那一下：金色光環往外擴散 ----------
    const burst = clamp01((t - ZOOM_AT) / 0.2);
    if (burst > 0 && burst < 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(" + GOLD + ", " + 0.65 * (1 - burst) + ")";
      ctx.lineWidth = lerp(5, 1, burst);
      ctx.beginPath();
      ctx.arc(homeTo[0], homeTo[1], lerp(60, 185, easeOutCubic(burst)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- 旭日呼吸一次：疊一層加亮的光暈，不動底下原本的太陽 ----------
    const breath = Math.sin(clamp01((t - ZOOM_AT + 0.02) / 0.24) * Math.PI);
    if (breath > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(sunX, RETURN_SUN.y, RETURN_SUN.r * 0.5, sunX, RETURN_SUN.y, RETURN_SUN.r * 1.75);
      g.addColorStop(0, "rgba(" + GOLD + ", " + 0.3 * breath + ")");
      g.addColorStop(1, "rgba(" + GOLD + ", 0)");
      ctx.fillStyle = g;
      ctx.fillRect(sunX - RETURN_SUN.r * 1.8, RETURN_SUN.y - RETURN_SUN.r * 1.8, RETURN_SUN.r * 3.6, RETURN_SUN.r * 3.6);
      ctx.restore();
    }

    // ---------- 相片框下面浮出「原點：回歸親苑」 ----------
    const cap = clamp01((t - (ZOOM_AT + 0.06)) / 0.12);
    if (cap > 0) {
      // 跟照片底緣的距離：留夠空間，不要讓字擠在那疊照片的右下角
      const capY = homeTo[1] + homeHalfH + lerp(48, 42, cap);
      const label = "原點：回歸親苑";
      ctx.save();
      ctx.globalAlpha = cap;
      ctx.textAlign = "center";
      ctx.font = 'bold 21px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
      ctx.letterSpacing = "3px";
      // 金線寬度照實際字寬算，不寫死，換字也不會長短不合
      const half = ctx.measureText(label).width / 2 + 10;
      ctx.strokeStyle = "rgba(" + GOLD + ", 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(homeTo[0] - half, capY + 9);
      ctx.lineTo(homeTo[0] + half, capY + 9);
      ctx.stroke();
      ctx.fillStyle = "rgba(138, 90, 30, 0.96)";
      ctx.fillText(label, homeTo[0], capY);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "left";
      ctx.restore();
    }
  }

  // ---------- 三隻仙鶴從左邊朝著親苑收攏（卡片原本那五隻維持各飛各的）----------
  [[0.38, 0.88, 0.0], [0.44, 0.72, 0.3], [0.5, 0.6, 0.6]].forEach(([start, scale, phase], i) => {
    const p = clamp01((t - start) / 0.3);
    if (p <= 0 || p >= 1) return;
    const ep = easeOutCubic(p);
    const cx = lerp(250 + i * 40, homeTo[0] - 62, ep);
    const cy = lerp(300 - i * 55, homeTo[1] + 40, ep);
    drawCrane(ctx, cx, cy, scale, 0.42 * Math.sin(p * Math.PI), t * 4 + phase);
  });
}

/* 畫完整的一幀（底圖 + 動畫層）。GIF 匯出和螢幕預覽共用這個函式，
   所以預覽看到的跟存下來的 GIF 一定一樣。 */
function renderReturnFrame(opts, photos, t) {
  const canvas = renderInviteCardDraft(Object.assign({}, opts, {
    placeImage: null,      // 右上角那張交給動畫層自己畫
    flap: t,               // 底圖那五隻鶴照原本的方式拍翅
    skyShiftX: opts.skyShiftX || 0,
    pixelScale: opts.pixelScale || 1,
  }));
  // renderInviteCardDraft 內部已經做過 ctx.scale(pixelScale) 而且沒有還原，
  // 取回來的是同一個 context，縮放已經在上面了 —— 這裡不能再 scale 一次，
  // 否則 pixelScale=2（複製到剪貼簿的高解析 PNG）會變成 4 倍，整個畫歪。
  const ctx = canvas.getContext("2d");
  drawReturnOverlay(ctx, photos, t, opts.skyShiftX || 0);
  return canvas;
}


/* ---------- 下面兩個是接進正式邀請流程用的 ---------- */

// 親苑的照片檔；TEMPLE_LIST 裡找不到對應那筆時就直接用這個路徑
const OYASONO_IMG = "temples/jp-oyasono.webp";

/* 挑出這張卡要用的五張照片：
     [你抽到的那間, 世界精舍1, 世界精舍2, 世界精舍3, 親苑]
   中間三張每次都重抽，而且刻意挑不同洲，所以每張邀請卡走過的路都不一樣。
   拿不到親苑的圖就回傳 null，讓呼叫端退回原本的靜態卡片。*/
async function pickReturnPhotos(placeImage, loadImage) {
  const load = loadImage || ((src) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  }));

  // 從棋盤格子的「邀朋友」進來時，最底下那張是你剛走到的精舍，再抽三間世界精舍疊上去。
  // 從左上角那顆按鈕進來時沒有「剛走到的那間」，就多抽一間來墊底，
  // 這樣兩個入口做出來的動畫層數完全一樣。
  const want = placeImage ? 3 : 4;

  let srcs = [];
  if (typeof TEMPLE_LIST !== "undefined" && Array.isArray(TEMPLE_LIST)) {
    const placeSrc = placeImage && placeImage.src ? placeImage.src : "";
    const pool = TEMPLE_LIST.filter((t) =>
      t.enabled !== false &&
      t.img &&
      t.kind !== "hq" &&              // 日本本部那一組是「原點」，不算走出去的世界
      !placeSrc.endsWith(t.img)       // 已經在最底下那張了，不要重複
    );
    // 一洲挑一間：先把同洲的洗牌後分組，再一輪一輪取，取到三間為止
    const byContinent = new Map();
    for (const t of pool.slice().sort(() => Math.random() - 0.5)) {
      const key = t.continent || "其他";
      if (!byContinent.has(key)) byContinent.set(key, []);
      byContinent.get(key).push(t);
    }
    const groups = [...byContinent.values()].sort(() => Math.random() - 0.5);
    // 再用國旗去重一次：資料裡夏威夷算大洋洲、內華達算北美洲，光看洲別擋不住
    // 同一張卡出現兩張美國照片，用國旗（拿不到就用國名）才擋得掉。
    const usedFlags = new Set();
    // 「你抽到的那一格」也要算進去：它的圖雖然被 placeSrc 擋掉了，但同一個國家
    // 可能有好幾間精舍（例如美國夏威夷有五間），不先把它的國旗記起來，
    // 路線就會出現「美國夏威夷 → 韓國 → 美國夏威夷」這種重複。
    if (placeImage && placeImage.src) {
      const here = TEMPLE_LIST.find((t) => t.img && placeImage.src.endsWith(t.img));
      if (here) usedFlags.add(here.flag || here.country || here.img);
    }
    for (let round = 0; srcs.length < want && round < 4; round++) {
      for (const g of groups) {
        if (srcs.length >= want) break;
        const t = g[round];
        if (!t) continue;
        const flag = t.flag || t.country || t.img;
        if (usedFlags.has(flag)) continue;
        usedFlags.add(flag);
        srcs.push(t.img);
      }
    }
  }

  const [world, home] = await Promise.all([
    Promise.all(srcs.map(load)),
    load(OYASONO_IMG),
  ]);
  if (!home) return null; // 沒有親苑就沒有「回到親苑」，退回原本的卡片
  const got = world.filter(Boolean);
  // 沒有地點照片時，多抽的那一間拿來當最底下那張
  const base = placeImage || got.pop() || null;
  return [base, ...got, home];
}

/* 把「回到親苑」做成 GIF。
   repeat:-1 ＝ 只播一次，所以播完就停在最後一幀，而最後一幀就是親苑 —— 不會跳回開頭。
   最後一幀另外給一段長停留，萬一遇到不理會 repeat 設定、硬要循環播的看圖程式，
   畫面也會有大半時間停在親苑上。
   檔案大小幾乎正比於「像素數 × 幀數」，所以瘦身就從這兩個地方下手（實測，同一張卡）：
     900×600 24幀 ≈ 3.7MB ／ 600×400 24幀 ≈ 2.0MB ／ 540×360 20幀 ≈ 1.4MB
   再往下 480×320 雖然只有 1.1MB，但卡片上「1/20(三)～1/24(日)」那行日期就糊掉了，
   所以 540×360 是保持小字還看得清的底線。
   幀數 24→20 的同時把每幀 150ms 拉長到 180ms，整段動畫長度維持原本約 3.4 秒，
   節奏不變，只是取樣點少了四個。
   編碼器參數（quality、globalPalette）實測最多只差 5%，又會拖慢編碼，所以不動。 */
async function buildReturnGif(opts, photos, { frames = 20, delayMs = 180, holdMs = 1500, width = 540, height = 360 } = {}) {
  if (typeof GIF !== "function") throw new Error("gif.js 沒有載入");
  const gif = new GIF({
    workers: 2,
    quality: 14,
    width,
    height,
    workerScript: "gif.worker.js",
    repeat: -1,
  });
  // 直接用輸出解析度畫每一幀，不要先畫 900×600 再縮小。
  // 以前是畫完整張再 drawImage 縮圖，那一步是會做平滑內插的重新取樣：
  // 文字會糊一層，卡片上的 QR 更是直接被抹平。改成原生描繪之後，
  // 字是照 540 寬去排版光柵化的（比縮圖銳利），QR 也能維持整數像素的模組寬度。
  const pixelScale = width / 900;
  for (let i = 0; i < frames; i++) {
    const last = i === frames - 1;
    // i/(frames-1) 讓最後一幀剛好落在 t=1，也就是完全定格的親苑
    const frame = renderReturnFrame(Object.assign({}, opts, { pixelScale }), photos, i / (frames - 1));
    gif.addFrame(frame, { delay: last ? holdMs : delayMs, copy: true });
    // 每畫完一幀讓出主執行緒，不要整段卡住、把使用者正在打的字吃掉
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve, reject) => {
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF 製作中斷")));
    gif.render();
  });
}
