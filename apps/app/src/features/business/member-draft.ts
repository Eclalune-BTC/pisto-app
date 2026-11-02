import {
  type AddBusinessMemberRequest,
  type AssignableBusinessRole,
  addBusinessMemberRequestSchema,
} from "@pisto/contracts";

export const ASSIGNABLE_ROLES: readonly AssignableBusinessRole[] = ["admin", "member"];

type AddMemberField = "email" | "initialPassword" | "name" | "role";
export type FieldProblem = "invalid" | "missing" | "tooLong" | "tooShort";
export type AddMemberProblems = Partial<Record<AddMemberField, FieldProblem>>;

export type AddMemberDraft = {
  email: string;
  initialPassword: string;
  name: string;
  role: AssignableBusinessRole | null;
};

const fields = new Set<string>(["email", "initialPassword", "name", "role"]);

function problemOf(field: AddMemberField, code: string): FieldProblem {
  // The role comes from a select, so the only way it can fail is by not being chosen.
  if (field === "role") return "missing";
  if (code === "too_big") return "tooLong";
  if (code === "too_small") return field === "initialPassword" ? "tooShort" : "missing";
  return "invalid";
}

/**
 * Checks the form with the request contract the server validates, so the inline errors and the
 * server never disagree about what is acceptable.
 */
export function buildAddMemberCommand(
  draft: AddMemberDraft,
  idempotencyKey: string,
): { command: AddBusinessMemberRequest } | { problems: AddMemberProblems } {
  const parsed = addBusinessMemberRequestSchema.safeParse({ idempotencyKey, ...draft });
  if (parsed.success) return { command: parsed.data };
  const problems: AddMemberProblems = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !fields.has(field)) {
      throw new Error(`The add-member command failed outside its fields: ${issue.code}`);
    }
    const key = field as AddMemberField;
    problems[key] ??= problemOf(key, issue.code);
  }
  if (problems.email && draft.email.trim() === "") problems.email = "missing";
  return { problems };
}
