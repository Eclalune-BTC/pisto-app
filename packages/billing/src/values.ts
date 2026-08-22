export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readString(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function readBoolean(
  record: Record<string, unknown> | null,
  ...keys: string[]
): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

export function readDate(record: Record<string, unknown> | null, ...keys: string[]): Date | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}
