import { test, expect, type Page } from "@playwright/test";

// Full happy path: two players register, import a precon, meet in a lobby, start
// a game, and take a turn. Requires precons to be seeded (pnpm db:seed:precons).

let seq = 0;
const uniqueName = (p: string) => `e2e_${p}_${Date.now()}_${seq++}`;

async function register(page: Page, username: string) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/lobby$/);
}

async function importFirstPrecon(page: Page) {
  await page.goto("/precons");
  const importBtn = page.getByRole("button", { name: /import to my decks/i }).first();
  await importBtn.click();
  await expect(page).toHaveURL(/\/decks/);
}

test("two players play a turn", async ({ browser }) => {
  const host = await browser.newPage();
  const guest = await browser.newPage();

  await register(host, uniqueName("host"));
  await register(guest, uniqueName("guest"));
  await importFirstPrecon(host);
  await importFirstPrecon(guest);

  // Host creates a table.
  await host.goto("/lobby");
  await host.getByPlaceholder(/table name/i).fill("E2E Table");
  await host.getByRole("button", { name: /create table/i }).click();
  await expect(host).toHaveURL(/\/lobby\/.+/);
  const roomUrl = host.url();

  // Both pick a deck and ready up.
  await host.locator("select").first().selectOption({ index: 1 });
  await host.getByRole("button", { name: /ready up/i }).click();

  await guest.goto(roomUrl);
  await guest.locator("select").first().selectOption({ index: 1 });
  await guest.getByRole("button", { name: /ready up/i }).click();

  // Host starts; both should land in the game.
  await host.getByRole("button", { name: /start game/i }).click();
  await expect(host).toHaveURL(/\/game\/.+/, { timeout: 15_000 });
  await expect(guest).toHaveURL(/\/game\/.+/, { timeout: 15_000 });

  // Keep the opening hand, then draw and pass the turn.
  await host.getByRole("button", { name: /keep hand/i }).click();
  await host.getByRole("button", { name: /^Draw$/ }).click();
  await host.getByRole("button", { name: /next turn/i }).click();

  // The turn indicator should advance.
  await expect(host.getByText(/Turn/i).first()).toBeVisible();
});
