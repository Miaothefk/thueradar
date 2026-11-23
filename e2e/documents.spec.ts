import { expect, test } from "@playwright/test";

test("public document search loads database-backed cards", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Tra cứu pháp luật thuế" })).toBeVisible();
  await expect(page.getByText("Nguồn: database")).toBeVisible();
  await page.getByPlaceholder("Số hiệu, tiêu đề hoặc từ khóa").fill("8871");
  await expect(page.getByText(/văn bản từ cơ sở dữ liệu/)).toBeVisible();
});
