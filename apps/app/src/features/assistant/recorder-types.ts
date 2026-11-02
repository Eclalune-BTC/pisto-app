export type RecorderFailure = "denied" | "unsupported" | "failed";

export class RecorderError extends Error {
  override readonly name = "RecorderError";

  constructor(readonly reason: RecorderFailure) {
    super(`Recording failed: ${reason}`);
  }
}

export interface Recording {
  /** Stops capturing and returns 16 kHz mono WAV. */
  stop(): Promise<Blob>;
  /** Stops capturing and discards the audio. */
  cancel(): void;
}

/** The longest dictation; the dialog stops and reviews when it is reached. */
export const MAX_RECORDING_SECONDS = 45;
