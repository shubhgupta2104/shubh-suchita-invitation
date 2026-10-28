import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";
const root = new URL("../", import.meta.url);

const formFixture = (route) => route.fulfill({
  contentType: "text/html",
  body: "<!doctype html><html lang=\"en\"><title>RSVP fixture</title><body><h1>RSVP form fixture</h1></body></html>"
});

test.beforeEach(async ({ context }) => {
  await context.route("https://docs.google.com/forms/**", formFixture);
});

async function open(page, skip = true) {
  if (skip) await page.keyboard.press("Escape");
  else await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
}

test("closed entrance, keyboard trap, animated opening and focus", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator("#entrance-welcome")).toContainText("we warmly invite you to our wedding.");
  await expect(page.locator("dialog")).toHaveAttribute("aria-describedby", "entrance-welcome entrance-description");
  await expect(page.getByRole("button", { name: "Open invitation" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("dialog button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Open invitation" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Open invitation" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("h1")).toBeFocused();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("Escape opens without animation and restores native scrolling and focus", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await expect(page.locator("h1")).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  await page.reload();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("h1")).toBeFocused();
});

test("refresh after a mid-page scroll always returns to closed curtains at the top", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await page.locator("#day-two").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await open(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("hash destination is deferred until opening, including refresh and malformed hashes", async ({ page }) => {
  await page.goto("/#schedule");
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await open(page);
  await expect(page.locator("#schedule")).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await open(page);
  await expect(page.locator("#schedule")).toBeFocused();
  await page.goto("/?fresh-document=1#%E0%A4%A");
  await open(page);
  await expect(page.locator("h1")).toBeFocused();
});

test("reduced motion retains the entrance and opens without moving curtains", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.locator(".curtain").first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  await open(page, false);
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("disabled JavaScript leaves all content and directions usable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4197");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('[data-kind="function"]')).toHaveCount(4);
  await expect(page.locator('[data-kind="meal"]')).toHaveCount(6);
  await expect(page.locator(".countdown__numbers")).not.toBeVisible();
  await expect(page.locator(".countdown__fallback")).toHaveText("A date to hold close.");
  await expect(page.locator("#rsvp-link")).toHaveAttribute("href", /\/viewform$/);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Find your way/ })).toHaveAttribute("href", "https://maps.app.goo.gl/PL4M48uGDFwTjAJs6");
  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await expect(page.locator("#schedule")).toBeInViewport();
  await context.close();
});

test("failed JavaScript never covers or locks the invitation", async ({ page }) => {
  await page.route("**/app.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await expect(page.locator("#rsvp-link")).toBeVisible();
  await expect(page.locator(".rsvp__pending")).not.toBeVisible();
});

test("canonical programme and approved RSVP are present without console errors", async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await open(page);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.locator("#rsvp-link")).toHaveAttribute("href", /\/viewform$/);
  await expect(page.locator(".rsvp__pending")).not.toBeVisible();
  await expect(page.locator('[data-kind="function"] h4')).toHaveText(["Haldi", "Ring Ceremonyand Sangeet", "Baraat", "Phere"]);
  await expect(page.locator('[data-kind="meal"] > span')).toHaveText(["Breakfast", "Lunch", "Dinner", "Breakfast", "Lunch", "Dinner"]);
  expect(requests.every((url) => url.startsWith("http://127.0.0.1:4197/") || url.startsWith("https://docs.google.com/forms/"))).toBe(true);
  expect(errors).toEqual([]);
});

test("form integration lazy-loads an iframe and retains a separate-tab fallback", async ({ page }) => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const fixture = "https://docs.google.com/forms/d/e/TEST_ONLY_NOT_A_REAL_FORM/viewform";
  await page.route("**/docs.google.com/**", (route) => route.abort());
  await page.route("http://127.0.0.1:4197/", (route) => route.fulfill({
    contentType: "text/html",
    body: html.replace(/href="https:\/\/docs\.google\.com\/forms\/[^"]+"/, `href="${fixture}"`)
  }));
  await page.goto("/");
  await open(page);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await expect(page.locator("iframe")).toHaveAttribute("src", `${fixture}?embedded=true`);
  await expect(page.locator("#rsvp-link")).toHaveAttribute("href", fixture);
  await expect(page.locator("#rsvp-link")).toHaveAttribute("target", "_blank");
  await expect(page.getByText("If the form does not load below", { exact: false })).toBeVisible();
  await expect(page.locator(".rsvp__pending")).not.toBeVisible();
});

test("invalid form URL fails visibly and never creates an iframe", async ({ page }) => {
  const html = await readFile(new URL("index.html", root), "utf8");
  await page.route("http://127.0.0.1:4197/", (route) => route.fulfill({
    contentType: "text/html",
    body: html.replace(/href="https:\/\/docs\.google\.com\/forms\/[^"]+"/, 'href="https://example.invalid/form"')
  }));
  await page.goto("/");
  await open(page);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".rsvp__pending")).toHaveText("The RSVP link is unavailable. Please contact the hosts.");
});

