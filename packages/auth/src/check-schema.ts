import { expo } from "@better-auth/expo";
import { authSchema } from "@pisto/db";
import { getAuthTables } from "better-auth/db";
import { organization } from "better-auth/plugins";
import { getTableColumns } from "drizzle-orm";

const expected = getAuthTables({
  plugins: [expo(), organization()],
  rateLimit: { storage: "database" },
});
const actual = authSchema as Record<string, (typeof authSchema)[keyof typeof authSchema]>;
const errors: string[] = [];

for (const [model, definition] of Object.entries(expected)) {
  const table = actual[model];
  if (!table) {
    errors.push(`Missing Better Auth table: ${model}`);
    continue;
  }
  const columns = getTableColumns(table) as Record<string, { notNull: boolean }>;
  const expectedFields = ["id", ...Object.keys(definition.fields)].sort();
  const actualFields = Object.keys(columns).sort();
  if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
    errors.push(
      `${model} fields differ: expected ${expectedFields.join(", ")}; found ${actualFields.join(", ")}`,
    );
  }
  for (const [field, attributes] of Object.entries(definition.fields)) {
    if (attributes.required && columns[field] && !columns[field].notNull) {
      errors.push(`${model}.${field} must be NOT NULL`);
    }
  }
}

if (errors.length > 0) {
  throw new Error(
    `Better Auth 1.7.1 schema check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.info(
  JSON.stringify({
    level: "info",
    message: "Better Auth schema matches configured 1.7.1 tables and fields",
    tables: Object.keys(expected).sort(),
  }),
);
