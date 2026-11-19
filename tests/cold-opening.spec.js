import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const moviePath = "**/curtain-reveal.mp4*";
const movie = await readFile(new URL("../assets/video/curtain-reveal.mp4", import.meta.url));
const closedPoster = await readFile(new URL("../assets/artwork/curtain-closed.jpg", import.meta.url));

test("the full fabric fallback stays in place until the curtain image has decoded", async ({ page }) => {
  await page.route("**/curtain-closed.jpg*", async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.fulfill({ contentType: "image/jpeg", body: closedPoster });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.locator("dialog").evaluate(element => getComputedStyle(element).getPropertyValue("--closed-curtain"))).toBe("none");
  expect(await page.locator("dialog").evaluate(element => getComputedStyle(element, "::before").backgroundImage)).toContain("repeating-linear-gradient");
  await expect(page.locator("video")).toHaveCSS("visibility", "hidden");
  await expect.poll(() => page.locator("dialog").evaluate(element => getComputedStyle(element).getPropertyValue("--closed-curtain"))).toContain("curtain-closed.jpg");
});

async function delayMovie(page, milliseconds) {
  await page.route(moviePath, async route => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    await route.fulfill({ contentType: "video/mp4", body: movie });
  });
}

test("an immediate tap waits for the whole cold movie and plays it completely", async ({ page }) => {
  await delayMovie(page, 8000);
  const warnings = [];
  const musicRequests = [];
  page.on("console", message => { if (message.type() === "warning") warnings.push(message.text()); });
  page.on("request", request => {
    if (request.url().includes("ishq-wala-love-instrumental-v3.m4a")) musicRequests.push(request.url());
  });
  await page.goto("/");
  await page.locator("video").evaluate(video => {
    window.openingEnded = false;
    video.addEventListener("ended", () => { window.openingEnded = true; });
  });
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator(".entrance__status")).toBeVisible();
  await expect(page.locator("video")).not.toHaveAttribute("src", /./);
  expect(musicRequests).toEqual([]);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 22000 });
  expect(await page.evaluate(() => window.openingEnded)).toBe(true);
  expect(musicRequests.length).toBeGreaterThan(0);
  await expect.poll(() => page.locator("audio").evaluate(audio => audio.currentTime)).toBeGreaterThan(.1);
  expect(warnings).toEqual([]);
});

test("a first tap on an empty-cache 1 Mbps connection completes the rear movie without stalls", async ({ page, context }) => {
  test.setTimeout(60000);
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.clearBrowserCache");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false, latency: 100, downloadThroughput: 125000, uploadThroughput: 125000
  });
  await page.route("https://docs.google.com/**", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("video").evaluate(video => {
    window.coldPlayback = { started: 0, ended: 0, stalls: 0 };
    video.addEventListener("playing", () => {
      if (!window.coldPlayback.started) window.coldPlayback.started = performance.now();
    });
    video.addEventListener("waiting", () => {
      if (window.coldPlayback.started) window.coldPlayback.stalls++;
    });
    video.addEventListener("ended", () => { window.coldPlayback.ended = performance.now(); });
  });
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator(".entrance__status")).toBeVisible();
  await expect(page.locator("video")).not.toHaveAttribute("src", /./);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 40000 });
  const playback = await page.evaluate(() => window.coldPlayback);
  expect(playback.started).toBeGreaterThan(0);
  expect(playback.ended - playback.started).toBeGreaterThan(6500);
  expect(playback.stalls).toBe(0);
});

test("leaving the tab while loading does not skip the reveal on return", async ({ page }) => {
  await delayMovie(page, 1800);
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(2200);
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator("video")).not.toHaveAttribute("src", /./);
  await page.evaluate(() => {
    window.openingEnded = false;
    document.querySelector("video").addEventListener("ended", () => { window.openingEnded = true; });
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  expect(await page.evaluate(() => window.openingEnded)).toBe(true);
});

test("a hidden tab pauses and resumes the same opening instead of jumping to the still", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.6);
  const pausedTime = await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    return document.querySelector("video").currentTime;
  });
  await page.waitForTimeout(400);
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.locator("video").evaluate(video => video.currentTime)).toBeCloseTo(pausedTime, 1);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(pausedTime + .2);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
});

test("Escape cancels preparation and late media cannot reopen the invitation", async ({ page }) => {
  await delayMovie(page, 1500);
  await page.addInitScript(() => {
    window.videoPlays = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === "VIDEO") window.videoPlays++;
      return play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.videoPlays)).toBe(0);
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  await expect(page.locator("video")).not.toHaveAttribute("src", /./);
});
