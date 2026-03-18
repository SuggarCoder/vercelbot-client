import { expect, test, type Page } from "@playwright/test";

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

test.describe("Chat Page", () => {
  test("home page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  });

  test("home page loads with input field after auth bootstrap", async ({ page }) => {
    await bootstrapAuthenticatedApp(page);
    await page.goto("/");
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
  });

  test("can type in the input field", async ({ page }) => {
    await bootstrapAuthenticatedApp(page);
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Hello world");
    await expect(input).toHaveValue("Hello world");
  });

  test("submit button is visible", async ({ page }) => {
    await bootstrapAuthenticatedApp(page);
    await page.goto("/");
    await expect(page.getByTestId("send-button")).toBeVisible();
  });

  test("suggested actions are visible on empty chat", async ({ page }) => {
    await bootstrapAuthenticatedApp(page);
    await page.goto("/");
    await expect(page.getByTestId("suggested-actions")).toBeVisible();
  });
});