test("only intended public files can be served", async ({ request }) => {
  for (const path of ["/package.json", "/README.md", "/server.mjs", "/tests/invitation.spec.js", "/assets/", "/../plan.md", "/%2e%2e/plan.md"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`${width}px layout has no sideways overflow and captures rendered proof`, async ({ page }) => {
    await mkdir(screenshots, { recursive: true });
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#entrance-welcome")).toBeInViewport();
    const welcomeBounds = await page.locator("#entrance-welcome").boundingBox();
    expect(welcomeBounds.x).toBeGreaterThanOrEqual(0);
    expect(welcomeBounds.x + welcomeBounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: resolve(screenshots, `curtain-${width}.png`) });
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    const invitationFont = await page.locator(".hero__intro").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(invitationFont).toBeGreaterThanOrEqual(width <= 350 ? 10 : width <= 700 ? 11 : 12);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const clippedText = await page.evaluate(() => [...document.querySelectorAll(
      ".hero__copy p, .parentage, .function h4, .function p, .rsvp__pending"
    )].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > innerWidth;
    }).map((element) => element.textContent));
    expect(clippedText).toEqual([]);
    await page.screenshot({ path: resolve(screenshots, `hero-${width}.png`) });
    await page.evaluate(() => window.scrollTo(0, 580));
    await page.screenshot({ path: resolve(screenshots, `transition-${width}.png`) });
    await page.locator("#day-one").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `programme-${width}.png`) });
    await page.locator(".countdown").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `countdown-${width}.png`) });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `closing-${width}.png`) });
    await page.screenshot({ path: resolve(screenshots, `full-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  });
}

test("200 percent layout zoom preserves controls, content and native scroll", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expect(page.getByRole("button", { name: "Open invitation" })).toBeVisible();
  await open(page);
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await expect(page.locator("#rsvp-link")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(screenshots, "zoom-200.png") });
});

test("touch opening and all navigation anchors work without forced scrolling", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  await context.route("https://docs.google.com/forms/**", formFixture);
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4197");
  await page.getByRole("button", { name: "Open invitation" }).tap();
  await expect(page.locator("dialog")).not.toBeVisible();
  for (const [label, target] of [["Schedule", "#schedule"], ["Venue", "#venue"], ["RSVP", "#rsvp"]]) {
    await page.getByRole("link", { name: label, exact: true }).tap();
    await expect(page.locator(target)).toBeInViewport();
  }
  await context.close();
});

test("capture the curtain parting over the real hero", async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Open invitation" }).click();
  await page.waitForTimeout(650);
  await page.screenshot({ path: resolve(screenshots, "reveal-390.png") });
  await expect(page.locator("dialog")).not.toBeVisible();
});

test("initial first-party transfer and post-opening layout shifts stay bounded", async ({ page }) => {
  await page.addInitScript(() => {
    window.layoutShiftScore = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.layoutShiftScore += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await open(page);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  const metrics = await page.evaluate(() => ({
    transferBytes: performance.getEntriesByType("resource").reduce((sum, item) => sum + item.transferSize, 0)
      + performance.getEntriesByType("navigation")[0].transferSize,
    layoutShiftScore: window.layoutShiftScore
  }));
  console.log("Measured page metrics:", JSON.stringify(metrics));
  expect(metrics.transferBytes).toBeLessThan(1_500_000);
  expect(metrics.layoutShiftScore).toBeLessThan(0.1);
});

test("monogram returns to the complete top scene without heading outlines", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await expect(page.locator(".wordmark")).toHaveText("");
  await expect(page.locator(".wordmark img")).toHaveAttribute("src", "assets/artwork/monogram.jpg");
  await expect(page.getByRole("img", { name: "Shubh and Suchita's logo", exact: true })).toBeVisible();
  await page.locator("#day-two").scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "Shubh and Suchita, back to top" }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".hero__valance")).toBeInViewport();
  expect(await page.locator("h1").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("countdown uses the confirmed Phere timestamp and updates only while visible", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-01-25T10:29:55Z"));
  await page.goto("/");
  await open(page);
  await page.locator(".countdown").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-unit="days"]')).toHaveText("01");
  await expect(page.locator('[data-unit="hours"]')).toHaveText("00");
  await expect(page.locator('[data-unit="minutes"]')).toHaveText("00");
  await expect(page.locator('[data-unit="seconds"]')).toHaveText("05");
  await page.clock.setFixedTime(new Date("2027-01-25T10:29:57Z"));
  await expect(page.locator('[data-unit="seconds"]')).toHaveText("03");
  await page.locator("#day-two").scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const prior = await page.locator('[data-unit="seconds"]').textContent();
  await page.clock.setFixedTime(new Date("2027-01-25T10:29:59Z"));
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-unit="seconds"]')).toHaveText(prior);
  await page.locator(".countdown").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-unit="seconds"]')).toHaveText("01");
});

test("countdown never becomes negative after the wedding", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-01-26T10:30:01Z"));
  await page.goto("/");
  await open(page);
  await expect(page.locator(".countdown__numbers")).toBeHidden();
  await expect(page.locator(".countdown__fallback")).toHaveText("Celebrating Shubh & Suchita.");
});

test("relative assets, entrance and RSVP work under a GitHub Pages project path", async ({ page }) => {
  const prefix = "/invitation/";
  await page.route(`http://127.0.0.1:4197${prefix}**`, async (route) => {
    const upstream = route.request().url().replace(prefix, "/");
    await route.fulfill({ response: await route.fetch({ url: upstream }) });
  });
  await page.goto(prefix);
  await open(page);
  await page.getByRole("link", { name: "RSVP", exact: true }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /viewform\?embedded=true$/);
  expect(await page.evaluate(() => [...document.images].filter((image) => image.complete).every((image) => image.naturalWidth > 0))).toBe(true);
  await expect(page.locator("#rsvp-link")).toBeVisible();
});
