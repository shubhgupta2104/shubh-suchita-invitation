import { test, expect, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";
const measurements = JSON.parse(await readFile(new URL("fixtures/opening-bounds.json", import.meta.url), "utf8"));
const { defaultBrowserType, ...phone } = devices["iPhone 15 Pro"];

for (const viewport of [
  { width: 393, height: 659 }, { width: 393, height: 700 },
  { width: 393, height: 759 }, { width: 393, height: 852 },
  { width: 1440, height: 1000 }
]) {
  test(`rear movie plays before, midway and after the turn at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext(viewport.width === 393 ? { ...phone, viewport } : { viewport });
    await context.route("https://docs.google.com/**", route => route.abort());
    const page = await context.newPage();
    const movies = new Set();
    page.on("request", request => {
      if (new URL(request.url()).pathname.endsWith(".mp4")) movies.add(new URL(request.url()).pathname);
    });
    await page.goto("http://127.0.0.1:4197/");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("video").evaluate(video => {
      window.rearMovieEnded = false;
      video.addEventListener("ended", () => { window.rearMovieEnded = true; });
    });
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.1);
    const measurement = measurements[viewport.width >= viewport.height ? "landscape" : "portrait"];
    const evidence = [];
    await mkdir(screenshots, { recursive: true });
    for (const [time, label] of [[2, "before"], [4, "midway"], [6, "after"]]) {
      const mediaTime = await page.locator("video").evaluate((video, target) => new Promise(resolve => {
        const capture = (_, frame) => {
          if (frame.mediaTime >= target) {
            resolve(frame.mediaTime);
          } else {
            video.requestVideoFrameCallback(capture);
          }
        };
        video.requestVideoFrameCallback(capture);
      }), time);
      expect(mediaTime).toBeGreaterThanOrEqual(time);
      expect(mediaTime).toBeLessThan(time + .25);
      const layout = await page.evaluate(measurement => {
        const video = document.querySelector("video");
        const rect = video.getBoundingClientRect();
        const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
        const frame = {
          x: rect.x + (rect.width - video.videoWidth * scale) / 2,
          y: rect.y + (rect.height - video.videoHeight * scale) / 2,
          width: video.videoWidth * scale, height: video.videoHeight * scale
        };
        const [left, top, right, bottom] = measurement.bounds;
        const figures = {
          left: frame.x + left * frame.width, top: frame.y + top * frame.height,
          right: frame.x + right * frame.width, bottom: frame.y + bottom * frame.height
        };
        const venue = document.querySelector(".entrance__reveal-copy .hero__location").getBoundingClientRect();
        return { frame, figures, clearance: figures.top - venue.bottom, duration: video.duration,
          width: video.videoWidth, height: video.videoHeight, source: video.currentSrc };
      }, measurement);
      expect(layout.width).toBe(measurement.width);
      expect(layout.height).toBe(measurement.height);
      expect(layout.duration).toBeCloseTo(6.75, 3);
      expect(layout.source).toMatch(/^blob:/);
      expect(layout.clearance).toBeGreaterThanOrEqual(20);
      expect(layout.figures.left).toBeGreaterThanOrEqual(0);
      expect(layout.figures.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.figures.bottom).toBeLessThanOrEqual(viewport.height);
      evidence.push({ label, mediaTime, ...layout });
      await page.screenshot({ path: resolve(screenshots, `rear-${viewport.width}x${viewport.height}-${label}.png`) });
    }
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
    expect(await page.evaluate(() => window.rearMovieEnded)).toBe(true);
    expect([...movies]).toEqual([`/${measurement.movie}`]);
    const finalFrame = await page.locator(".hero__scene").boundingBox();
    for (const dimension of ["x", "y", "width", "height"]) {
      expect(Math.abs(finalFrame[dimension] - evidence[0].frame[dimension])).toBeLessThan(.5);
    }
    await writeFile(resolve(screenshots, `rear-${viewport.width}x${viewport.height}.json`), JSON.stringify(evidence, null, 2));
    await context.close();
  });
}

for (const viewport of [{ width: 393, height: 852 }, { width: 1440, height: 1000 }]) {
  test(`first poster matches the exact rear movie frame at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.1);
    const difference = await page.locator("video").evaluate(async video => {
      video.pause();
      await new Promise(resolve => {
        video.addEventListener("seeked", resolve, { once: true });
        video.currentTime = 0;
      });
      const poster = new Image();
      poster.src = video.poster;
      await poster.decode();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0);
      const moviePixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.drawImage(poster, 0, 0);
      const posterPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      for (let index = 0; index < moviePixels.length; index += 4) {
        for (let channel = 0; channel < 3; channel++) total += Math.abs(moviePixels[index + channel] - posterPixels[index + channel]);
      }
      return total / (canvas.width * canvas.height * 3);
    });
    expect(difference).toBeLessThan(3);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog")).not.toBeVisible();
  });
}
