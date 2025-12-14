let netPromise = null;
let cameraRunning = false;
let video = null;
let currentStream = null;
let renderId = null;

// Tunable parameters
let internalRes = 'medium';
let segThreshold = 0.7;
let edgeBlur = 0;
let edgeFeather = 0;
let maskErosion = 0;
let invertMask = false;

async function startSegFromUser(){
  const startMsg = document.getElementById('startMsg');
  startMsg.textContent = 'Requesting camera...';
  if(!netPromise) netPromise = bodyPix.load();
  if(!video){ video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.muted = true; }
  try{
    // Request 1280x720 video by default — this is a preferred resolution but not guaranteed
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}});
    currentStream = stream;
    video.srcObject = stream;
    // wait for some video data so dimensions and frames are available
    await new Promise((res)=>{
      video.addEventListener('loadeddata', res, {once:true});
      video.play().catch(()=>{});
      // fallback resolve in case event doesn't fire quickly
      setTimeout(res, 1000);
    });
  }catch(e){ console.error('Camera error',e); startMsg.textContent = 'Camera denied or unavailable'; return; }

  startMsg.textContent = 'Loading model...';
  const net = await netPromise;
  startMsg.textContent = 'Running';
  cameraRunning = true;

  const canvases = Array.from(document.querySelectorAll('.alphaCanvas'));
  // ensure video dimensions available (some browsers report 0 briefly)
  let vw = video.videoWidth || video.width || 0;
  let vh = video.videoHeight || video.height || 0;
  const t0 = performance.now();
  while (vw === 0 && performance.now() - t0 < 2000) {
    await new Promise(r => setTimeout(r, 50));
    vw = video.videoWidth || video.width || 0;
    vh = video.videoHeight || video.height || 0;
  }
  // Fallback resolution if video dimensions cannot be determined — used as sensible defaults
  if (vw === 0) { vw = 1280; vh = 720; }
  canvases.forEach(c=>{ c.width = vw; c.height = vh; });
  const tmp = document.createElement('canvas'); tmp.width = vw; tmp.height = vh;
  const tmpCtx = tmp.getContext('2d');

  async function render(){
    if(!cameraRunning) return; // abort if stopped while async work was pending
    // draw current video frame to tmp canvas first (ensures segmentation gets proper dimensions)
    tmpCtx.drawImage(video,0,0,tmp.width,tmp.height);
    const segmentation = await net.segmentPerson(tmp, {internalResolution: internalRes, segmentationThreshold: segThreshold});
    if(!cameraRunning) return; // abort if stopped while model was running
    const mask = bodyPix.toMask(segmentation);

    // Get mask as canvas for blur/erosion processing
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = tmp.width;
    maskCanvas.height = tmp.height;
    const maskCtx = maskCanvas.getContext('2d');
    const maskImgData = maskCtx.createImageData(tmp.width, tmp.height);
    maskImgData.data.set(mask.data);
    maskCtx.putImageData(maskImgData, 0, 0);

    // Apply blur to mask
    if (edgeBlur > 0) {
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = tmp.width;
      blurCanvas.height = tmp.height;
      const blurCtx = blurCanvas.getContext('2d');
      blurCtx.filter = `blur(${edgeBlur}px)`;
      blurCtx.drawImage(maskCanvas, 0, 0);
      maskCtx.clearRect(0, 0, tmp.width, tmp.height);
      maskCtx.filter = 'none';
      maskCtx.drawImage(blurCanvas, 0, 0);
    }

    // Apply erosion effect
    if (maskErosion > 0) {
      const erodeCanvas = document.createElement('canvas');
      erodeCanvas.width = tmp.width;
      erodeCanvas.height = tmp.height;
      const erodeCtx = erodeCanvas.getContext('2d');
      const scale = 1 - (maskErosion / 100);
      const offsetX = (tmp.width * (1 - scale)) / 2;
      const offsetY = (tmp.height * (1 - scale)) / 2;
      erodeCtx.drawImage(maskCanvas, offsetX, offsetY, tmp.width * scale, tmp.height * scale);
      maskCtx.clearRect(0, 0, tmp.width, tmp.height);
      maskCtx.drawImage(erodeCanvas, 0, 0, tmp.width, tmp.height);
    }

    const processedMask = maskCtx.getImageData(0, 0, tmp.width, tmp.height);
    const img = tmpCtx.getImageData(0,0,tmp.width,tmp.height);
    const mdata = processedMask.data;

    // Compute feather thresholds
    const thresholdLow = Math.max(0, 0.5 - edgeFeather / 2) * 255;
    const thresholdHigh = Math.min(255, (0.5 + edgeFeather / 2) * 255);
    const range = thresholdHigh - thresholdLow;

    for(const c of canvases){
      const ctx = c.getContext('2d');
      const out = ctx.createImageData(tmp.width,tmp.height);
      for(let i=0;i<img.data.length;i+=4){
        out.data[i]=img.data[i];
        out.data[i+1]=img.data[i+1];
        out.data[i+2]=img.data[i+2];
        // Get mask alpha (invert so person is opaque)
        let maskAlpha = 255 - mdata[i+3];

        // Invert if requested
        if (invertMask) {
          maskAlpha = 255 - maskAlpha;
        }

        // Apply feathering
        if (edgeFeather > 0 && range > 0) {
          if (maskAlpha <= thresholdLow) {
            maskAlpha = 0;
          } else if (maskAlpha >= thresholdHigh) {
            maskAlpha = 255;
          } else {
            maskAlpha = ((maskAlpha - thresholdLow) / range) * 255;
          }
        }

        out.data[i+3] = maskAlpha;
      }
      ctx.putImageData(out,0,0);
    }
    if(!cameraRunning) return;
    renderId = requestAnimationFrame(render);
  }
  render();
}

