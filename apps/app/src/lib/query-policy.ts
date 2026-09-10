import axios from "axios";
import { ApiClientError } from "./api-error";

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || axios.isCancel(error)) return false;
  if (!(error instanceof ApiClientError)) return false;
  if (error.code === "WRITES_PAUSED") return false;
  return error.status === 0 || [502, 503, 504].includes(error.status);
}
