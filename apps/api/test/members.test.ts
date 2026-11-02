import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { BusinessMembersRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { memberRoutes } from "../src/routes/members.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const memberId = "3f8c2d1e-6b7a-4c5d-9e0f-1a2b3c4d5e6f";
const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";
const password = "Temporal-2026-secret";
const json = { "content-type": "application/json" };
const added = {
  id: memberId,
  name: "Daniela Cruz",
  email: "daniela@example.test",
  role: "member",
};
const addCommand = {
  idempotencyKey,
  name: "Daniela Cruz",
  email: "daniela@example.test",
  role: "member",
  initialPassword: password,
};

function createTestApp(repository: Partial<BusinessMembersRepository>, authenticated = true) {
  const auth = {
    api: {
      getSession: async () =>
        authenticated
          ? {
              user: { id: "user_test" },
              session: {
                id: "session_test",
                activeOrganizationId: "business_test",
                expiresAt: new Date(Date.now() + 60_000),
              },
            }
          : null,
    },
  } as unknown as Auth;
  return testClient(
    testErrorBoundary().use(
      memberRoutes({
        access: testAccess(auth),
        members: repository as BusinessMembersRepository,
      }),
    ),
  );
}

const unexpected = async (): Promise<never> => {
  throw new Error("Repository should not be called");
};

describe("business staff routes", () => {
  test("requires a session before any staff command is read", async () => {
    let called = false;
    const response = await createTestApp(
      {
        addMember: async () => {
          called = true;
          throw new Error("Repository should not be called");
        },
      },
      false,
    ).request("/v1/businesses/members", {
      method: "POST",
      headers: json,
      body: JSON.stringify(addCommand),
    });
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("adds a member with 201, replays with 200 and never echoes the password", async () => {
    const received: unknown[] = [];
    const app = createTestApp({
      addMember: async (actor, command) => {
        received.push({ actor, command });
        return { account: "created", member: added, replayed: received.length > 1 };
      },
    });
    const request = () =>
      app.request("/v1/businesses/members", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ ...addCommand, email: "  Daniela@Example.TEST " }),
      });
    const first = await request();
    const firstBody = await first.text();
    const replay = await request();

    expect(first.status).toBe(201);
    expect(JSON.parse(firstBody)).toEqual({
      data: { account: "created", member: added, replayed: false },
    });
    expect(firstBody).not.toContain(password);
    expect(replay.status).toBe(200);
    expect(received[0]).toEqual({
      actor: { userId: "user_test", sessionId: "session_test", activeBusinessId: "business_test" },
      command: { ...addCommand, email: "daniela@example.test" },
    });
  });

  test("rejects an invalid staff command before the repository without echoing the password", async () => {
    const app = createTestApp({ addMember: unexpected });
    for (const change of [
      { initialPassword: "short" },
      { initialPassword: undefined },
      { role: "owner" },
      { email: "not-an-email" },
      { name: "   " },
      { businessId: "another-business" },
      { userId: "someone-else" },
    ]) {
      const response = await app.request("/v1/businesses/members", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ ...addCommand, ...change }),
      });
      const body = await response.text();
      expect(response.status).toBe(400);
      expect(JSON.parse(body)).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(body).not.toContain(password);
    }
  });

  test("maps denial, conflicts and replays of a changed command", async () => {
    for (const [error, status] of [
      [new ProductError("FORBIDDEN", "The business membership does not permit this action"), 403],
      [new ProductError("CONFLICT", "That account already belongs to this business"), 409],
      [new ProductError("IDEMPOTENCY_CONFLICT", "That key was used for another change"), 409],
    ] as const) {
      const response = await createTestApp({
        addMember: async () => {
          throw error;
        },
      }).request("/v1/businesses/members", {
        method: "POST",
        headers: json,
        body: JSON.stringify(addCommand),
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ error: { code: error.code } });
    }
  });

  test("changes a role through PATCH and refuses ownership as a role", async () => {
    const received: unknown[] = [];
    const app = createTestApp({
      changeMemberRole: async (_actor, id, command) => {
        received.push({ id, command });
        return { member: { ...added, role: command.role }, replayed: false };
      },
    });
    const changed = await app.request(`/v1/businesses/members/${memberId}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ idempotencyKey, role: "admin" }),
    });
    const owner = await app.request(`/v1/businesses/members/${memberId}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ idempotencyKey, role: "owner" }),
    });
    const hidden = await app.request("/v1/businesses/members/not-a-uuid", {
      method: "PATCH",
      headers: json,
      body: "{",
    });

    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual({
      data: { member: { ...added, role: "admin" }, replayed: false },
    });
    expect(owner.status).toBe(400);
    expect(hidden.status).toBe(404);
    expect(received).toEqual([{ id: memberId, command: { idempotencyKey, role: "admin" } }]);
  });

  test("removes a member and maps the owner and self protections to 409", async () => {
    const removed = await createTestApp({
      removeMember: async (_actor, id) => ({ member: { ...added, id }, replayed: false }),
    }).request(`/v1/businesses/members/${memberId}/remove`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ idempotencyKey }),
    });
    const owner = await createTestApp({
      removeMember: async () => {
        throw new ProductError("CONFLICT", "The owner cannot be removed from the business");
      },
    }).request(`/v1/businesses/members/${memberId}/remove`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ idempotencyKey }),
    });
    const missingKey = await createTestApp({ removeMember: unexpected }).request(
      `/v1/businesses/members/${memberId}/remove`,
      { method: "POST", headers: json, body: JSON.stringify({}) },
    );

    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ data: { member: added, replayed: false } });
    expect(owner.status).toBe(409);
    expect(missingKey.status).toBe(400);
  });
});
