export interface RecordingOptions {
  canvas: HTMLCanvasElement;
  audioTracks: MediaStreamTrack[];
  duration: number;
  fps?: number;
  onTick?: (secondsLeft: number) => void;
}

export function canRecord() {
  return typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
}

function supportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

export async function recordCanvas({
  canvas,
  audioTracks,
  duration,
  fps = 60,
  onTick,
}: RecordingOptions) {
  if (!canRecord()) throw new Error('Video recording is not supported in this browser.');

  const stream = canvas.captureStream(fps);
  // Clone shared audio tracks so stopping this recording never silences later ones.
  audioTracks.forEach((track) => stream.addTrack(track.clone()));
  const mimeType = supportedMimeType();
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks: BlobPart[] = [];

  return new Promise<Blob>((resolve, reject) => {
    const startedAt = performance.now();
    const ticker = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      onTick?.(Math.max(0, Math.ceil(duration - elapsed)));
    }, 200);

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener('error', () => {
      window.clearInterval(ticker);
      stream.getTracks().forEach((track) => track.stop());
      reject(new Error('The browser could not finish recording.'));
    });
    recorder.addEventListener('stop', () => {
      window.clearInterval(ticker);
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    });

    recorder.start(500);
    onTick?.(duration);
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, duration * 1000);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
