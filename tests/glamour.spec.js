import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 393, height: 659 }, { width: 393, height: 700 }, { width: 393, height: 759 },
  { width: 393, height: 852 }, { width: 1440, height: 1000 }
]) {
  test(`gold trail is clearly visible without covering names at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      let state = 2612027;
      Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("video").evaluate(video => {
      window.glowPlayback = { ended: false, overlap: 0, samples: 0, trail: null };
      video.addEventListener("ended", () => { window.glowPlayback.ended = true; });
      const sample = (_, frame) => {
        if (frame.mediaTime >= 3.3 && frame.mediaTime < 5.9) {
          const butterfly = document.querySelector(".entrance__butterfly").getBoundingClientRect();
          for (const element of document.querySelectorAll(".entrance__reveal-copy .name, .entrance__reveal-copy .parentage, .entrance__reveal-copy .hero__intro")) {
            const range = document.createRange();
            range.selectNodeContents(element);
            for (const text of range.getClientRects()) {
              const area = Math.max(0, Math.min(butterfly.right, text.right) - Math.max(butterfly.left, text.left)) *
                Math.max(0, Math.min(butterfly.bottom, text.bottom) - Math.max(butterfly.top, text.top));
              if (area > window.glowPlayback.overlap) {
                window.glowPlayback.overlap = area;
                window.glowPlayback.worst = { time: frame.mediaTime, text: element.textContent,
                  butterfly: butterfly.toJSON(), textBounds: text.toJSON() };
              }
            }
          }
          window.glowPlayback.samples++;
        }
        if (frame.mediaTime >= 3.5 && !window.glowPlayback.trail) {
          const canvas = document.querySelector(".entrance__trail");
          const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          const scale = canvas.width / canvas.getBoundingClientRect().width;
          let visible = 0, bright = 0;
          for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] > 16) visible++;
            if (pixels[index] > 100) bright++;
          }
          window.glowPlayback.trail = { visible: visible / scale ** 2, bright: bright / scale ** 2 };
        }
        if (!video.ended) video.requestVideoFrameCallback(sample);
      };
      video.requestVideoFrameCallback(sample);
    });
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
    const playback = await page.evaluate(() => window.glowPlayback);
    expect(playback.ended).toBe(true);
    expect(playback.samples).toBeGreaterThan(40);
    expect(playback.overlap, JSON.stringify(playback.worst)).toBe(0);
    expect(playback.trail.visible).toBeGreaterThan(1500);
    expect(playback.trail.bright).toBeGreaterThan(200);
    expect(await page.locator(".entrance__trail").evaluate(canvas =>
      canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value)
    )).toBe(false);
    expect(await page.locator(".entrance__glints").evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  });
}

test("reduced motion creates no gold trail, glint motion or stage bloom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  const effects = await page.locator(".entrance__glints").evaluate(element => ({
    animations: element.getAnimations({ subtree: true }).length,
    stageOpacity: getComputedStyle(element, "::before").opacity
  }));
  expect(effects).toEqual({ animations: 0, stageOpacity: "0" });
});
