import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { embeddedForm, prefilledForm } from "./fixtures/rsvp.mjs";

const artwork = JSON.parse(await readFile(new URL("fixtures/rsvp-artwork.json", import.meta.url), "utf8"));
test.beforeEach(async ({ context }) => {
  await context.route("https://docs.google.com/**", route => route.fulfill({
    contentType: "text/html", body: '<!doctype html><title>Local form fixture</title><label>Guest name <input></label>'
  }));
});

async function expectReadableLetter(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".rsvp__art img")].map(image => image.decode()));
  });
  const layout = await page.locator(".rsvp__card").evaluate(card => {
    const box = card.getBoundingClientRect();
    const letter = card.querySelector(".rsvp__letter");
    const extension = card.querySelector(".rsvp__letter-extension").getBoundingClientRect().height;
    const errors = [];
    const walker = document.createTreeWalker(letter, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1) continue;
        const bottom = rect.bottom - box.y;
        const topHeight = box.width * 265 / 960;
        const sourceY = bottom <= topHeight ? bottom * 1448 / box.width
          : bottom <= topHeight + extension ? 400 : (bottom - extension) * 1448 / box.width;
        const left = Math.max(390, 318 + 1.25 * (sourceY - 439));
        const right = Math.min(1060, 1134 - 1.25 * (sourceY - 439));
        const sourceLeft = (rect.left - box.x) * 1448 / box.width;
        const sourceRight = (rect.right - box.x) * 1448 / box.width;
        if (sourceLeft < left - 4 || sourceRight > right + 4 || sourceY > 630) {
          errors.push({ text: node.textContent, sourceY, sourceLeft, sourceRight, left, right });
        }
      }
    }
    return {
      errors,
      fonts: [...letter.querySelectorAll("h2, p, strong")].map(element => ({
        tag: element.tagName, size: parseFloat(getComputedStyle(element).fontSize)
      })),
      images: [...card.querySelectorAll("img")].map(image => ({
        ratio: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
        expected: image.naturalWidth / image.naturalHeight
      }))
    };
  });
  expect(layout.errors).toEqual([]);
  for (const font of layout.fonts) expect(font.size).toBeGreaterThanOrEqual(font.tag === "H2" ? 20 : 12);
  for (const image of layout.images) expect(image.ratio).toBeCloseTo(image.expected, 2);
}

for (const viewport of [
  { width: 320, height: 568 }, { width: 393, height: 659 }, { width: 393, height: 700 },
  { width: 393, height: 759 }, { width: 393, height: 852 }, { width: 1440, height: 1000 }
]) {
  test(`envelope leads to the form with one fallback link below at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const imageRequests = [];
    page.on("request", request => {
      if (/rsvp-envelope-(?:top|middle|bottom)\.webp/.test(request.url())) imageRequests.push(request.url());
    });
    await page.goto("/");
    expect(imageRequests).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "RSVP", exact: true }).click();
    await page.evaluate(() => Promise.all([...document.querySelectorAll(".rsvp__art img")].map(image => image.decode())));
    await expectReadableLetter(page);
    const card = await page.locator(".rsvp__card").boundingBox();
    const header = await page.locator(".site-header").boundingBox();
    await expect(page.locator("#rsvp").getByRole("link")).toHaveCount(1);
    expect(card.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(card.y + card.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByRole("heading", { name: "Will you join us?" })).toBeInViewport();
    await expect(page.locator("#rsvp-link")).toHaveAttribute("href", prefilledForm);
    await expect(page.locator("iframe")).toHaveAttribute("src", embeddedForm);
    const form = await page.locator("#rsvp-embed iframe").boundingBox();
    const fallback = await page.locator(".rsvp__help a").boundingBox();
    expect(form.y).toBeGreaterThanOrEqual(card.y + card.height);
    expect(fallback.y).toBeGreaterThanOrEqual(form.y + form.height);
    expect(fallback.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".rsvp__signature")).toHaveText("With love,Shubh & Suchita");
    await expect(page.locator(".rsvp__details time")).toHaveAttribute("datetime", "2027-01-26");
    await expect(page.locator(".rsvp")).not.toContainText(/Oreo|Zylo|humans|furry family|Please follow the/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page.locator("#rsvp")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.frameLocator("#rsvp-embed iframe").getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#rsvp-link")).toBeFocused();
  });
}

test("the envelope remains readable at 200 percent zoom", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.goto("/#rsvp");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await page.keyboard.press("Escape");
  await expectReadableLetter(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("the fallback below the embedded RSVP opens the prefilled form", async ({ page }) => {
  await page.goto("/#rsvp");
  await page.keyboard.press("Escape");
  await expect(page.locator("#rsvp")).toBeFocused();
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#rsvp-link").click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(prefilledForm);
  await expect(popup).toHaveTitle("Local form fixture");
  await popup.close();
});

test("reduced motion and high contrast retain all live invitation text", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/#rsvp");
  await page.keyboard.press("Escape");
  await expect(page.locator(".rsvp__art")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Will you join us?" })).toBeVisible();
  await expect(page.locator(".rsvp__signature")).toBeVisible();
  const styles = await page.locator(".rsvp__card").evaluate(card => ({
    color: getComputedStyle(card.querySelector("h2")).color,
    background: getComputedStyle(card).backgroundColor,
    running: card.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length
  }));
  expect(styles.color).not.toBe(styles.background);
  expect(styles.running).toBe(0);
  await expect(page.locator("#rsvp-link")).toHaveAttribute("href", prefilledForm);
});

test("missing artwork does not hide the invitation text or block RSVP", async ({ page }) => {
  await page.route("**/rsvp-envelope-*.webp*", route => route.abort());
  await page.goto("/#rsvp");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Will you join us?" })).toBeVisible();
  await expect(page.locator(".rsvp__signature")).toBeVisible();
  await expect(page.locator("#rsvp-link")).toBeVisible();
  await expect(page.locator("#rsvp-link")).toHaveAttribute("href", prefilledForm);
});

test("only derived WebP layers are served, not private concept or authoring files", async ({ request }) => {
  for (const asset of artwork.assets) {
    const response = await request.get(`/${asset.path}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/webp");
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(asset.sha256);
  }
  for (const path of ["/server.mjs", "/rsvp-envelope/approved-concept.png", "/assets/artwork/approved-concept.png", "/prepare_envelope_art.mjs"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
