import { expect, test, type Page } from "@playwright/test";

const MODEL_BUTTON_REGEX = /QWEN|KIMI|DEEPSEEK/i;

const authSession = {
  user: {
    id: "user-1",
    email: "user@example.com",
    type: "regular",
  },
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 60_000,
};

async function bootstrapAuthenticatedApp(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("chatbot-auth-session", JSON.stringify(session));
  }, authSession);

  await page.route("**/api/models", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [
          {
            id: "qwen",
            name: "QWEN",
            provider: "qwen",
            description: "Qwen chat model",
            supportsReasoning: false,
            supportsTools: true,
          },
          {
            id: "kimi",
            name: "KIMI",
            provider: "kimi",
            description: "Kimi chat model",
            supportsReasoning: false,
            supportsTools: true,
          },
          {
            id: "deepseek",
            name: "DEEPSEEK",
            provider: "deepseek",
            description: "DeepSeek chat model",
            supportsReasoning: false,
            supportsTools: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ chats: [], hasMore: false }),
    });
  });
}

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedApp(page);
    await page.goto("/");
  });

  test("displays a model button", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await expect(modelButton).toBeVisible();
  });

  test("opens model selector popover on click", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  });

  test("can search for models", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    const searchInput = page.getByPlaceholder("Search models...");
    await searchInput.fill("KIMI");

    await expect(page.getByText("KIMI").first()).toBeVisible();
  });

  test("can close model selector by clicking escape", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
  });

  test("shows model provider groups", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByText("QWEN")).toBeVisible();
    await expect(page.getByText("KIMI")).toBeVisible();
    await expect(page.getByText("DeepSeek")).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await page.getByText("KIMI").first().click();
    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
    await expect(
      page.locator("button").filter({ hasText: "KIMI" }).first(),
    ).toBeVisible();
  });
});
