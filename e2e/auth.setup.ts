import { expect, test as setup } from "@playwright/test";
import { accounts, demoPassword } from "./environment.ts";

// One sign-in per role, reused by every spec: Better Auth allows three sign-ins per 10 seconds.
for (const [role, email] of Object.entries(accounts)) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
    await page.getByRole("textbox", { name: "Contraseña" }).fill(demoPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
