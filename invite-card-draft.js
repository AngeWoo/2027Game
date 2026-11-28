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

// ?v=3：2026-11-28 整張圖換過（首頁網址、容錯 L、25×25、含 2 格留白），不帶版本號會吃到舊的快取
function loadInviteQrImage(src = "invite-qr.png?v=3") {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 圓角矩形路徑：用 arcTo 手刻，不依賴 ctx.roundRect（舊版 Safari 還沒有）
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderInviteCardDraft(opts = {}) {
  const {
    eyebrow = "誠摯邀請",
    title = "寒修行",
    tagline = "反省．充實．重整",
    body = "回望初心 重心出發 👣👣",
    // 開白／中願／結願三階段，寫法沿用官網 shinnyo-en.org.tw 當季公告
    // （只寫月/日和星期，不寫年份——跟官網那頁本身的寫法一致，年份交給下面的 yearLabel）
    //
    // 2026-11-26 更正：星期原本抄自 at2026 那一頁，是 2026 年的星期（1/20 是二、1/24 是六…），
    // 但這張卡講的是 2027 年的寒修行。2027/1/1 是星期五，重算後如下，別再改回去。
    schedule = [
      { phase: "開白", range: "1/20(三) 〜 24(日)" },
      { phase: "中願", range: "1/25(一) 〜 30(六)" },
      { phase: "結願", range: "1/31(日) 〜 2/4(四)" },
    ],
    seal = "敬邀",
    yearLabel = "2027寒修行",
    gameLabel = "真如世界大冒險 Going",
    cta = "歡迎參觀",
    titleFont = '"Long Cang"',
    titleImage = null, // 去背後的「寒修行」毛筆字圖檔（loadInviteTitleImage 的結果）
    qrImage = null, // 真正的 QR code 圖檔（loadInviteQrImage 的結果），沒給就畫占位框
    placeImage = null, // 從「今日實踐」小卡帶過來的當地照片，縮小貼在右上角；沒有就不畫
    personalNote = "", // 發送者自己打的話，放在印章上方的空白處
    personalName = "", // 發送者的名字，簽在那句話下面
    flap = 0, // 仙鶴拍翅膀的動畫進度（一圈＝1），GIF 每一幀給不同的值
    // 旭日和仙鶴整體往左（負值）或往右（正值）移幾 px。
    // 2026-11-26 定案 -55：動畫版的親苑落定後會放大，右上角需要空間，
    // 旭日和仙鶴往左讓開，順便讓「寒修行」題字壓在旭日上的構圖更集中。0 ＝ 以前的位置。
    skyShiftX = -55,
    pixelScale = 2, // 輸出解析度倍率；做 GIF 的每一幀用 1，省時間也省檔案大小
    canvas: reuseCanvas = null, // 給連續重畫的動畫用：傳一張固定的 canvas 進來重複使用，
                                // 不要每一幀都配置一張 900×600（在手機上會造成 GC 抖動）
  } = opts;

  // 指定 width/height 本身就會把 canvas 整個重設（含 transform），所以重用很安全
  const canvas = reuseCanvas || document.createElement("canvas");
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
  const sunX = 560 + skyShiftX, sunY = 150, sunR = 118;
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

  // ---------- 當地照片：像隨手別上去的一張小照片，貼在右上角，仙鶴從它前面飛過 ----------
  if (placeImage && placeImage.naturalWidth) {
    const photoW = 112, photoH = 82;
    const photoX = W - 72 - photoW;
    const photoY = 30;
    ctx.save();
    ctx.translate(photoX + photoW / 2, photoY + photoH / 2);
    ctx.rotate(Math.PI / 44); // 歪一點點，像剛別上去，不是印刷品
    ctx.translate(-photoW / 2, -photoH / 2);
    ctx.shadowColor = "rgba(46, 42, 38, 0.32)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#fdf8ee";
    roundRectPath(ctx, -4, -4, photoW + 8, photoH + 8, 9);
    ctx.fill();
    ctx.shadowColor = "transparent";
    roundRectPath(ctx, 0, 0, photoW, photoH, 7);
    ctx.save();
    ctx.clip();
    const scale = Math.max(photoW / placeImage.naturalWidth, photoH / placeImage.naturalHeight);
    const dw = placeImage.naturalWidth * scale, dh = placeImage.naturalHeight * scale;
    ctx.drawImage(placeImage, (photoW - dw) / 2, (photoH - dh) / 2, dw, dh);
    ctx.restore();
    ctx.restore();
  }

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
    crane(cx + skyShiftX, cy, scale, alpha, flap + phaseOffset);
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
  // 56 → 44：左下角要讓出 110px 給放大後的 QR，時間表整排往上挪 12px。
  const schedTop = bodyTop + (bodyLines.length - 1) * lineHeight + 44;
  const schedDateY = schedTop + 29;
  const schedColW = (W - textX * 2) / schedule.length;
  schedule.forEach((item, i) => {
    const segX = textX + i * schedColW;
    if (i > 0) {
      ctx.strokeStyle = "rgba(138, 90, 30, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(segX - 20, schedTop - 22);
      ctx.lineTo(segX - 20, schedDateY + 10);
      ctx.stroke();
    }
    ctx.fillStyle = goldDeep;
    ctx.font = `bold 22px ${sans}`;
    ctx.fillText(item.phase, segX, schedTop);
    ctx.fillStyle = "#4a3f33";
    ctx.font = `19px ${sans}`;
    ctx.fillText(item.range, segX, schedDateY);
  });

  // ---------- 印章（敬邀）：沿用明信片雙圈郵戳的做法，改暖色 ----------
  ctx.save();
  ctx.translate(812, (bodyTop + schedDateY) / 2 + 6);
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

  /* QR 從右下角那顆 58px，換成左下角這一塊。
     原本那顆根本掃不出來：縮到 540 寬的 GIF 之後只剩 0.85 像素／模組——
     模組比一個像素還小，重新取樣時直接被抹平，等於畫了一個長得像 QR 的裝飾。
     搬到左下角是因為右下角被「敬邀」印章佔住（圓心 812、半徑 58），放不下。

     invite-qr.png 指向真如苑首頁，不是某一年的活動頁：
     寒修行每年換網址（2026 是 at2026/index2026.html），但邀請卡是寄給別人的，
     寄出去就改不掉了。指到首頁就不會有哪一年的頁面下架之後收卡的人掃到 404 的問題。
     首頁網址短，格數也只要 25×25（容錯 L），左右各 2 格留白畫進圖裡，所以整張圖 29 格寬。 */
  const QR_CELLS = 29; // invite-qr.png 的總格數（25 格資料 + 左右各 2 格留白）
  const qrBox = 110;   // 左下角塞得下的上限：上面讓開時間表，下面壓到海浪紋上緣
  const qrX = textX;
  const qrY = footerY - 92;

  /* 每個模組在輸出解析度上至少要有 2 個像素，不然重新取樣會把模組吃掉。
     目前三種 pixelScale 都過得了這條線（GIF 的 0.6 是 2.28、預覽的 1 和 2 更寬鬆），
     所以一律照 qrBox 畫滿，預覽和 GIF 的構圖也就一模一樣。
     真的低於 2 的話（例如之後又把 GIF 調更小）才退而求其次：
     吸附成整數的每模組像素。imageSmoothingEnabled=false 是最近鄰取樣，
     模組寬度除不盡時會變成有的 2px、有的 1px，那種寬窄不一在像素很少時才會出問題。
     （2.28 這個值是實測過的：從產出的 GIF 裡把 QR 裁下來，網址完整解得回來。） */
  const rawPerModule = (qrBox * pixelScale) / QR_CELLS;
  const qrPerModule = rawPerModule >= 2 ? rawPerModule : Math.max(1, Math.round(rawPerModule));
  const qrSize = (qrPerModule * QR_CELLS) / pixelScale;
  const infoX = qrX + qrSize + 26; // 年份和遊戲名讓到 QR 右邊

  ctx.strokeStyle = "rgba(243, 199, 107, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(infoX, footerY - 36);
  ctx.lineTo(W - 72, footerY - 36);
  ctx.stroke();

  // 「歡迎參觀」靠左（緊接著 QR，一眼看得出是在說那個 QR），
  // 年份和遊戲名靠右收尾。基線取兩行文字的視覺中線，單獨一行才不會看起來偏高或偏低。
  ctx.fillStyle = goldLight;
  ctx.font = `bold 16px ${sans}`;
  ctx.fillText(cta, infoX, footerY - 2);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(243, 199, 107, 0.85)";
  ctx.font = `13px ${sans}`;
  ctx.fillText(yearLabel, W - 72, footerY - 14);
  ctx.fillStyle = "#fdf8ee";
  ctx.font = `bold 18px ${sans}`;
  ctx.fillText(gameLabel, W - 72, footerY + 10);
  ctx.textAlign = "left";

  // QR code
  if (qrImage && qrImage.naturalWidth) {
    // 位置也對齊到輸出的像素格，不然整張圖落在半個像素上，一樣會被重新取樣糊掉
    const dx = Math.round(qrX * pixelScale) / pixelScale;
    const dy = Math.round(qrY * pixelScale) / pixelScale;
    const pad = 7;
    ctx.fillStyle = "#fdf8ee";
    ctx.fillRect(dx - pad, dy - pad, qrSize + pad * 2, qrSize + pad * 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false; // 模組邊緣要銳利，不能讓瀏覽器做平滑內插
    ctx.drawImage(qrImage, dx, dy, qrSize, qrSize);
    ctx.restore();
    ctx.strokeStyle = "rgba(253, 248, 238, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dx - pad, dy - pad, qrSize + pad * 2, qrSize + pad * 2);
  } else {
    ctx.strokeStyle = "rgba(253, 248, 238, 0.75)";
    ctx.lineWidth = 2;
    const corner = 16;
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
    ctx.font = `13px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText("QR", qrX + qrSize / 2, qrY + qrSize / 2 + 5);
    ctx.textAlign = "left";
  }

  return canvas;
}

/* 把邀請卡做成會動的 GIF（仙鶴拍翅膀）。
   用 gif.js（vendor 進這個資料夾的 gif.js / gif.worker.js，離線也能跑）在背景執行緒編碼，
   每一幀都是 renderInviteCardDraft 再畫一次、只有 flap 不一樣，所以預覽動畫和匯出的 GIF
   長得保證一樣。幀數故意不多、解析度用 1 倍——GIF 本來就不追求銳利，優先顧編碼速度和檔案大小。

   每畫完一幀都用 setTimeout(0) 讓出主執行緒一下，不要 8 幀連著畫、整段把主執行緒佔住——
   這段如果連續卡住一兩百毫秒，使用者剛好在這段時間打字（尤其是用注音／拼音選字）
   就會被打斷，嚴重時輸入法會把還沒選定、甚至剛選定的字弄丟。

   輸出 540×360（跟「回到親苑」那支 GIF 同尺寸）：實測 1022KB → 363KB，
   小字（日期那行）在 540 寬還看得清楚。
   注意是直接用 pixelScale=0.6 原生畫在 540×360 上，不是畫完 900×600 再縮——
   縮圖那一步會做平滑內插，字糊一層，卡片上的 QR 更是會被抹平到掃不出來。 */
async function buildInviteGif(opts = {}, { frames = 6, delayMs = 130, width = 540, height = 360 } = {}) {
  if (typeof GIF !== "function") throw new Error("gif.js 沒有載入");
  const gif = new GIF({
    workers: 2,
    quality: 14,
    width,
    height,
    workerScript: "gif.worker.js",
    repeat: 0, // 不停循環
  });
  const pixelScale = width / 900;
  for (let i = 0; i < frames; i++) {
    const canvas = renderInviteCardDraft({ ...opts, pixelScale, flap: i / frames });
    gif.addFrame(canvas, { delay: delayMs, copy: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve, reject) => {
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF 製作中斷")));
    gif.render();
  });
}
