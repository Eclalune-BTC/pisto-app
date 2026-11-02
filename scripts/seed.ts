/**
 * Loads demo users with preconfigured roles and a demo store with six weeks of history into the
 * configured database. Data goes through the same repositories as the API, so every record keeps
 * its operation receipt, stock and cash movements. Re-running is safe: users and memberships are
 * reused, and business data is only written the first time the demo business is created.
 */
import { createBusinessRepository, member, type ProductActor, session, user } from "@pisto/db";
import { eq } from "drizzle-orm";

import { createRuntime } from "../apps/api/src/runtime.ts";
import {
  applyDemoStory,
  planDemoStory,
  STORY_CUSTOMERS,
  STORY_DAYS,
  STORY_PRODUCTS,
  STORY_SUPPLIERS,
} from "./seed-story.ts";

export const demoUsers = [
  { role: "owner", name: "Marta López", email: "dueno@pisto.test" },
  { role: "admin", name: "Carlos Rivas", email: "encargado@pisto.test" },
  { role: "member", name: "Ana Guzmán", email: "vendedor@pisto.test" },
] as const;

export const demoBusiness = {
  name: "Abarrotes La Ceiba",
  currency: "USD",
  timeZone: "America/El_Salvador",
} as const;

/** The business-local date `daysAgo` days before `now`; El Salvador is UTC-6 all year. */
export function localDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - 6 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function seedPassword(env: Record<string, string | undefined>): string {
  const password = env.SEED_PASSWORD ?? "PistoDemo2026";
  if (password.length < 8) throw new Error("SEED_PASSWORD must contain at least 8 characters");
  return password;
}

async function main() {
  const runtime = createRuntime(process.env);
  const { db } = runtime.database;
  const password = seedPassword(process.env);
  const now = new Date();

  try {
    /** Returns an actor with a fresh session, creating the account the first time. */
    async function actorFor(demo: (typeof demoUsers)[number]): Promise<ProductActor> {
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, demo.email));
      const result = existing
        ? await runtime.auth.api.signInEmail({ body: { email: demo.email, password } })
        : await runtime.auth.api.signUpEmail({
            body: { name: demo.name, email: demo.email, password },
          });
      if (!result.token) throw new Error(`No session was created for ${demo.email}`);
      const [created] = await db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.token, result.token));
      if (!created) throw new Error(`The session for ${demo.email} was not stored`);
      return { userId: result.user.id, sessionId: created.id, activeBusinessId: null };
    }

    const [ownerUser, ...staff] = demoUsers;
    const owner = await actorFor(ownerUser);
    const { business, replayed } = await createBusinessRepository(db).createBusiness(
      owner,
      demoBusiness,
    );
    owner.activeBusinessId = business.id;

    const staffActors: ProductActor[] = [];
    for (const demo of staff) {
      const actor = await actorFor(demo);
      actor.activeBusinessId = business.id;
      staffActors.push(actor);
      await db
        .insert(member)
        .values({
          id: crypto.randomUUID(),
          organizationId: business.id,
          userId: actor.userId,
          role: demo.role,
        })
        .onConflictDoNothing({ target: [member.organizationId, member.userId] });
      // Commands require the session's active business, as the app selects it after sign-in.
      await db
        .update(session)
        .set({ activeOrganizationId: business.id })
        .where(eq(session.id, actor.sessionId));
    }
    const [admin, seller] = staffActors;
    if (!admin || !seller) throw new Error("The demo staff accounts were not created");

    if (replayed) {
      console.info("Demo business already existed; users and roles were verified, no data added.");
      return;
    }

    const story = planDemoStory(now);
    const counts = await applyDemoStory({
      db,
      actors: { owner, admin, seller },
      currency: demoBusiness.currency,
      story,
      onProgress: (done, total) => {
        if (done % 100 === 0 || done === total) console.info(`  ${done}/${total} records`);
      },
    });
    console.info(
      `Seeded ${demoBusiness.name}: ${demoUsers.length} users, ${STORY_PRODUCTS.length} products, ${STORY_SUPPLIERS.length} suppliers, ${STORY_CUSTOMERS.length} customers, ${counts.sales} sales, ${counts.purchases} purchases, ${counts.expenses} expenses and ${counts.payments} payments over ${STORY_DAYS} days.`,
    );
  } finally {
    await runtime.database.close();
  }
}

if (import.meta.main) await main();
