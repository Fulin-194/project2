// main.js
import { WaveField } from "./wave.js";
import { HandTracker } from "./hand.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

let W = 0, H = 0, DPR = 1;
const waveField = new WaveField(24);
const pointer = { x: 0, y: 0, visible: false };
let trackerActive = false;

// 创建一个隐藏的预览视频框，方便你看自己的手
const videoPreview = document.createElement("video");
videoPreview.style.cssText = "position:fixed; bottom:20px; right:20px; width:160px; height:120px; border-radius:8px; transform: scaleX(-1); border: 2px solid #f4efe4; opacity: 0.8; z-index: 100; display: none; pointer-events: none;";
document.body.appendChild(videoPreview);

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

function spawnAt(nx, ny) {
  const x = nx * W, y = ny * H;
  const yy = Math.max(H * 0.5, Math.min(H - 20, y));
  waveField.add(x, yy, 0.7 + Math.random() * 0.5);
}

let lastTime = 0;
function loop(now) {
  const dt = Math.min(50, now - lastTime || 16);
  lastTime = now;

  ctx.clearRect(0, 0, W, H);
  waveField.update(dt);
  waveField.draw(ctx, now);

  if (pointer.visible) {
    ctx.beginPath(); 
    ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244,239,228,0.22)"; 
    ctx.fill();
    ctx.strokeStyle = "rgba(244,239,228,0.75)"; 
    ctx.lineWidth = 1.5; 
    ctx.stroke();
  }
  requestAnimationFrame(loop);
}

// 鼠标交互
canvas.addEventListener("pointermove", (e) => {
  if (trackerActive) return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.visible = true;
});
canvas.addEventListener("pointerleave", () => {
  if (trackerActive) return;
  pointer.visible = false;
});
canvas.addEventListener("pointerdown", (e) => spawnAt(e.clientX / W, e.clientY / H));

// 摄像头交互
const tracker = new HandTracker({
  onStatus: (s) => { statusEl.textContent = s; },
  onMove: ({ x, y }) => {
    trackerActive = true; 
    pointer.x = x * W; 
    pointer.y = y * H; 
    pointer.visible = true;
  },
  onOpenPalm: ({ x, y }) => {
    trackerActive = true; 
    spawnAt(x, y);
    pointer.x = x * W; pointer.y = y * H; pointer.visible = true;
    statusEl.textContent = "🌊 浪花生成！";
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => { statusEl.textContent = "手部追踪中...张开手掌！"; }, 800);
  },
  // 新增一个调试回调，实时告诉你识别到了什么
  onDebug: (msg) => {
    statusEl.textContent = msg;
  }
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  try {
    await tracker.start();
    startBtn.textContent = "摄像头运行中";
    
    // 把摄像头画面传给右下角小窗
    if (tracker.video) {
      videoPreview.srcObject = tracker.video.srcObject;
      videoPreview.play();
      videoPreview.style.display = "block";
    }
  } catch (err) {
    console.error("摄像头或模型加载失败：", err);
    statusEl.textContent = "加载失败，请检查控制台 (F12) 或网络！已切换鼠标模式。";
    startBtn.textContent = "摄像头不可用";
    trackerActive = false;
  }
});

resize();
requestAnimationFrame(loop);