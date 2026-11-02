import { RecorderError, type Recording } from "./recorder-types";
import { downsample, encodeWav, levelOf, TARGET_SAMPLE_RATE } from "./wav";

export * from "./recorder-types";

/**
 * Microphone capture needs a secure context (HTTPS or localhost) and the Web Audio API. Raw PCM is
 * captured instead of a MediaRecorder file because the transcription route accepts WAV only: the
 * model's documentation does not list the WebM/Opus Chrome records.
 */
export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.AudioContext === "function"
  );
}

function failure(error: unknown): RecorderError {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return new RecorderError("denied");
    }
    if (error.name === "NotSupportedError") return new RecorderError("unsupported");
  }
  return new RecorderError("failed");
}

export async function startRecording(onLevel: (level: number) => void): Promise<Recording> {
  if (!canRecord()) throw new RecorderError("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (error) {
    throw failure(error);
  }

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  // ScriptProcessorNode is deprecated but needs no separately served worklet module; a short
  // dictation does not need the worklet's off-main-thread timing.
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    const samples = new Float32Array(event.inputBuffer.getChannelData(0));
    chunks.push(samples);
    onLevel(levelOf(samples));
  };
  source.connect(processor);
  // A processor only runs while connected to the destination; the gain keeps it silent.
  processor.connect(mute);
  mute.connect(context.destination);

  let finished = false;
  const release = () => {
    finished = true;
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
    mute.disconnect();
    for (const track of stream.getTracks()) track.stop();
    void context.close();
  };

  return {
    async stop() {
      if (finished) throw new RecorderError("failed");
      const inputRate = context.sampleRate;
      release();
      const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const joined = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      const wav = encodeWav(downsample(joined, inputRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
      return new Blob([wav], { type: "audio/wav" });
    },
    cancel() {
      if (!finished) release();
    },
  };
}
