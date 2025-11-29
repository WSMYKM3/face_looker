// Grid configuration (must match your generated images)
const P_MIN = -15;
const P_MAX = 15;
const STEP = 3;
const SIZE = 256;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantizeToGrid(val) {
  const raw = P_MIN + (val + 1) * (P_MAX - P_MIN) / 2; // [-1,1] -> [-15,15]
  const snapped = Math.round(raw / STEP) * STEP;
  return clamp(snapped, P_MIN, P_MAX);
}

function sanitize(val) {
  const str = Number(val).toFixed(1); // force one decimal, e.g. 0 -> 0.0
  return str.replace('-', 'm').replace('.', 'p');
}

function gridToFilename(px, py) {
  return `gaze_px${sanitize(px)}_py${sanitize(py)}_${SIZE}.webp`;
}

function updateDebug(debugEl, x, y, filename) {
  if (!debugEl) return;
  debugEl.innerHTML = `Mouse: (${Math.round(x)}, ${Math.round(y)})<br/>Image: ${filename}`;
}

function initializeFaceTracker(container) {
  const basePath = container.dataset.basePath || '/faces/';
  const showDebug = String(container.dataset.debug || 'false') === 'true';

  const img = document.createElement('img');
  img.className = 'face-image';
  img.alt = 'Face following gaze';
  // Set default image to avoid broken icon on load
  img.src = `${basePath}gaze_px0p0_py0p0_256.webp`;
  container.appendChild(img);

  let debugEl = null;
  if (showDebug) {
    debugEl = document.createElement('div');
    debugEl.className = 'face-debug';
    container.appendChild(debugEl);
  }

  // Expose manual control
  container.setGaze = (px, py) => {
    const filename = gridToFilename(px, py);
    const imagePath = `${basePath}${filename}`;
    img.src = imagePath;
    // For manual mode, we might not have clientX/Y, so we skip debug update or pass 0,0
    if (showDebug) updateDebug(debugEl, 0, 0, filename);
  };

  function setFromClient(clientX, clientY) {
    // If manual mode is enabled, ignore mouse/touch events for gaze updating
    if (container.dataset.manual === 'true') return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const nx = (clientX - centerX) / (rect.width / 2);
    const ny = (centerY - clientY) / (rect.height / 2);

    const clampedX = clamp(nx, -1, 1);
    const clampedY = clamp(ny, -1, 1);

    const px = quantizeToGrid(clampedX);
    const py = quantizeToGrid(clampedY);

    const filename = gridToFilename(px, py);
    const imagePath = `${basePath}${filename}`;
    img.src = imagePath;
    // Only update debug if NOT in manual mode (or if we want to force it, but usually manual mode implies game control)
    if (container.dataset.manual !== 'true') {
      updateDebug(debugEl, clientX - rect.left, clientY - rect.top, filename);
    }
  }

  function handleMouseMove(e) {
    setFromClient(e.clientX, e.clientY);
  }

  function handleTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      setFromClient(t.clientX, t.clientY);
    }
  }

  // Track pointer anywhere on the page
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('touchmove', handleTouchMove, { passive: true });

  // Initialize at center
  const rect = container.getBoundingClientRect();
  setFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.face-tracker').forEach((el) => initializeFaceTracker(el));
});
