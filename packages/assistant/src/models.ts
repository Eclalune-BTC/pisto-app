/**
 * The only place that names provider models. Product code refers to the task aliases; a model
 * change is a release change that reruns the evaluation set (see docs/adrs/0021).
 */
export interface ExtractionModel {
  id: string;
  /**
   * Workers AI models take one of two `response_format` shapes: the raw JSON Schema under
   * `json_schema`, or the OpenAI shape `{ name, schema, strict }`.
   */
  responseFormat: "raw_schema" | "openai_schema";
  maxTokens: number;
  /** Extra model inputs, such as turning off a reasoning phase the task does not need. */
  inputs: Record<string, unknown>;
}

export interface TranscriptionModel {
  id: string;
  language: string;
}

export const assistantModels: {
  readonly "assistant.extract": ExtractionModel;
  readonly "assistant.transcribe": TranscriptionModel;
} = {
  "assistant.extract": {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    responseFormat: "raw_schema",
    maxTokens: 1_024,
    inputs: { temperature: 0 },
  },
  "assistant.transcribe": {
    id: "@cf/openai/whisper-large-v3-turbo",
    language: "es",
  },
};

export type AssistantModelAlias = keyof typeof assistantModels;
