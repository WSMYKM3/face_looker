const videoElement = document.createElement('video');
videoElement.style.display = 'none'; // Hide the raw video element
document.body.appendChild(videoElement);

// Create a container for the preview
const previewContainer = document.createElement('div');
previewContainer.id = 'webcam-preview';
previewContainer.style.display = 'none';
document.body.appendChild(previewContainer);

const canvasElement = document.createElement('canvas');
previewContainer.appendChild(canvasElement);
const canvasCtx = canvasElement.getContext('2d');

let isWebcamRunning = false;
let camera = null;
let hands = null;

const webcamButton = document.getElementById('webcamButton');

function onResults(results) {
    // Draw the video and landmarks on the preview canvas
    // Get video dimensions
    const videoWidth = videoElement.videoWidth || 1280;
    const videoHeight = videoElement.videoHeight || 720;
    
    // Get container dimensions (landscape: 400x225)
    const containerWidth = previewContainer.clientWidth || 400;
    const containerHeight = previewContainer.clientHeight || 225;
    
    // Set canvas to container size (landscape orientation)
    canvasElement.width = containerWidth;
    canvasElement.height = containerHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Calculate scaling to fit video in landscape container
    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    const scale = Math.max(scaleX, scaleY); // Cover mode - fill container
    
    // Center the video
    const scaledWidth = videoWidth * scale;
    const scaledHeight = videoHeight * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;
    
    // Mirror and draw
    canvasCtx.translate(containerWidth, 0);
    canvasCtx.scale(-1, 1); // Mirror the preview
    canvasCtx.drawImage(results.image, -offsetX, offsetY, scaledWidth, scaledHeight);

    // Draw 3x3 Grid on Camera Preview (using container dimensions)
    // Note: coordinates are in mirrored space (x=0 is right, x=w is left)
    const w = canvasElement.width;
    const h = canvasElement.height;
    const cellW = w / 3;
    const cellH = h / 3;

    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    // Vertical lines (account for mirroring: left line at x=w, right line at x=0)
    canvasCtx.moveTo(w - cellW, 0); canvasCtx.lineTo(w - cellW, h); // Left vertical line
    canvasCtx.moveTo(w - cellW * 2, 0); canvasCtx.lineTo(w - cellW * 2, h); // Right vertical line
    // Horizontal lines (same in both coordinate systems)
    canvasCtx.moveTo(0, cellH); canvasCtx.lineTo(w, cellH);
    canvasCtx.moveTo(0, cellH * 2); canvasCtx.lineTo(w, cellH * 2);
    canvasCtx.stroke();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            // Index finger tip is landmark 8
            const indexTip = landmarks[8];

            // Map normalized coordinates (0-1) to screen coordinates
            // Note: x is mirrored in the drawing, but for logic we need to handle it carefully.
            // Mediapipe x is 0 (left) to 1 (right) of the image.
            // Since we mirrored the drawing with scale(-1, 1), visual left is x=1, visual right is x=0.
            // BUT, the game logic expects screen coordinates.
            // Let's map the hand position to the 3x3 grid directly.

            // Inverted X for mirrored view logic
            const logicX = 1 - indexTip.x;
            const logicY = indexTip.y;

            // Determine grid cell (0, 1, 2)
            const col = Math.floor(logicX * 3);
            const row = Math.floor(logicY * 3);

            // Highlight the camera grid cell (account for mirroring)
            canvasCtx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            // After mirroring, x coordinates are flipped, so use (2-col) for left-right
            const mirroredCol = 2 - col;
            canvasCtx.fillRect(mirroredCol * cellW, row * cellH, cellW, cellH);

            // Map to game grid names
            // Handle special cases first: center cell, and middle column (top/bottom)
            let posName = '';
            if (row === 1 && col === 1) {
                posName = 'center';
            } else if (row === 0 && col === 1) {
                // Top row, center column = 'top'
                posName = 'top';
            } else if (row === 2 && col === 1) {
                // Bottom row, center column = 'bottom'
                posName = 'bottom';
            } else if (row === 1 && col === 0) {
                // Middle row, left column = 'left'
                posName = 'left';
            } else if (row === 1 && col === 2) {
                // Middle row, right column = 'right'
                posName = 'right';
            } else {
                // Corner positions: combine row and column names
                const rowNames = ['top', '', 'bottom'];
                const colNames = ['left', 'center', 'right'];
                const v = rowNames[row];
                const h = colNames[col];
                posName = `${v}-${h}`;
            }

            // Dispatch custom event with grid position
            const event = new CustomEvent('handgridmove', {
                detail: { pos: posName }
            });
            window.dispatchEvent(event);
        }
    }
    canvasCtx.restore();
}

async function startWebcam() {
    if (isWebcamRunning) return;

    webcamButton.innerText = "Loading...";
    webcamButton.disabled = true;

    try {
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });

        await camera.start();

        isWebcamRunning = true;
        webcamButton.innerText = "Disable Webcam";
        webcamButton.disabled = false;
        previewContainer.style.display = 'block';

    } catch (error) {
        console.error("Error starting webcam:", error);
        webcamButton.innerText = "Error (See Console)";
        webcamButton.disabled = false;
    }
}

function stopWebcam() {
    if (!isWebcamRunning) return;

    // There isn't a direct "stop" method on the Camera utility that fully releases, 
    // but we can stop the video stream.
    const stream = videoElement.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    videoElement.srcObject = null;

    isWebcamRunning = false;
    webcamButton.innerText = "Enable Webcam Hand Control";
    previewContainer.style.display = 'none';
}

webcamButton.addEventListener('click', () => {
    if (isWebcamRunning) {
        stopWebcam();
    } else {
        startWebcam();
    }
});
