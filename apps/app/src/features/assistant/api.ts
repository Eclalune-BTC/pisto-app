import {
  type AssistantInterpretation,
  type AssistantInterpretRequest,
  type AssistantInterpretResponse,
  type AssistantStatusResponse,
  assistantInterpretRequestSchema,
  assistantInterpretResponseSchema,
  assistantStatusResponseSchema,
  assistantTranscriptionResponseSchema,
} from "@pisto/contracts";

import { ApiClientError, apiRequest, parseRequestPayload } from "@/lib/api-client";
import { isApiFailure } from "@/lib/api-response";
import { env } from "@/lib/env";

/**
 * Raw audio upload for the one route that takes a binary body. The JSON client stays JSON-only;
 * this is web-only (the browser sends the session cookie), like recording itself.
 */
async function uploadAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/v1/assistant/transcriptions`, {
      method: "POST",
      body: audio,
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "audio/wav" },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiClientError("The API could not be reached.", 0);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status);
  }
  if (!response.ok || isApiFailure(payload)) {
    const failure = isApiFailure(payload) ? payload.error : undefined;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed.",
      response.status,
      failure?.code ?? "API_REQUEST_FAILED",
      failure?.requestId,
    );
  }
  const parsed = assistantTranscriptionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError("The server returned an invalid response shape.", response.status);
  }
  return parsed.data.data.text;
}

export const assistantApi = {
  status: (signal?: AbortSignal) =>
    apiRequest<AssistantStatusResponse, AssistantStatusResponse["data"]>(
      "/v1/assistant/status",
      { authenticated: true, signal },
      assistantStatusResponseSchema,
    ),
  interpret: async (request: AssistantInterpretRequest): Promise<AssistantInterpretation> => {
    const data = await apiRequest<AssistantInterpretResponse, AssistantInterpretResponse["data"]>(
      "/v1/assistant/interpretations",
      {
        authenticated: true,
        method: "POST",
        body: parseRequestPayload(assistantInterpretRequestSchema, request),
      },
      assistantInterpretResponseSchema,
    );
    return data.interpretation;
  },
  transcribe: uploadAudio,
} as const;
