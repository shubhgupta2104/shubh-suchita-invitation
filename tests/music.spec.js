import { test, expect } from "@playwright/test";

const soundtrack = "/assets/audio/ivory-evening.m4a";

async function openWithMusic(page) {
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.currentTime)).toBeGreaterThan(0.1);
}

test("music is lazy, user-started, looped and reset by refresh", async ({ page }) => {
  const musicRequests = [];
  page.on("request", (request) => {
    if (request.url().includes(soundtrack)) musicRequests.push(request.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  expect(musicRequests).toEqual([]);
  await expect(page.locator(".seal-caption")).toHaveText("Open our invitation");
  await expect(page.locator("audio[controls], audio[autoplay]")).toHaveCount(0);
  await openWithMusic(page);
  const media = await page.locator("audio").evaluate((audio) => ({
    paused: audio.paused, duration: audio.duration, volume: audio.volume, loop: audio.loop
  }));
  expect(media.paused).toBe(false);
  // Chromium's media duration includes AAC padding; decoded PCM is checked separately.
  expect(media.duration).toBeGreaterThanOrEqual(51.2);
  expect(media.duration).toBeLessThan(51.35);
  expect(media.volume).toBe(0.65);
  expect(media.loop).toBe(true);
  await page.locator("#schedule").scrollIntoViewIfNeeded();
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(false);
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  expect(await page.locator("audio").evaluate((audio) => audio.paused && audio.currentTime === 0)).toBe(true);
});

test("Escape and script failure keep the soundtrack silent", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  await page.route("**/app.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
});

test("hidden tabs pause music and restored documents wait for the crest", async ({ page }) => {
  await page.goto("/");
  await openWithMusic(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.paused)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.locator("audio").evaluate((audio) => audio.paused && audio.currentTime === 0)).toBe(true);
});

test("audio failure cannot block the invitation", async ({ page }) => {
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.route(`**${soundtrack}`, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await expect(page.locator("#schedule")).toBeInViewport();
  await expect.poll(() => warnings.some((message) => message.includes("Invitation music could not"))).toBe(true);
});

test("returning during the curtain animation resumes music after the reveal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  const duringReveal = await page.evaluate(() => {
    const opening = document.querySelector("dialog").classList.contains("is-opening");
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
    return opening;
  });
  expect(duringReveal).toBe(true);
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect.poll(() => page.locator("audio").evaluate((audio) => !audio.paused && audio.currentTime > 0.1)).toBe(true);
});

test("the encoded recording decodes to stereo with safe levels and a smooth loop boundary", async ({ page }) => {
  await page.goto("/");
  const audio = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const context = new OfflineAudioContext(2, 1, 32000);
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    let peak = 0;
    let squares = 0;
    let boundary = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const samples = decoded.getChannelData(channel);
      boundary = Math.max(boundary, Math.abs(samples[0] - samples[samples.length - 1]));
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
        squares += sample * sample;
      }
    }
    return {
      channels: decoded.numberOfChannels, duration: decoded.duration,
      peak, rms: Math.sqrt(squares / (decoded.length * decoded.numberOfChannels)), boundary
    };
  }, soundtrack);
  console.log("Decoded soundtrack:", JSON.stringify(audio));
  expect(audio.channels).toBe(2);
  expect(audio.duration).toBeCloseTo(51.2, 1);
  expect(audio.peak).toBeLessThan(0.6);
  expect(audio.rms).toBeGreaterThan(0.03);
  expect(audio.rms).toBeLessThan(0.15);
  expect(audio.boundary).toBeLessThan(0.03);
});

test("audio delivery supports browser byte ranges and rejects invalid requests", async ({ request }) => {
  const full = await request.get(soundtrack);
  const bytes = await full.body();
  expect(full.headers()["content-type"]).toBe("audio/mp4");
  expect(full.headers()["accept-ranges"]).toBe("bytes");
  const prefix = await request.get(soundtrack, { headers: { Range: "bytes=0-31" } });
  expect(prefix.status()).toBe(206);
  expect(prefix.headers()["content-range"]).toBe(`bytes 0-31/${bytes.length}`);
  expect(await prefix.body()).toEqual(bytes.subarray(0, 32));
  const suffix = await request.get(soundtrack, { headers: { Range: "bytes=-16" } });
  expect(suffix.status()).toBe(206);
  expect(await suffix.body()).toEqual(bytes.subarray(-16));
  const remainder = await request.get(soundtrack, { headers: { Range: "bytes=1000-" } });
  expect(remainder.status()).toBe(206);
  expect(await remainder.body()).toEqual(bytes.subarray(1000));
  for (const range of ["bytes=9000000-", "bytes=-0", "bytes=-", "bytes=8-2", "bytes=0-1,4-5"]) {
    expect((await request.get(soundtrack, { headers: { Range: range } })).status()).toBe(416);
  }
  expect((await request.get("/tools/render_music.py")).status()).toBe(404);
});
