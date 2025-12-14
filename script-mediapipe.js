// MediaPipe Selfie Segmentation version
// Generated: 2025-12-14T20:13:10.581Z

let cameraRunning = false;
let video = null;
let currentStream = null;
let camera = null;
let selfieSegmentation = null;

const canvases = [];
const contexts = [];

function initCanvases() {
  const els = document.querySelectorAll('.alphaCanvas');
  els.forEach(c => {
    canvases.push(c);
    contexts.push(c.getContext('2d'));
  });
}

function onResults(results) {
  if (!cameraRunning) return;

  const vw = results.image.width;
  const vh = results.image.height;

  // Create a temporary canvas to composite the result
  const tmp = document.createElement('canvas');
  tmp.width = vw;
  tmp.height = vh;
  const tmpCtx = tmp.getContext('2d');

  // Draw the original image
  tmpCtx.drawImage(results.image, 0, 0, vw, vh);

  // Get the segmentation mask (grayscale: 0 = background, 255 = person)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = vw;
  maskCanvas.height = vh;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.drawImage(results.segmentationMask, 0, 0, vw, vh);

  const imgData = tmpCtx.getImageData(0, 0, vw, vh);
  const maskData = maskCtx.getImageData(0, 0, vw, vh);

  // Apply mask: keep person (where mask is light), make background transparent
  for (let i = 0; i < imgData.data.length; i += 4) {
    // maskData is grayscale; use red channel as alpha indicator
    // MediaPipe mask: person = white (255), background = black (0)
    const maskAlpha = maskData.data[i]; // 0-255
    imgData.data[i + 3] = maskAlpha; // set alpha to mask value
  }

  // Draw to all canvases
  for (let j = 0; j < canvases.length; j++) {
    const c = canvases[j];
    const ctx = contexts[j];
    if (c.width !== vw || c.height !== vh) {
      c.width = vw;
      c.height = vh;
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

async function startSegFromUser() {
  const startMsg = document.getElementById('startMsg');
  startMsg.textContent = 'Requesting camera...';

  initCanvases();

  video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  try {
    // Request 1280x720 video by default — this is a preferred resolution but not guaranteed
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = currentStream;
    await new Promise((res) => {
      video.addEventListener('loadeddata', res, { once: true });
      video.play().catch(() => {});
      setTimeout(res, 1000);
    });
  } catch (e) {
    console.error('Camera error', e);
    startMsg.textContent = 'Camera denied or unavailable';
    return;
  }

  startMsg.textContent = 'Loading model...';

  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });
  selfieSegmentation.setOptions({
    modelSelection: 1 // 0 = general, 1 = landscape (faster)
  });
  selfieSegmentation.onResults(onResults);

  await selfieSegmentation.initialize();

  startMsg.textContent = 'Running';
  cameraRunning = true;

  // Use MediaPipe Camera utility to send frames
  camera = new Camera(video, {
    onFrame: async () => {
      if (!cameraRunning) return;
      await selfieSegmentation.send({ image: video });
    },
    width: 1280,
    height: 720
  });
  camera.start();
}

function stopSegFromUser() {
  const startMsg = document.getElementById('startMsg');
  cameraRunning = false;

  if (camera) {
    camera.stop();
    camera = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  if (video) {
    video.pause();
    video.srcObject = null;
  }

  startMsg.textContent = 'Stopped';

  // Clear all canvases
  for (let j = 0; j < canvases.length; j++) {
    const c = canvases[j];
    const ctx = contexts[j];
    ctx.clearRect(0, 0, c.width, c.height);
    const blank = ctx.createImageData(c.width || 1, c.height || 1);
    ctx.putImageData(blank, 0, 0);
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  if (!window.isSecureContext) {
    document.getElementById('startMsg').textContent = 'Page not secure. Serve via https or localhost.';
    return;
  }
  const btn = document.getElementById('startBtn');
  if (!cameraRunning) {
    startSegFromUser();
    btn.textContent = 'Stop camera';
  } else {
    stopSegFromUser();
    btn.textContent = 'Start camera';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const startMsg = document.getElementById('startMsg');
  const btn = document.getElementById('startBtn');
  if (location && location.protocol === 'file:') {
    startMsg.textContent = 'Error: file:// detected in URL. Camera access requires https or localhost.';
    if (btn) btn.disabled = true;
    console.error('file:// protocol detected - camera unavailable');
  } else {
    startMsg.dataset.loadedAt = '2025-12-14T20:13:10.581Z';
  }
});
