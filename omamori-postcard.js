// 以 900 × 600 排版，再用兩倍解析度輸出明信片。
function renderOmamoriPostcard(image, word, note) {
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.scale(2, 2);

  const paper = ctx.createLinearGradient(0, 0, 900, 600);
  paper.addColorStop(0, "#fffdf6");
  paper.addColorStop(1, "#f7f0e2");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 900, 600);

  drawPostcardPostalMarks(ctx);

  const scale = Math.min(274 / image.naturalWidth, 348 / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.shadowColor = "rgba(83, 56, 34, 0.22)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(image, 224 - width / 2, 282 - height / 2, width, height);
  ctx.restore();

  const serif = '"Noto Serif TC", "Songti TC", PMingLiU, "Microsoft JhengHei", serif';
  const sans = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  const textX = 383;
  const textRight = 815;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#28546a";
  ctx.font = `bold 36px ${serif}`;
  ctx.fillText("今日御守", textX, 160);
  ctx.fillStyle = "#83aeba";
  ctx.fillRect(textX, 192, 45, 2);

  if (word) {
    ctx.font = `25px ${serif}`;
    ctx.fillStyle = "#283e47";
    const lines = wrapPostcardQuote(ctx, word.text, textRight - textX);
    const lineHeight = 40;
    const top = 299 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, textX, top + i * lineHeight));

    ctx.font = `bold 17px ${sans}`;
    ctx.fillStyle = "#38657a";
    ctx.textAlign = "right";
    ctx.fillText(`—— ${word.by}`, textRight, top + (lines.length - 1) * lineHeight + 51);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(77, 123, 143, 0.25)";
  ctx.fillRect(91, 521, 724, 1);
  ctx.fillStyle = "#38657a";
  ctx.font = `bold 17px ${sans}`;
  ctx.fillText("真如世界大冒險·GO", 91, 552);
  ctx.font = `16px ${sans}`;
  ctx.fillText(note, textX, 552);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function wrapPostcardQuote(ctx, text, width) {
  // 把開頭及結尾標點和相鄰的字一起測量，避免標點落在錯誤的行首或行尾。
  const units = text.match(/[「『（《〈【]*.[，。！？、；：」』）》〉】]*/gu) || [];
  const lines = [];
  let line = "";
  for (const unit of units) {
    if (line && ctx.measureText(line + unit).width > width) {
      lines.push(line);
      line = "";
    }
    line += unit;
  }
  if (line) lines.push(line);
  return lines;
}

function drawPostcardPostalMarks(ctx) {
  ctx.strokeStyle = "#7595a9";
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 7; i++) {
    ctx.strokeRect(91 + i * 30 + (i < 3 ? 0 : 6), 48, 24, 34);
  }
  ctx.fillStyle = "#7595a9";
  ctx.fillRect(175, 64.5, 12, 1.25);

  // 藍色漩渦和水紋取自參考明信片的構圖。
  ctx.lineCap = "round";
  const stampInk = ctx.createLinearGradient(731, 43, 820, 108);
  stampInk.addColorStop(0, "rgba(76, 149, 178, 0.54)");
  stampInk.addColorStop(1, "rgba(76, 149, 178, 0.13)");
  ctx.strokeStyle = stampInk;
  ctx.lineWidth = 5.5;
  ctx.stroke(new Path2D("M 750 103 C 728 89 735 66 751 54 C 775 37 807 44 819 66 C 829 88 806 104 787 109 C 768 114 750 110 743 102"));
  ctx.strokeStyle = "rgba(62, 147, 180, 0.44)";
  ctx.lineWidth = 9;
  ctx.stroke(new Path2D("M 769 98 C 788 100 807 88 803 73 C 799 62 779 60 772 71 C 765 82 779 89 786 81 C 791 76 787 73 781 75"));
  ctx.strokeStyle = "rgba(43, 100, 155, 0.58)";
  ctx.lineWidth = 3.5;
  ctx.stroke(new Path2D("M 776 76 Q 786 69 792 78"));

  const waveInk = ctx.createLinearGradient(102, 0, 350, 0);
  waveInk.addColorStop(0, "rgba(53, 138, 177, 0.52)");
  waveInk.addColorStop(0.56, "rgba(76, 149, 178, 0.46)");
  waveInk.addColorStop(1, "rgba(76, 149, 178, 0)");
  ctx.fillStyle = waveInk;
  ctx.fill(new Path2D("M 98 478 C 115 477 123 480 135 467 C 147 454 160 453 173 464 C 190 480 205 483 221 480 C 196 495 180 479 166 478 C 154 477 150 493 139 489 C 129 486 132 480 126 479 Z"));
  ctx.strokeStyle = waveInk;
  ctx.lineWidth = 4;
  ctx.stroke(new Path2D("M 198 478 C 207 466 225 466 241 474 C 253 481 266 481 280 475 C 264 474 261 463 274 463 C 301 462 309 487 349 476"));
  ctx.lineWidth = 1.5;
  ctx.stroke(new Path2D("M 158 486 C 181 484 184 496 212 489 M 275 486 C 295 478 308 492 335 485"));
  ctx.fillStyle = "rgba(53, 138, 177, 0.36)";
  for (const [x, y, r] of [[137, 452, 2.4], [128, 447, 1.6], [144, 442, 1.3]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
