import { type CreateBusinessRequest, createBusinessRequestSchema } from "@pisto/contracts";

export type BusinessDraft = {
  currency: string;
  name: string;
  timeZone: string;
};

export type BusinessDraftField = keyof BusinessDraft;

export type BusinessDraftResult =
  | { command: CreateBusinessRequest; ok: true }
  | { fields: readonly BusinessDraftField[]; ok: false };

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("es", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function buildBusinessCommand(draft: BusinessDraft): BusinessDraftResult {
  const command = {
    currency: draft.currency.trim().toUpperCase(),
    name: draft.name.trim(),
    timeZone: draft.timeZone.trim(),
  };
  const parsed = createBusinessRequestSchema.safeParse(command);
  const fields = new Set<BusinessDraftField>();

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "currency" || field === "name" || field === "timeZone") fields.add(field);
    }
  }

  if (!command.timeZone || !isSupportedTimeZone(command.timeZone)) fields.add("timeZone");

  if (fields.size > 0 || !parsed.success) return { fields: [...fields], ok: false };
  return { command: parsed.data, ok: true };
}
