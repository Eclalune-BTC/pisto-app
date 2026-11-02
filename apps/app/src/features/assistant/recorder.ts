import { RecorderError, type Recording } from "./recorder-types";

export * from "./recorder-types";

/** Native builds have no audio module installed, so dictation there is text only. */
export function canRecord(): boolean {
  return false;
}

export async function startRecording(_onLevel: (level: number) => void): Promise<Recording> {
  throw new RecorderError("unsupported");
}
