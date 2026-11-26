/* 「回到親苑」動畫草稿頁的驅動程式 —— 只是提案用的展示頁，不是正式流程的一部分。
   這個檔不能寫成 inline script：/2027Game/ 的 CSP 是 script-src 'self'，
   寫在 HTML 裡的 <script> 會被擋掉（invite-card-preview.html 就是這樣，本機打不開）。*/

// 示範用的照片：第一張當成「你抽到的那間精舍」，中間三張代表走過的世界各地，最後一張一定是親苑
const DEMO_PHOTOS = [
  { src: "temples/hk-hongkong.webp", label: "你抽到的那間（香港精舍）" },
  { src: "temples/br-saopaulo.webp", label: "南美・聖保羅" },
  { src: "temples/ke-nairobi.webp", label: "非洲・奈洛比" },
  { src: "temples/fr-paris.webp", label: "歐洲・巴黎" },
  { src: "temples/jp-oyasono.webp", label: "原點：回歸親苑" },
];

const CARD_OPTS_BASE = {
  personalNote: "一起走這一趟吧",
  personalName: "阿角",
  skyShiftX: -55, // 旭日和仙鶴往左挪，空間讓給放大後的親苑；0 ＝ 正式卡片原本的位置
};

const LOOP_MS = 3600; // 一圈的長度
const BOARD = [
  [0.02, "起", "右上角是你抽到的那間精舍，跟現在的卡片一模一樣"],
  [0.14, "行", "第一張世界精舍從右邊飛進來，身後拖一條淡金色航跡"],
  [0.36, "行", "第二、三張分別從下面和左邊飛來，疊成一小疊"],
  [0.52, "歸", "最後一張「親苑」從旭日裡浮出來，往相片框飛"],
  [0.70, "放", "親苑放大到 1.55 倍、相框轉金、金色光環擴散、走過的幾張往左下散開"],
  [0.92, "停", "動畫停在親苑，框下是「原點：回歸親苑」，不會再跳回開頭"],
];

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

(async () => {
  const [titleImage, qrImage] = await Promise.all([loadInviteTitleImage(), loadInviteQrImage()]);
  const photos = await Promise.all(DEMO_PHOTOS.map((p) => loadImg(p.src)));
  const opts = Object.assign({ titleImage, qrImage }, CARD_OPTS_BASE);

  // ---------- 主畫面：循環播放 ----------
  const anim = document.getElementById("anim");
  const actx = anim.getContext("2d");
  const playBtn = document.getElementById("playBtn");
  const scrub = document.getElementById("scrub");
  const tcode = document.getElementById("tcode");
  const sky = document.getElementById("sky");
  const skycode = document.getElementById("skycode");
  const skyReset = document.getElementById("skyReset");

  let playing = true;
  let t = 0;
  let last = performance.now();

  function paint(at) {
    const frame = renderReturnFrame(opts, photos, at);
    actx.clearRect(0, 0, anim.width, anim.height);
    actx.drawImage(frame, 0, 0);
    tcode.textContent = "t = " + at.toFixed(3);
  }

  function tick(now) {
    if (playing) {
      t = (t + (now - last) / LOOP_MS) % 1;
      scrub.value = String(Math.round(t * 999));
      paint(t);
    }
    last = now;
    requestAnimationFrame(tick);
  }

  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "⏸ 暫停" : "▶ 播放";
  });
  scrub.addEventListener("input", () => {
    playing = false;
    playBtn.textContent = "▶ 播放";
    t = Number(scrub.value) / 999;
    paint(t);
  });

  function applySky() {
    opts.skyShiftX = Number(sky.value);
    skycode.textContent = sky.value + " px";
    paint(t);
  }
  sky.addEventListener("input", applySky);
  sky.addEventListener("change", () => { applySky(); drawBoard(); });
  skyReset.addEventListener("click", () => { sky.value = "0"; applySky(); drawBoard(); });

  paint(0);
  requestAnimationFrame(tick);

  // ---------- 分鏡：六個關鍵時間點各畫一張 ----------
  const board = document.getElementById("board");
  function drawBoard() {
    board.replaceChildren();
    BOARD.forEach(([at, phase, desc]) => {
      const frame = renderReturnFrame(opts, photos, at);
      const cell = document.createElement("div");
      cell.className = "shot";
      const small = document.createElement("canvas");
      small.width = 580;
      small.height = 387;
      small.getContext("2d").drawImage(frame, 0, 0, 580, 387);
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.innerHTML = "<b>" + phase + "　t=" + at.toFixed(2) + "</b><br>" + desc;
      cell.appendChild(small);
      cell.appendChild(cap);
      board.appendChild(cell);
    });
  }
  drawBoard();

  // ---------- GIF 大小實測 ----------
  const sizeBtn = document.getElementById("sizeBtn");
  const sizeOut = document.getElementById("sizeOut");

  function encodeGif(frames, width, height, delayMs) {
    return new Promise((resolve, reject) => {
      const gif = new GIF({ workers: 2, quality: 14, width, height, workerScript: "gif.worker.js", repeat: -1 });
      let i = 0;
      (function addNext() {
        if (i >= frames) {
          gif.on("finished", (blob) => resolve(blob));
          gif.on("abort", () => reject(new Error("中斷")));
          gif.render();
          return;
        }
        const full = renderReturnFrame(opts, photos, i / frames);
        let frame = full;
        if (width !== 900) {
          const sc = document.createElement("canvas");
          sc.width = width;
          sc.height = height;
          sc.getContext("2d").drawImage(full, 0, 0, width, height);
          frame = sc;
        }
        gif.addFrame(frame, { delay: delayMs, copy: true });
        i++;
        setTimeout(addNext, 0); // 讓出主執行緒，不要一口氣佔住
      })();
    });
  }

  const CASES = [
    { label: "太少幀對照：6 幀 / 900×600（動作會跳）", frames: 6, w: 900, h: 600, delay: 130 },
    { label: "完整動畫：24 幀 / 900×600", frames: 24, w: 900, h: 600, delay: 150 },
    { label: "完整動畫：24 幀 / 600×400", frames: 24, w: 600, h: 400, delay: 150 },
    { label: "精簡版：  16 幀 / 600×400", frames: 16, w: 600, h: 400, delay: 225 },
  ];

  sizeBtn.addEventListener("click", async () => {
    sizeBtn.disabled = true;
    sizeOut.textContent = "";
    for (const c of CASES) {
      sizeOut.textContent += c.label + " … 編碼中\n";
      const t0 = performance.now();
      try {
        const blob = await encodeGif(c.frames, c.w, c.h, c.delay);
        const secs = ((performance.now() - t0) / 1000).toFixed(1);
        const mb = (blob.size / 1048576).toFixed(2);
        sizeOut.textContent = sizeOut.textContent.replace(c.label + " … 編碼中\n",
          c.label + " → " + mb + " MB（編碼 " + secs + " 秒，動畫長 " + (c.frames * c.delay / 1000).toFixed(1) + " 秒）\n");
      } catch (e) {
        sizeOut.textContent = sizeOut.textContent.replace(c.label + " … 編碼中\n", c.label + " → 失敗：" + e.message + "\n");
      }
    }
    sizeBtn.disabled = false;
    sizeBtn.textContent = "⏱ 再測一次";
  });
})();
