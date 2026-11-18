/* 邀請卡草稿 —— 參考 shinnyo-en.org.tw/at2026 的燙金山景／旭日／仙鶴／海浪，
   版型沿用明信片 900×600 的尺寸和「標題＋內文＋印章＋底部資訊列」結構，
   顏色改成暖金，和明信片原本的藍色郵戳調性做出區隔。
   這是草稿專用檔，正式明信片（omamori-postcard.js）完全沒有被改動。

   標題「寒修行」原本想用毛筆字體，但使用者附的參考圖是書法家手寫的客製字，
   找不到對應字體，所以改成直接把那張圖去背（見 invite-title-hanshugyo.png，
   由 invite-card-preview.html 裡的工具產生），當成一張透明背景的圖檔疊上去。 */

function loadInviteTitleImage(src = "invite-title-hanshugyo.png") {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadInviteQrImage(src = "invite-qr.png") {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function renderInviteCardDraft(opts = {}) {
  const {
    eyebrow = "誠摯邀請",
    title = "寒修行",
    tagline = "反省．充實．重整",
    body = "一起沉澱初心 重新出發 👣👣",
    // 開白／中願／結願三階段，日期沿用官網 shinnyo-en.org.tw/at2026 當季公告的寫法
    // （只寫月/日和星期，不寫年份——跟官網那頁本身的寫法一致，年份交給下面的 yearLabel）
    schedule = [
      { phase: "開白", range: "1/20(二) 〜 24(六)" },
      { phase: "中願", range: "1/25(日) 〜 30(五)" },
      { phase: "結願", range: "1/31(六) 〜 2/4(三)" },
    ],
    seal = "敬邀",
    yearLabel = "2027寒修行",
    gameLabel = "真如世界大冒險・GO",
    cta = "歡迎參觀",
    titleFont = '"Long Cang"',
    titleImage = null, // 去背後的「寒修行」毛筆字圖檔（loadInviteTitleImage 的結果）
    qrImage = null, // 真正的 QR code 圖檔（loadInviteQrImage 的結果），沒給就畫占位框
    personalNote = "", // 發送者自己打的話，放在印章上方的空白處
    personalName = "", // 發送者的名字，簽在那句話下面
    flap = 0, // 仙鶴拍翅膀的動畫進度（一圈＝1），GIF 每一幀給不同的值
    pixelScale = 2, // 輸出解析度倍率；做 GIF 的每一幀用 1，省時間也省檔案大小
  } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = 900 * pixelScale;
  canvas.height = 600 * pixelScale;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.scale(pixelScale, pixelScale);

  const serif = '"Noto Serif TC", "Songti TC", PMingLiU, "Microsoft JhengHei", serif';
  const sans = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

  const W = 900, H = 600;
  const ink = "#2e2a26";
  const gold = "#c8962e";
  const goldLight = "#f3c76b";
  const goldDeep = "#8a5a1e";

  // ---------- 底色：暖米色紙 ----------
  const paper = ctx.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, "#fdf8ee");
  paper.addColorStop(1, "#f5ead4");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  // ---------- 旭日（放題字右上方當背光）----------
  ctx.save();
  const sunX = 560, sunY = 150, sunR = 118;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 1.6);
  sunGlow.addColorStop(0, "rgba(243, 199, 107, 0.55)");
  sunGlow.addColorStop(1, "rgba(243, 199, 107, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - sunR * 1.6, sunY - sunR * 1.6, sunR * 3.2, sunR * 3.2);
  const sun = ctx.createRadialGradient(sunX - 30, sunY - 30, 10, sunX, sunY, sunR);
  sun.addColorStop(0, goldLight);
  sun.addColorStop(1, gold);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---------- 仙鶴（簡筆，兩隻，翅膀會拍）----------
  // wingPhase 0→1 是一整圈拍翅：sin 讓翅尖和翅膀頂點一起上下擺，看起來才像飛
  function crane(cx, cy, scale, alpha, wingPhase) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.strokeStyle = `rgba(46, 42, 38, ${alpha})`;
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
    ctx.beginPath();
    ctx.moveTo(4, 22);
    ctx.lineTo(1, 30);
    ctx.moveTo(4, 22);
    ctx.lineTo(8, 29);
    ctx.stroke();
    ctx.restore();
  }
  // 五隻鶴飛過旭日：位置故意不排整齊、大小忽大忽小、拍翅節奏也錯開，
  // 看起來才像一群各自飛的鶴，不是同一隻複製貼上的等差排列。
  const flock = [
    [612, 48, 0.92, 0.55, 0],
    [668, 86, 0.58, 0.36, 0.22],
    [705, 58, 1.02, 0.5, 0.08],
    [780, 120, 0.48, 0.26, 0.52],
    [824, 90, 0.74, 0.4, 0.37],
  ];
  for (const [cx, cy, scale, alpha, phaseOffset] of flock) {
    crane(cx, cy, scale, alpha, flap + phaseOffset);
  }

  // ---------- 底部山景色帶：只佔最下面一小段，當資訊列的底紙 ----------
  const bandTop = 478; // 山脊最高點，留出上面大半張卡給標題、邀請詞和時間表
  ctx.save();
  const mtn = new Path2D(
    `M 0 ${H} L 0 515 L 90 484 L 180 510 L 270 ${bandTop} L 360 508 L 450 490 L ${W} 516 L ${W} ${H} Z`
  );
  ctx.fillStyle = "#2b2b33";
  ctx.fill(mtn);
  ctx.strokeStyle = "rgba(243, 199, 107, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.stroke(mtn);
  ctx.restore();

  // ---------- 色帶最下緣的海浪紋（青海波，呼應官網與明信片的水紋）----------
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H - 22, W, 22);
  ctx.clip();
  ctx.strokeStyle = "rgba(243, 199, 107, 0.3)";
  ctx.lineWidth = 1.4;
  const waveRows = [[H - 2, 22], [H + 12, 22]];
  for (const [cy, r] of waveRows) {
    for (let cx = -r; cx < W + r * 2; cx += r) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.stroke();
    }
  }
  ctx.restore();

  // ---------- 標題區：eyebrow ／ 寒修行 ／ tagline ----------
  const textX = 72;
  ctx.fillStyle = goldDeep;
  ctx.font = `bold 20px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "6px";
  ctx.fillText(eyebrow, textX, 66);
  ctx.letterSpacing = "0px";

  let titleBottom;
  if (titleImage && titleImage.naturalWidth) {
    // 去背過的毛筆字圖，疊在旭日上——保留參考圖裡「字蓋在太陽上」的構圖
    const titleH = 220;
    const titleW = titleH * (titleImage.naturalWidth / titleImage.naturalHeight);
    const titleTop = 64;
    ctx.drawImage(titleImage, textX - 14, titleTop, titleW, titleH);
    titleBottom = titleTop + titleH;
  } else {
    ctx.fillStyle = ink;
    ctx.font = `130px ${titleFont}, ${serif}`;
    ctx.fillText(title, textX - 10, 246);
    titleBottom = 256;
  }

  ctx.fillStyle = gold;
  ctx.fillRect(textX, titleBottom + 8, 150, 4);

  ctx.fillStyle = "#6b5636";
  ctx.font = `15px ${sans}`;
  ctx.letterSpacing = "4px";
  ctx.fillText(tagline, textX, titleBottom + 40);
  ctx.letterSpacing = "0px";

  // ---------- 發送者留言：寫在印章上方那塊空白（旭日、仙鶴下面，印章上面）----------
  // 字數在限制內最多排兩行；真的排不下才截斷加「…」（正常輸入長度不會發生）。
  function wrapLines(text, font, maxWidth, maxLines) {
    ctx.font = font;
    // 標點不開頭：」』）的這類收尾符號寧可讓上一行稍微超寬，也不要自己落單開新行
    const noLineStart = "」』）】》〉，。！？、；：”’";
    const lines = [];
    let line = "";
    for (const ch of text) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth && !noLineStart.includes(ch)) {
        lines.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }
  function fitOneLine(text, font, maxWidth) {
    return wrapLines(text, font, maxWidth, 1)[0];
  }
  if (personalNote || personalName) {
    const noteRight = W - 72;
    const noteMaxWidth = 380;
    const noteColor = "rgba(168, 54, 44, 0.9)"; // 給對方的話／名字共用同一個紅色粗體
    const noteFont = `bold italic 24px ${serif}`;
    const nameFont = `bold 18px ${sans}`;
    const noteLineH = 30;
    ctx.textAlign = "right";

    // 由印章上緣往上排版：字少就貼著印章，字多（最多兩行）就自然往上長，
    // 需要的話疊到旭日上也沒關係——優先顧好字能完整顯示，不要被截斷。
    let y = 352;
    if (personalName) {
      ctx.font = nameFont;
      ctx.fillStyle = noteColor;
      ctx.fillText(fitOneLine(`—— ${personalName}`, nameFont, noteMaxWidth), noteRight, y);
      y -= 34;
    }
    if (personalNote) {
      const noteLines = wrapLines(`「${personalNote}」`, noteFont, noteMaxWidth, 2);
      ctx.font = noteFont;
      ctx.fillStyle = noteColor;
      for (let i = noteLines.length - 1; i >= 0; i--) {
        ctx.fillText(noteLines[i], noteRight, y);
        y -= noteLineH;
      }
    }
    ctx.textAlign = "left";
  }

  // ---------- 內文（邀請詞）----------
  ctx.fillStyle = "#3a332a";
  ctx.font = `bold 36px ${serif}`;
  const bodyLines = body.split("\n");
  const lineHeight = 42;
  const bodyTop = titleBottom + 94;
  bodyLines.forEach((line, i) => ctx.fillText(line, textX, bodyTop + i * lineHeight));

  // ---------- 時間表：開白／中願／結願，橫排三段，中間用細線隔開 ----------
  const schedTop = bodyTop + (bodyLines.length - 1) * lineHeight + 56;
  const schedDateY = schedTop + 24;
  const schedColW = (W - textX * 2) / schedule.length;
  schedule.forEach((item, i) => {
    const segX = textX + i * schedColW;
    if (i > 0) {
      ctx.strokeStyle = "rgba(138, 90, 30, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(segX - 20, schedTop - 18);
      ctx.lineTo(segX - 20, schedDateY + 8);
      ctx.stroke();
    }
    ctx.fillStyle = goldDeep;
    ctx.font = `bold 17px ${sans}`;
    ctx.fillText(item.phase, segX, schedTop);
    ctx.fillStyle = "#4a3f33";
    ctx.font = `15px ${sans}`;
    ctx.fillText(item.range, segX, schedDateY);
  });

  // ---------- 印章（敬邀）：沿用明信片雙圈郵戳的做法，改暖色 ----------
  ctx.save();
  ctx.translate(770, (bodyTop + schedDateY) / 2 + 6);
  ctx.rotate(-Math.PI / 24);
  ctx.strokeStyle = "rgba(168, 54, 44, 0.82)";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.4;
  for (const r of [58, 54]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 34px ${serif}`;
  if (seal.length <= 2) {
    ctx.fillText(seal, 0, 2);
  } else {
    ctx.font = `bold 22px ${serif}`;
    ctx.fillText(seal.slice(0, Math.ceil(seal.length / 2)), 0, -14);
    ctx.fillText(seal.slice(Math.ceil(seal.length / 2)), 0, 16);
  }
  ctx.textAlign = "left";
  ctx.restore();

  // ---------- 底部資訊列 ----------
  const footerY = 558;
  ctx.strokeStyle = "rgba(243, 199, 107, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, footerY - 36);
  ctx.lineTo(W - 72, footerY - 36);
  ctx.stroke();

  ctx.fillStyle = "rgba(243, 199, 107, 0.85)";
  ctx.font = `13px ${sans}`;
  ctx.fillText(yearLabel, textX, footerY - 14);
  ctx.fillStyle = "#fdf8ee";
  ctx.font = `bold 18px ${sans}`;
  ctx.fillText(gameLabel, textX, footerY + 10);

  // CTA ＋ QR code
  const qrSize = 58;
  const qrX = W - 72 - qrSize;
  const qrY = footerY - 30;
  if (qrImage && qrImage.naturalWidth) {
    ctx.fillStyle = "#fdf8ee";
    ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
    ctx.save();
    ctx.imageSmoothingEnabled = false; // 原圖是 400×400，縮小時保持模組邊緣銳利，才掃得到
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.restore();
    ctx.strokeStyle = "rgba(253, 248, 238, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
  } else {
    ctx.strokeStyle = "rgba(253, 248, 238, 0.75)";
    ctx.lineWidth = 2;
    const corner = 10;
    for (const [cx, cy, dx, dy] of [
      [qrX, qrY, 1, 1],
      [qrX + qrSize, qrY, -1, 1],
      [qrX, qrY + qrSize, 1, -1],
      [qrX + qrSize, qrY + qrSize, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + corner * dy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + corner * dx, cy);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(253, 248, 238, 0.6)";
    ctx.font = `11px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText("QR", qrX + qrSize / 2, qrY + qrSize / 2 + 4);
    ctx.textAlign = "left";
  }
  ctx.textAlign = "right";
  ctx.fillStyle = goldLight;
  ctx.font = `bold 16px ${sans}`;
  ctx.fillText(cta, qrX - 14, footerY + 2);
  ctx.textAlign = "left";

  return canvas;
}

/* 把邀請卡做成會動的 GIF（仙鶴拍翅膀）。
   用 gif.js（vendor 進這個資料夾的 gif.js / gif.worker.js，離線也能跑）在背景執行緒編碼，
   每一幀都是 renderInviteCardDraft 再畫一次、只有 flap 不一樣，所以預覽動畫和匯出的 GIF
   長得保證一樣。幀數故意不多、解析度用 1 倍——GIF 本來就不追求銳利，優先顧編碼速度和檔案大小。

   每畫完一幀都用 setTimeout(0) 讓出主執行緒一下，不要 8 幀連著畫、整段把主執行緒佔住——
   這段如果連續卡住一兩百毫秒，使用者剛好在這段時間打字（尤其是用注音／拼音選字）
   就會被打斷，嚴重時輸入法會把還沒選定、甚至剛選定的字弄丟。 */
async function buildInviteGif(opts = {}, { frames = 6, delayMs = 130 } = {}) {
  if (typeof GIF !== "function") throw new Error("gif.js 沒有載入");
  const gif = new GIF({
    workers: 2,
    quality: 14,
    width: 900,
    height: 600,
    workerScript: "gif.worker.js",
    repeat: 0, // 不停循環
  });
  for (let i = 0; i < frames; i++) {
    const canvas = renderInviteCardDraft({ ...opts, pixelScale: 1, flap: i / frames });
    gif.addFrame(canvas, { delay: delayMs, copy: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve, reject) => {
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF 製作中斷")));
    gif.render();
  });
}
