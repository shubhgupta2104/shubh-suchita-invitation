import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("https://docs.google.com/**", route => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Local form fixture</title><p>RSVP fixture</p>"
  }));
});

test("section dividers use quiet rules without loading the removed pattern", async ({ page, request }) => {
  await page.setViewportSize({ width: 393, height: 659 });
  const patternRequests = [];
  page.on("request", request => {
    if (request.url().includes("embroidery.svg")) patternRequests.push(request.url());
  });
  await page.goto("/");
  await page.keyboard.press("Escape");
  await expect(page.locator(".embroidered-divider")).toHaveCount(0);
  const dividers = page.locator(".section-divider");
  await expect(dividers).toHaveCount(3);
  for (const divider of await dividers.all()) {
    await divider.scrollIntoViewIfNeeded();
    await expect(divider).toHaveAttribute("aria-hidden", "true");
    const style = await divider.evaluate(element => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      background: getComputedStyle(element).backgroundImage
    }));
    expect(style.width).toBeLessThanOrEqual(80);
    expect(style.height).toBeLessThanOrEqual(1);
    expect(style.background).not.toContain("url(");
  }
  expect(patternRequests).toEqual([]);
  expect((await request.get("/assets/artwork/embroidery.svg")).status()).toBe(404);
});

for (const viewport of [
  { width: 320, height: 568 }, { width: 393, height: 659 }, { width: 393, height: 852 },
  { width: 734, height: 343 }, { width: 1440, height: 1000 }
]) {
  test(`richer sections keep text and controls within ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("navigation", { name: "Invitation" }).getByRole("link")).toHaveText(["Venue", "RSVP"]);
    const navigation = await page.locator(".site-header nav a").evaluateAll(links => links.map(link => ({
      width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height,
      left: link.getBoundingClientRect().left, right: link.getBoundingClientRect().right,
      font: parseFloat(getComputedStyle(link).fontSize), border: parseFloat(getComputedStyle(link).borderTopWidth)
    })));
    const logo = await page.locator(".wordmark").boundingBox();
    for (const link of navigation) {
      expect(link.width).toBeGreaterThanOrEqual(60);
      expect(link.height).toBeGreaterThanOrEqual(44);
      expect(link.font).toBeGreaterThanOrEqual(13);
      expect(link.border).toBeGreaterThan(0);
      expect(link.left).toBeGreaterThan(logo.x + logo.width);
      expect(link.right).toBeLessThanOrEqual(viewport.width);
    }
    await expect(page.locator('[data-event="phere"] time')).toHaveText("4:00 PM");
    const layout = await page.evaluate(() => {
      const failures = [];
      for (const element of document.querySelectorAll(".welcome h2, .welcome__message, .day h3, .function, .rsvp__help, footer summary")) {
        const bounds = element.getBoundingClientRect();
        if (bounds.left < -.5 || bounds.right > innerWidth + .5 || element.scrollWidth > element.clientWidth + 1) {
          failures.push({ text: element.textContent, left: bounds.left, right: bounds.right,
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth });
        }
      }
      return { overflow: document.documentElement.scrollWidth > innerWidth, failures };
    });
    expect(layout).toEqual({ overflow: false, failures: [] });
    await page.locator("footer summary").click();
    await expect(page.locator("footer .artwork-credit p")).toBeVisible();
    await page.getByRole("link", { name: "Shubh and Suchita, back to top" }).click();
    await expect(page.locator(".hero__scene")).toBeInViewport();
  });
}

test("the gilt frame never intercepts the opening and matches the final stage frame", async ({ page }) => {
  await page.goto("/");
  const firstFrame = await page.locator("dialog").evaluate(element => {
    const style = getComputedStyle(element, "::after");
    return { top: style.top, right: style.right, bottom: style.bottom, left: style.left,
      width: style.width, height: style.height, pointerEvents: style.pointerEvents };
  });
  expect(firstFrame.pointerEvents).toBe("none");
  await page.mouse.click(14, 14);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  const finalFrame = await page.locator(".hero__stage").evaluate(element => {
    const style = getComputedStyle(element, "::after");
    return { top: style.top, right: style.right, bottom: style.bottom, left: style.left,
      width: style.width, height: style.height, pointerEvents: style.pointerEvents };
  });
  expect(finalFrame).toEqual(firstFrame);
});

test("foil lettering remains readable in forced-colour mode", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Escape");
  const names = page.locator(".hero .name");
  await expect(names).toHaveText(["Shubh", "Suchita"]);
  const paint = await names.evaluateAll(elements => elements.map(element => ({
    color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundImage,
    backplate: getComputedStyle(element).backgroundColor
  })));
  for (const item of paint) {
    expect(item.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(item.background).toBe("none");
    expect(item.color).not.toBe(item.backplate);
  }
  const parents = await page.locator(".hero .parentage__name").evaluateAll(elements => elements.map(element => ({
    color: getComputedStyle(element).color, background: getComputedStyle(element.parentElement).backgroundColor
  })));
  for (const parent of parents) expect(parent.color).not.toBe(parent.background);
  const linkPaint = await page.locator(".site-header nav a").evaluateAll(links => links.map(link => ({
    color: getComputedStyle(link).color, background: getComputedStyle(link).backgroundColor
  })));
  for (const link of linkPaint) expect(link.color).not.toBe(link.background);
});
