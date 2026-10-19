// handTracking.js
// 负责：摄像头开启、MediaPipe 手部识别、手势判定，输出「张开手掌」边沿事件。
// 关键：不静态 import CDN，改用运行时动态 import，避免 CDN 挂掉导致整个页面崩溃。

let HandLandmarker = null;
let FilesetResolver = null;
// ...
const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function loadMediaPipeOnce() {
  if (HandLandmarker) return;
  const vision = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
  );
  HandLandmarker = vision.HandLandmarker;
  FilesetResolver = vision.FilesetResolver;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];

export class HandTracker {
  constructor({ onOpenPalm, onMove, onStatus } = {}) {
    this.onOpenPalm = onOpenPalm;
    this.onMove = onMove;
    this.onStatus = onStatus;

    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.running = false;

    this.prevOpen = false;
    this.lastTriggerTime = 0;
    this.cooldown = 350;
    this.frameCount = 0;
    this.detectEveryNFrames = 2;
  }

  async init() {
    if (this.landmarker) return;
    this.onStatus?.("正在加载手部识别模型…");

    await loadMediaPipeOnce(); // ← 动态加载

    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }

  async start() {
    await this.init();
    this.onStatus?.("正在开启摄像头…");
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    this.video.muted = true;
    await this.video.play();

    this.running = true;
    this.onStatus?.("已就绪，张开手掌试试");
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  _loop() {
    const tick = () => {
      if (!this.running) return;
      this.frameCount++;
      if (this.frameCount % this.detectEveryNFrames === 0) {
        this._detect();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _detect() {
    if (!this.video || this.video.readyState < 2) return;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, performance.now());
    } catch (e) {
      return;
    }

    const hands = result?.landmarks;
    if (!hands || hands.length === 0) {
      this.prevOpen = false;
      return;
    }

    const lm = hands[0];
    const open = this._isOpenPalm(lm);

    const cx = (lm[0].x + lm[9].x + lm[12].x) / 3;
    const cy = (lm[0].y + lm[9].y + lm[12].y) / 3;
    const mirrored = { x: 1 - cx, y: cy };
    this.onMove?.(mirrored);

    const now = performance.now();
    if (open && !this.prevOpen && now - this.lastTriggerTime > this.cooldown) {
      this.lastTriggerTime = now;
      this.onOpenPalm?.(mirrored);
    }
    this.prevOpen = open;
  }

  _isOpenPalm(lm) {
    const wrist = lm[0];
    const pinkyMcp = lm[17];
    let extended = 0;

    for (let i = 0; i < 5; i++) {
      const tip = lm[FINGER_TIPS[i]];
      const pip = lm[FINGER_PIPS[i]];

      if (i === 0) {
        if (this._dist(tip, pinkyMcp) > this._dist(pip, pinkyMcp) * 1.05) {
          extended++;
        }
      } else {
        if (this._dist(tip, wrist) > this._dist(pip, wrist) * 1.05) {
          extended++;
        }
      }
    }
    return extended >= 4;
  }

  _dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}