import { expect, test } from "@playwright/test";

test("login rejects bad credentials and keeps account state visible", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("invalid@thueradar.local");
  await page.getByLabel("Mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Invalid credentials")).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin.test@thueradar.local");
  await page.getByLabel("Mật khẩu").fill("Password123!");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Quản trị ThueRadar" })).toBeVisible();
  await page.getByRole("button", { name: "Quản trị viên" }).click();
  await expect(page.getByText("admin.test@thueradar.local")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/$/);
});
