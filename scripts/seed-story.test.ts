import { describe, expect, test } from "bun:test";

import {
  addDays,
  type DemoStory,
  planDemoStory,
  STORY_OPENING,
  STORY_PRODUCTS,
  storyDate,
} from "./seed-story.ts";

/** A week of possible seeding moments, so every weekday starts the story once. */
const moments = Array.from(
  { length: 7 },
  (_, day) => new Date(Date.parse("2026-11-02T20:30:00.000Z") + day * 86_400_000),
);

function replay(story: DemoStory, now: Date) {
  const stock = new Map(STORY_PRODUCTS.map((item) => [item.sku, item.initial]));
  const price = new Map(STORY_PRODUCTS.map((item) => [item.sku, item.price]));
  const balances = { till: STORY_OPENING.till, bank: STORY_OPENING.bank };
  const receivables = new Map<string, { balance: number; dueDate: string }>();
  const payables = new Map<string, { balance: number; dueDate: string | null }>();
  const today = storyDate(now, 0);
  const sources = new Set<string>();

  for (const event of story.events) {
    switch (event.kind) {
      case "sale": {
        const total = event.lines.reduce(
          (sum, line) => sum + (price.get(line.sku) ?? 0) * line.quantity,
          0,
        );
        expect(total).toBe(event.total);
        expect(new Set(event.lines.map((line) => line.sku)).size).toBe(event.lines.length);
        for (const line of event.lines) {
          const left = (stock.get(line.sku) ?? 0) - line.quantity;
          expect(left).toBeGreaterThanOrEqual(0);
          stock.set(line.sku, left);
        }
        const received = event.payment?.received ?? 0;
        expect(received).toBeLessThanOrEqual(total);
        if (event.payment) {
          expect(received).toBeGreaterThan(0);
          balances[event.payment.account] += received;
        }
        if (received < total) {
          expect(event.customer).not.toBeNull();
          expect(event.dueDate).not.toBeNull();
          expect((event.dueDate ?? "") >= event.date).toBe(true);
          receivables.set(event.ref, { balance: total - received, dueDate: event.dueDate ?? "" });
        } else {
          expect(event.dueDate).toBeNull();
        }
        sources.add(event.entrySource);
        break;
      }
      case "purchase":
        for (const line of event.lines) {
          stock.set(line.sku, (stock.get(line.sku) ?? 0) + line.quantity);
        }
        if (event.terms === "cash") {
          expect(event.account).not.toBeNull();
          balances[event.account ?? "till"] -= event.total;
        } else {
          payables.set(event.ref, { balance: event.total, dueDate: event.dueDate });
        }
        break;
      case "supplierPayment": {
        const open = payables.get(event.purchaseRef);
        expect(open).toBeDefined();
        expect(event.amount).toBeLessThanOrEqual(open?.balance ?? 0);
        if (open) open.balance -= event.amount;
        balances[event.account] -= event.amount;
        break;
      }
      case "receivablePayment": {
        const open = receivables.get(event.saleRef);
        expect(open).toBeDefined();
        expect(event.amount).toBeLessThanOrEqual(open?.balance ?? 0);
        if (open) open.balance -= event.amount;
        balances[event.account] += event.amount;
        break;
      }
      case "expense":
        balances[event.account] -= event.amount;
        break;
      case "transfer":
        balances[event.from] -= event.amount;
        balances[event.to] += event.amount;
        break;
    }
    expect(balances.till).toBeGreaterThanOrEqual(0);
    expect(balances.bank).toBeGreaterThanOrEqual(0);
  }
  return { stock, balances, receivables, payables, today, sources };
}

describe("demo store story", () => {
  test("is the same story every time it is planned for the same moment", () => {
    const now = moments[0] as Date;
    expect(planDemoStory(now)).toEqual(planDemoStory(now));
  });

  for (const now of moments) {
    test(`keeps stock, cash and debts consistent when seeded on ${now.toISOString().slice(0, 10)}`, () => {
      const story = planDemoStory(now);
      const keys = story.events.map((event) => `${event.date} ${event.time}`);
      expect(keys).toEqual([...keys].sort());
      const nowLocal = new Date(now.getTime() - 6 * 3_600_000).toISOString();
      for (const event of story.events) {
        expect(
          `${event.date} ${event.time}` <= `${nowLocal.slice(0, 10)} ${nowLocal.slice(11, 16)}`,
        ).toBe(true);
        expect(event.date >= story.startDate).toBe(true);
      }

      const { stock, balances, receivables, payables, today, sources } = replay(story, now);
      expect(Object.fromEntries(stock)).toEqual(story.finalStock);
      expect(balances).toEqual(story.finalBalances);

      const owed = [...receivables.values()].filter((entry) => entry.balance > 0);
      expect(owed.some((entry) => entry.dueDate < today)).toBe(true);
      expect(owed.some((entry) => entry.dueDate >= today)).toBe(true);
      const due = [...payables.values()].filter((entry) => entry.balance > 0);
      expect(due.some((entry) => (entry.dueDate ?? "") < today)).toBe(true);
      expect(
        due.some(
          (entry) => (entry.dueDate ?? "") >= today && (entry.dueDate ?? "") <= addDays(today, 7),
        ),
      ).toBe(true);

      const low = STORY_PRODUCTS.find((item) => item.endState === "low");
      const out = STORY_PRODUCTS.find((item) => item.endState === "out");
      expect(stock.get(low?.sku ?? "")).toBeGreaterThan(0);
      expect(stock.get(low?.sku ?? "") ?? 0).toBeLessThanOrEqual(low?.low ?? 0);
      expect(stock.get(out?.sku ?? "")).toBe(0);
      expect([...sources].sort()).toEqual(["manual", "text", "voice"]);
    });
  }
});
