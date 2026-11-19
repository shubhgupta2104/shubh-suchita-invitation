import { test, expect, devices } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";
const { defaultBrowserType, ...phone } = devices["iPhone 15 Pro"];
const measurements = JSON.parse(await readFile(new URL("fixtures/opening-bounds.json", import.meta.url), "utf8"));
const viewports = [
  { width: 393, height: 659 },
  { width: 393, height: 700 },
  { width: 393, height: 759 },
  { width: 393, height: 852 },
  { width: 734, height: 343 }
];

for (const viewport of viewports) {
  test(`iPhone 15 Pro ${viewport.width}x${viewport.height} keeps venue text above the figure area`, async ({ browser }) => {
    const context = await browser.newContext({ ...phone, viewport });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4197/");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.fonts.ready);
    const measurement = measurements[viewport.width >= viewport.height ? "landscape" : "portrait"];
    const layout = await page.evaluate(async measurement => {
      const image = document.querySelector(".hero__scene");
      await image.decode();
      const frame = image.getBoundingClientRect();
      const venue = document.querySelector(".hero .hero__location").getBoundingClientRect();
      const heading = document.querySelector("h1").getBoundingClientRect();
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const cue = document.querySelector(".scroll-invitation").getBoundingClientRect();
      const [left, top, right, bottom] = measurement.bounds;
      const figures = {
        left: frame.x + frame.width * left, top: frame.y + frame.height * top,
        right: frame.x + frame.width * right, bottom: frame.y + frame.height * bottom
      };
      return {
        clearance: figures.top - venue.bottom,
        cueOverlap: Math.max(0, Math.min(cue.right, figures.right) - Math.max(cue.left, figures.left)) *
          Math.max(0, Math.min(cue.bottom, figures.bottom) - Math.max(cue.top, figures.top)),
        figures,
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        headingTop: heading.top,
        headerBottom: header.bottom,
        left: venue.left,
        right: venue.right,
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    }, measurement);
    expect(layout.clearance).toBeGreaterThanOrEqual(20);
    expect(layout.cueOverlap).toBe(0);
    expect(layout.figures.left).toBeGreaterThanOrEqual(0);
    expect(layout.figures.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.figures.bottom).toBeLessThanOrEqual(viewport.height);
    expect(layout.imageWidth).toBe(measurement.width);
    expect(layout.imageHeight).toBe(measurement.height);
    expect(layout.headingTop).toBeGreaterThanOrEqual(layout.headerBottom);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.overflow).toBe(false);
    await expect(page.locator(".site-header")).toHaveCSS("opacity", "1");
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: resolve(screenshots, `iphone-15-pro-${viewport.width}x${viewport.height}.png`) });
    await context.close();
  });
}

test("iPhone 15 Pro reveal text stays clear throughout its entrance motion", async ({ browser }) => {
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4197/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).toHaveClass(/has-scene-copy/);
  const clearance = await page.evaluate(top => {
    const frame = document.querySelector("video").getBoundingClientRect();
    const venue = document.querySelector(".entrance__reveal-copy .hero__location").getBoundingClientRect();
    return frame.top + frame.height * top - venue.bottom;
  }, measurements.portrait.bounds[1]);
  expect(clearance).toBeGreaterThanOrEqual(20);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await context.close();
});
