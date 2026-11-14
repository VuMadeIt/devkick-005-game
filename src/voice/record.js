// Records the mic while the talk button is held. Works in any browser with MediaRecorder,
// so free talk does not depend on Chrome's built-in speech recognition.

const MAX_MS = 15000; // stop on our own after 15 s so a stuck button can't record forever

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
  });
  rec.start();
  const cap = setTimeout(() => rec.state !== 'inactive' && rec.stop(), MAX_MS);
  return {
    // Keep recording a moment after release so the last word lands.
    stop: () => {
      clearTimeout(cap);
      setTimeout(() => rec.state !== 'inactive' && rec.stop(), 250);
      return stopped;
    },
  };
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
