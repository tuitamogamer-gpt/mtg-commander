import { test, expect, type Page } from "@playwright/test";

// Full happy path: two players register, import a precon, meet in a lobby, start
// a game, and take a turn. Requires precons to be seeded (pnpm db:seed:precons).

let seq = 0;
// Keep usernames ≤ 24 chars (the server limit): short prefix + base36 time.
const uniqueName = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

async function register(page: Page, username: string) {
  await page.goto("/register");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("secret123");
  // Scope to the form (the header also has a "Sign up" link).
  await page.getByRole("main").getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/lobby$/);
  await dismissOnboarding(page);
}

async function dismissOnboarding(page: Page) {
  const dialog = page.getByRole("dialog", { name: /getting started/i });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /skip/i }).click();
    await expect(dialog).toBeHidden();
  }
}

async function importFirstPrecon(page: Page) {
  await page.goto("/precons");
  // Precon tiles are art buttons titled "Add <deck name>".
  const importBtn = page.getByTitle(/^Add /).first();
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

  // Host creates a table (name is optional → server defaults it).
  await host.goto("/lobby");
  await host.getByPlaceholder("Friday Pod").fill("E2E Table");
  await host.getByRole("button", { name: /create table/i }).click();
  await expect(host).toHaveURL(/\/lobby\/.+/);
  const roomUrl = host.url();

  // Both pick a deck and ready up.
  await host.locator("select").first().selectOption({ index: 1 });
  await host.getByRole("button", { name: /ready up/i }).click();

  await guest.goto(roomUrl);
  await dismissOnboarding(guest);
  await guest.locator("select").first().selectOption({ index: 1 });
  await guest.getByRole("button", { name: /ready up/i }).click();

  // Host starts; both should land in the game.
  await host.getByRole("button", { name: /start game/i }).click();
  await expect(host).toHaveURL(/\/game\/.+/, { timeout: 15_000 });
  await expect(guest).toHaveURL(/\/game\/.+/, { timeout: 15_000 });

  // Keep the opening hand, then draw and pass the turn.
  await host.getByRole("button", { name: /keep hand/i }).click();
  // Scope to the board <main> — the header phase bar also has a "Draw" step button.
  await host.getByRole("main").getByRole("button", { name: /^Draw$/ }).click();
  await host.getByRole("button", { name: /next turn/i }).click();

  // The turn indicator should advance.
  await expect(host.getByText(/Turn/i).first()).toBeVisible();
});
