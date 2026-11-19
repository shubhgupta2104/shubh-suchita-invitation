import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const musicRecord = JSON.parse(await readFile(new URL("fixtures/music.json", import.meta.url), "utf8"));
const soundtrack = `/${musicRecord.output}`;

async function openWithMusic(page) {
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.currentTime)).toBeGreaterThan(0.1);
}

test("music is lazy, user-started, looped and reset by refresh", async ({ page }) => {
  const musicRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".m4a")) musicRequests.push(request.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  expect(musicRequests).toEqual([]);
  await expect(page.locator(".seal-caption")).toHaveCount(0);
  await expect(page.locator("audio[controls], audio[autoplay]")).toHaveCount(0);
  await openWithMusic(page);
  expect(musicRequests.length).toBeGreaterThan(0);
  expect(musicRequests.every(url => url.includes(soundtrack))).toBe(true);
  const media = await page.locator("audio").evaluate((audio) => ({
    paused: audio.paused, duration: audio.duration, volume: audio.volume, loop: audio.loop
  }));
  expect(media.paused).toBe(false);
  // Chromium's media duration includes AAC padding; decoded PCM is checked separately.
  expect(media.duration).toBeGreaterThanOrEqual(musicRecord.duration_seconds);
  expect(media.duration).toBeLessThan(musicRecord.duration_seconds + .15);
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
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  await page.route("**/app.js*", (route) => route.abort());
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("audio")).not.toHaveAttribute("src", /./);
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
});

test("hidden tabs pause music and restored documents wait for interaction", async ({ page }) => {
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
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await page.getByRole("link", { name: "Venue", exact: true }).click();
  await expect(page.locator("#venue")).toBeInViewport();
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
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect.poll(() => page.locator("audio").evaluate((audio) => !audio.paused && audio.currentTime > 0.1)).toBe(true);
});

test("the instrumental starts at the music, with safe levels and smooth loop edges", async ({ page }) => {
  await page.goto("/");
  const audio = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const context = new OfflineAudioContext(2, 1, 32000);
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    let peak = 0;
    let squares = 0;
    let boundary = 0;
    let edgePeak = 0;
    let tailPeak = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const samples = decoded.getChannelData(channel);
      boundary = Math.max(boundary, Math.abs(samples[0] - samples[samples.length - 1]));
      for (let index = 0; index < decoded.sampleRate * 0.003; index++) {
        edgePeak = Math.max(edgePeak, Math.abs(samples[index]), Math.abs(samples[samples.length - 1 - index]));
      }
      for (let index = 0; index < decoded.sampleRate * 0.05; index++) {
        tailPeak = Math.max(tailPeak, Math.abs(samples[samples.length - 1 - index]));
      }
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
        squares += sample * sample;
      }
    }
    const windowFrames = Math.round(decoded.sampleRate * .01);
    let onset = null;
    for (let window = 0; window < 100; window++) {
      let energy = 0;
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel);
        for (let frame = window * windowFrames; frame < (window + 1) * windowFrames; frame++) {
          energy += samples[frame] ** 2;
        }
      }
      if (Math.sqrt(energy / (windowFrames * decoded.numberOfChannels)) >= .005) {
        onset = window * .01;
        break;
      }
    }
    return {
      channels: decoded.numberOfChannels, duration: decoded.duration,
      peak, rms: Math.sqrt(squares / (decoded.length * decoded.numberOfChannels)), boundary, edgePeak, tailPeak, onset
    };
  }, soundtrack);
  console.log("Decoded soundtrack:", JSON.stringify(audio));
  expect(audio.channels).toBe(2);
  expect(audio.duration).toBeCloseTo(musicRecord.duration_seconds, 2);
  expect(musicRecord.trimmed_samples_all_zero).toBe(true);
  expect(musicRecord.source_start_frame).toBe(musicRecord.first_nonzero_source_frame - musicRecord.preroll_frames);
  expect(audio.onset).not.toBeNull();
  expect(audio.onset).toBeLessThanOrEqual(.35);
  expect(musicRecord.opening_roundtrip_correlation).toBeGreaterThan(.95);
  expect(audio.peak).toBeLessThan(0.6);
  expect(audio.rms).toBeGreaterThan(0.03);
  expect(audio.rms).toBeLessThan(0.15);
  expect(audio.boundary).toBeLessThan(0.03);
  expect(audio.edgePeak).toBeLessThan(0.01);
  expect(audio.tailPeak).toBeLessThan(0.01);
});

test("music playback begins alongside the curtain movie without an added timer", async ({ page }) => {
  await page.addInitScript(() => {
    window.mediaStarts = [];
    document.addEventListener("playing", event => {
      if (event.target instanceof HTMLMediaElement) {
        window.mediaStarts.push({ tag: event.target.tagName, src: event.target.currentSrc, at: performance.now() });
      }
    }, true);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect.poll(() => page.evaluate(url =>
    window.mediaStarts.some(start => start.tag === "AUDIO" && start.src.endsWith(url)), soundtrack)).toBe(true);
  const offset = await page.evaluate(url => {
    const movie = window.mediaStarts.find(start => start.tag === "VIDEO");
    const music = window.mediaStarts.find(start => start.tag === "AUDIO" && start.src.endsWith(url));
    if (!movie || !music) throw new Error("Missing movie or soundtrack playback event");
    return music.at - movie.at;
  }, soundtrack);
  console.log("Music playback offset from movie (ms):", offset);
  expect(Math.abs(offset)).toBeLessThan(750);
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
  expect((await request.get("/tools/prepare_music.py")).status()).toBe(404);
});
