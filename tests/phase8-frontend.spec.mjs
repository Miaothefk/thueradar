import { test, expect } from "@playwright/test";

test("visitor can move through core pages without fabricated success state", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ThueRadar/);
  await page.getByRole("link", { name: /văn bản|tra cứu/i }).first().click();
  await expect(page).toHaveURL(/\/documents/);
  await expect(page.getByText(/database|chưa có dữ liệu|đang tải/i).first()).toBeVisible();

  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: /Hỏi đáp pháp luật thuế/i })).toBeVisible();
  await page.getByRole("button", { name: /Gửi câu hỏi/i }).isDisabled();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  await expect(page.getByText(/Database|đăng nhập|Chưa có thông báo/i)).toBeVisible();
});
