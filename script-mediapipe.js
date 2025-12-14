// MediaPipe Selfie Segmentation version
// Generated: 2025-12-14T20:15:53.123Z

let cameraRunning = false;
let video = null;
let currentStream = null;
let camera = null;
let selfieSegmentation = null;

const canvases = [];
const contexts = [];

// Tunable parameters
let edgeBlur = 5;
let threshold = 0.5;
let edgeFeather = 0.3;
let maskErosion = 0;
let smoothMask = true;
let invertMask = false;
let modelSelection = 1;

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

  // Get the segmentation mask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = vw;
  maskCanvas.height = vh;
  const maskCtx = maskCanvas.getContext('2d');
  
  // Draw mask without filter first
  maskCtx.drawImage(results.segmentationMask, 0, 0, vw, vh);

  // Apply blur using StackBlur-like box blur approximation for visible effect
  if (edgeBlur > 0) {
    // Use CSS filter on a second pass canvas for blur
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = vw;
    blurCanvas.height = vh;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${edgeBlur}px)`;
    blurCtx.drawImage(maskCanvas, 0, 0);
    // Copy blurred result back
    maskCtx.clearRect(0, 0, vw, vh);
    maskCtx.filter = 'none';
    maskCtx.drawImage(blurCanvas, 0, 0);
  }

  // Apply erosion effect (shrink mask) by drawing slightly smaller
  if (maskErosion > 0) {
    const erodeCanvas = document.createElement('canvas');
    erodeCanvas.width = vw;
    erodeCanvas.height = vh;
    const erodeCtx = erodeCanvas.getContext('2d');
    // Draw mask scaled down then back up to erode edges
    const scale = 1 - (maskErosion / 100);
    const offsetX = (vw * (1 - scale)) / 2;
    const offsetY = (vh * (1 - scale)) / 2;
    erodeCtx.drawImage(maskCanvas, offsetX, offsetY, vw * scale, vh * scale);
    maskCtx.clearRect(0, 0, vw, vh);
    maskCtx.drawImage(erodeCanvas, 0, 0, vw, vh);
  }

  const imgData = tmpCtx.getImageData(0, 0, vw, vh);
  const maskData = maskCtx.getImageData(0, 0, vw, vh);

  // Compute threshold bounds (threshold is center, feather is width of gradient zone)
  const thresholdLow = Math.max(0, (threshold - edgeFeather / 2)) * 255;
  const thresholdHigh = Math.min(255, (threshold + edgeFeather / 2) * 255);
  const range = thresholdHigh - thresholdLow;

  for (let i = 0; i < imgData.data.length; i += 4) {
    // Use alpha channel from mask (MediaPipe outputs to alpha)
    let maskAlpha = maskData.data[i + 3]; // Try alpha channel
    // Fallback to red channel if alpha is all 255
    if (maskAlpha === 255 || maskAlpha === 0) {
      // Check if red channel has gradient info
      const redVal = maskData.data[i];
      if (redVal !== maskAlpha) {
        maskAlpha = redVal;
      }
    }

    // Invert if requested
    if (invertMask) {
      maskAlpha = 255 - maskAlpha;
    }

    // Apply threshold with feathering
    let finalAlpha;
    if (range <= 0 || !smoothMask) {
      // Hard threshold
      finalAlpha = maskAlpha >= (threshold * 255) ? 255 : 0;
    } else if (maskAlpha <= thresholdLow) {
      finalAlpha = 0;
    } else if (maskAlpha >= thresholdHigh) {
      finalAlpha = 255;
    } else {
      // Smooth gradient in the feather zone
      finalAlpha = ((maskAlpha - thresholdLow) / range) * 255;
    }

    imgData.data[i + 3] = finalAlpha;
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
    modelSelection: modelSelection
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
    startMsg.dataset.loadedAt = '2025-12-14T20:15:53.123Z';
  }
});

// Wire up UI controls
document.getElementById('edgeBlur').addEventListener('input', (e) => {
  edgeBlur = parseInt(e.target.value, 10);
  document.getElementById('edgeBlurVal').textContent = edgeBlur;
});
document.getElementById('threshold').addEventListener('input', (e) => {
  threshold = parseFloat(e.target.value);
  document.getElementById('thresholdVal').textContent = threshold.toFixed(2);
});
document.getElementById('edgeFeather').addEventListener('input', (e) => {
  edgeFeather = parseFloat(e.target.value);
  document.getElementById('edgeFeatherVal').textContent = edgeFeather.toFixed(2);
});
document.getElementById('maskErosion').addEventListener('input', (e) => {
  maskErosion = parseInt(e.target.value, 10);
  document.getElementById('maskErosionVal').textContent = maskErosion;
});
document.getElementById('smoothMask').addEventListener('change', (e) => {
  smoothMask = e.target.checked;
});
document.getElementById('invertMask').addEventListener('change', (e) => {
  invertMask = e.target.checked;
});
document.getElementById('modelSelect').addEventListener('change', (e) => {
  modelSelection = parseInt(e.target.value, 10);
  // If running, reinitialize the model with new selection
  if (selfieSegmentation) {
    selfieSegmentation.setOptions({ modelSelection: modelSelection });
  }
});