function stopSegFromUser(){
  const startMsg = document.getElementById('startMsg');
  if(renderId) cancelAnimationFrame(renderId);
  renderId = null;
  if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream = null; }
  if(video){ video.pause(); video.srcObject = null; }
  cameraRunning = false;
  startMsg.textContent = 'Stopped';
  const canvases = Array.from(document.querySelectorAll('.alphaCanvas'));
  canvases.forEach(c=>{ const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); /* ensure pixels removed, not just visually cleared */ const blank = ctx.createImageData(c.width || 1, c.height || 1); ctx.putImageData(blank, 0, 0); });
}

document.getElementById('startBtn').addEventListener('click', ()=>{
  if(!window.isSecureContext){ document.getElementById('startMsg').textContent = 'Page not secure. Serve via https or localhost.'; return; }
  const btn = document.getElementById('startBtn');
  if(!cameraRunning){
    startSegFromUser();
    btn.textContent = 'Stop camera';
  }else{
    stopSegFromUser();
    btn.textContent = 'Start camera';
  }
});

document.addEventListener('DOMContentLoaded', ()=>{
  const startMsg = document.getElementById('startMsg');
  const btn = document.getElementById('startBtn');
  if(location && location.protocol === 'file:'){
    // Report explicit error when opened via file://
    startMsg.textContent = 'Error: file:// detected in URL. Camera access requires https or localhost.';
    if(btn) btn.disabled = true;
    console.error('file:// protocol detected - camera unavailable');
  } else {
    // For debugging, annotate load time
    startMsg.dataset.loadedAt = '2025-12-14T20:27:54.161Z';
  }
});

// Wire up UI controls
document.getElementById('internalRes').addEventListener('change', (e) => {
  internalRes = e.target.value;
});
document.getElementById('segThreshold').addEventListener('input', (e) => {
  segThreshold = parseFloat(e.target.value);
  document.getElementById('segThresholdVal').textContent = segThreshold.toFixed(2);
});
document.getElementById('edgeBlur').addEventListener('input', (e) => {
  edgeBlur = parseInt(e.target.value, 10);
  document.getElementById('edgeBlurVal').textContent = edgeBlur;
});
document.getElementById('edgeFeather').addEventListener('input', (e) => {
  edgeFeather = parseFloat(e.target.value);
  document.getElementById('edgeFeatherVal').textContent = edgeFeather.toFixed(2);
});
document.getElementById('maskErosion').addEventListener('input', (e) => {
  maskErosion = parseInt(e.target.value, 10);
  document.getElementById('maskErosionVal').textContent = maskErosion;
});
document.getElementById('invertMask').addEventListener('change', (e) => {
  invertMask = e.target.checked;
});
