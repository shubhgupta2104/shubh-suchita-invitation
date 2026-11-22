import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";
test.beforeEach(async ({ context }) => {
  await context.route("https://docs.google.com/**", route => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Local form fixture</title><p>RSVP fixture</p>"
  }));
});

async function open(page) {
  await page.goto("/");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(".invitation").evaluate(element =>
    getComputedStyle(element, "::before").opacity
  )).toBe("0.82");
}

test("page glimmer follows scroll, stays still at rest and does not intercept navigation", async ({ page }) => {
  await page.goto("/");
  expect(await page.locator(".invitation").evaluate(element => getComputedStyle(element, "::before").opacity)).toBe("0");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.locator(".invitation").evaluate(element => getComputedStyle(element, "::before").opacity)).toBe("0.82");
  const paint = () => page.locator(".invitation").evaluate(element => ({
    supported: CSS.supports("animation-timeline", "scroll(root block)"),
    translate: getComputedStyle(element, "::before").translate,
    pointerEvents: getComputedStyle(element, "::before").pointerEvents
  }));
  const before = await paint();
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  if (before.supported) await expect.poll(async () => (await paint()).translate).not.toBe(before.translate);
  const settled = await paint();
  expect(settled.pointerEvents).toBe("none");
  await page.waitForTimeout(300);
  expect((await paint()).translate).toBe(settled.translate);
  await page.getByRole("link", { name: "RSVP", exact: true }).click();
  await expect(page.locator("#rsvp")).toBeInViewport();
});

test("sparkles affect only a sparse part of the page edges, not central text", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.clock.setFixedTime(new Date("2026-11-18T13:08:17Z"));
  await open(page);
  await page.locator(".programme").scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const withGlitter = await page.screenshot();
  await page.addStyleTag({ content: ".invitation::before, .invitation::after { display: none !important; }" });
  const withoutGlitter = await page.screenshot();
  const difference = await page.evaluate(async ({ before, after }) => {
    const images = await Promise.all([before, after].map(async encoded => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      return image;
    }));
    const canvas = document.createElement("canvas");
    canvas.width = images[0].width;
    canvas.height = images[0].height;
    const ctx = canvas.getContext("2d");
    const pixels = images.map(image => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    });
    let changed = 0, centre = 0;
    for (let index = 0; index < pixels[0].length; index += 4) {
      const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(pixels[0][index + channel] - pixels[1][index + channel])));
      if (delta <= 2) continue;
      changed++;
      const x = index / 4 % canvas.width;
      if (x > canvas.width * .1 && x < canvas.width * .9) centre++;
    }
    return { changed, centre, fraction: changed / (canvas.width * canvas.height) };
  }, { before: withGlitter.toString("base64"), after: withoutGlitter.toString("base64") });
  console.log("Page glimmer coverage:", difference);
  expect(difference.changed).toBeGreaterThan(900);
  expect(difference.fraction).toBeLessThan(.01);
  expect(difference.centre).toBe(0);
});

for (const media of [{ reducedMotion: "reduce" }, { forcedColors: "active" }]) {
  test(`page glimmer is disabled for ${Object.keys(media)[0]}`, async ({ page }) => {
    await page.emulateMedia(media);
    await page.goto("/");
    await page.keyboard.press("Escape");
    const styles = await page.locator(".invitation").evaluate(element =>
      ["::before", "::after"].map(pseudo => ({
        display: getComputedStyle(element, pseudo).display,
        animation: getComputedStyle(element, pseudo).animationName
      }))
    );
    expect(styles).toEqual([{ display: "none", animation: "none" }, { display: "none", animation: "none" }]);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 1440, height: 1000 }]) {
  test(`full floral banners fit without clipping or overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const images = page.locator(".day-interlude img");
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      expect(await image.evaluate(async img => {
        await img.decode();
        return [img.naturalWidth, img.naturalHeight];
      })).toEqual([1200, 300]);
      const bounds = await image.boundingBox();
      expect(bounds.height / bounds.width).toBeCloseTo(.25, 2);
    }
    for (const banner of await page.locator(".day-interlude img, .countdown__garland").all()) {
      const bounds = await banner.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("the supplied logo appears in both placements and the old RSVP reminder is gone", async ({ page }) => {
  await open(page);
  await expect(page.locator(".rsvp")).not.toContainText("Please follow the");
  await expect(page.getByRole("link", { name: "schedule above" })).toHaveCount(0);
  await expect(page.locator('[data-event="gala-dinner"] time')).toHaveText("8:00 PM");
  await expect(page.locator('[data-event="gala-dinner"] time')).toHaveAttribute("datetime", "2027-01-26T20:00:00+05:30");
  await mkdir(screenshots, { recursive: true });
  for (const selector of [".wordmark img", "footer img"]) {
    const image = page.locator(selector);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", "assets/artwork/monogram.jpg?v=logo-v2");
    expect(await image.evaluate(async image => {
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    })).toEqual([400, 400]);
  }
  await page.locator("footer").screenshot({ path: resolve(screenshots, "new-logo-footer.png") });
  await page.getByRole("link", { name: "Shubh and Suchita, back to top" }).click();
  await page.locator(".site-header").screenshot({ path: resolve(screenshots, "new-logo-header.png") });
});
