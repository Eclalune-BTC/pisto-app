import { describe, expect, test } from "vitest";

import { buildAddMemberCommand } from "./member-draft";

const key = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";
const draft = {
  name: "  Daniela Cruz ",
  email: " Daniela@Example.TEST ",
  role: "admin" as const,
  initialPassword: " clave temporal ",
};

describe("add-member form", () => {
  test("sends the normalized contract command and keeps the password exactly as typed", () => {
    expect(buildAddMemberCommand(draft, key)).toEqual({
      command: {
        idempotencyKey: key,
        name: "Daniela Cruz",
        email: "daniela@example.test",
        role: "admin",
        initialPassword: " clave temporal ",
      },
    });
  });

  test("names each field's problem so the form can say it inline", () => {
    expect(
      buildAddMemberCommand({ name: "   ", email: "", role: null, initialPassword: "corta" }, key),
    ).toEqual({
      problems: { name: "missing", email: "missing", role: "missing", initialPassword: "tooShort" },
    });
    expect(
      buildAddMemberCommand(
        { ...draft, name: "n".repeat(81), email: "daniela@", initialPassword: "x".repeat(129) },
        key,
      ),
    ).toEqual({ problems: { name: "tooLong", email: "invalid", initialPassword: "tooLong" } });
  });
});
