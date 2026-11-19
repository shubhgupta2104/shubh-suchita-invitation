import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const screenshots = process.env.SCREENSHOT_DIR || "test-results/screenshots";

test("the ruby opening has no visible gesture instructions or microphone access", async ({ page }) => {
  await page.addInitScript(() => {
    window.microphoneRequests = 0;
    navigator.mediaDevices.getUserMedia = () => {
      window.microphoneRequests++;
      return Promise.reject(new Error("Microphone must not be used"));
    };
  });
  await page.goto("/");
  await expect(page.locator("dialog")).toBeVisible();
  const visibleCopy = await page.locator("dialog").innerText();
  expect(visibleCopy).not.toMatch(/blow|tap|swipe|click|open our invitation|skip/i);
  await expect(page.locator(".entrance__glitter")).toHaveCount(0);
  await expect(page.locator("canvas.entrance__trail")).toHaveCount(1);
  await expect(page.locator(".entrance__butterfly")).toBeVisible();
  await page.mouse.click(14, 130);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  expect(await page.evaluate(() => window.microphoneRequests)).toBe(0);
  await expect(page.locator("h1")).toBeFocused();
});

test("a swipe anywhere starts one reveal and one soundtrack", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.musicStarts = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === "AUDIO" && this.getAttribute("src") === this.dataset.src) window.musicStarts++;
      return play.call(this);
    };
  });
  await page.goto("http://127.0.0.1:4197");
  await page.locator("video").evaluate(video => {
    window.renderedRevealEnded = false;
    video.addEventListener("ended", () => { window.renderedRevealEnded = true; });
  });
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 52, y: 680 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 284, y: 350 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("dialog")).toHaveClass(/is-opening/);
  await page.touchscreen.tap(345, 120);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  expect(await page.evaluate(() => window.musicStarts)).toBe(1);
  expect(await page.evaluate(() => window.renderedRevealEnded)).toBe(true);
  await expect.poll(() => page.locator("audio").evaluate(audio => audio.currentTime)).toBeGreaterThan(0.1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await context.close();
});

test("reduced motion opens immediately without butterfly motion or video requests", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("dialog")).toBeVisible();
  await page.mouse.click(100, 400);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator("h1")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero__stage")).toHaveCSS("opacity", "1");
  await expect(page.locator(".entrance__film")).not.toHaveAttribute("src", /./);
});

test("the butterfly rests before interaction and leaves no animation running afterwards", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator(".entrance__butterfly").evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(150);
  expect(await page.locator(".entrance__butterfly").evaluate(element => getComputedStyle(element).transform)).toBe(before);
  expect(await page.locator(".entrance__butterfly").evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Space");
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  expect(await page.locator(".entrance__butterfly").evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.reload();
  await expect(page.locator("dialog")).toBeVisible();
  expect(await page.locator(".entrance__butterfly").evaluate(element => getComputedStyle(element).transform)).toBe(before);
});

test("the 3D opening plays only after interaction and releases its decoder afterwards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".entrance__film")).not.toHaveAttribute("src", /./);
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect.poll(() => page.locator(".entrance__film").evaluate(video => video.currentTime)).toBeGreaterThan(.5);
  await expect(page.locator("dialog")).toBeVisible();
  const media = await page.locator(".entrance__film").evaluate(video => ({
    width: video.videoWidth, height: video.videoHeight, duration: video.duration, muted: video.muted
  }));
  expect(media.width).toBeGreaterThanOrEqual(720);
  expect(media.height).toBe(media.width * 2);
  expect(media.duration).toBeGreaterThanOrEqual(6);
  expect(media.duration).toBeLessThanOrEqual(8);
  expect(media.muted).toBe(true);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator(".entrance__film")).not.toHaveAttribute("src", /./);
  await expect(page.locator(".hero__scene")).toHaveAttribute("src", "assets/artwork/curtain-open.jpg?v=free-dance-candidate-v3");
});

test("an unavailable rendered clip falls back to the open scene without trapping guests", async ({ page }) => {
  const warnings = [];
  page.on("console", message => { if (message.type() === "warning") warnings.push(message.text()); });
  await page.route("**/curtain-reveal.mp4*", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator(".hero__scene")).toHaveAttribute("src", "assets/artwork/curtain-open.jpg?v=free-dance-candidate-v3");
  await expect(page.locator("h1")).toBeFocused();
  expect(warnings.some(text => text.includes("rendered opening"))).toBe(true);
});

test("an unresponsive video play request cannot leave the entrance locked", async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this.tagName === "VIDEO" ? new Promise(() => {}) : play.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator("h1")).toBeFocused();
  await expect(page.locator(".hero__scene")).toHaveAttribute("src", "assets/artwork/curtain-open.jpg?v=free-dance-candidate-v3");
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`curtains cover the entire ${viewport.width}x${viewport.height} viewport throughout playback`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const verifyCoverage = async () => {
      const coverage = await page.locator("dialog").evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const media = element.querySelector("video");
        const style = getComputedStyle(element);
        return {
          x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
          background: style.backgroundColor, backgroundImage: getComputedStyle(element, "::before").backgroundImage,
          mediaIsInside: media.closest("dialog") === element,
          mediaFit: getComputedStyle(media).objectFit,
          poster: media.getAttribute("poster")
        };
      });
      expect(coverage).toMatchObject({ x: 0, y: 0, ...viewport, mediaIsInside: true, mediaFit: "contain" });
      expect(coverage.background).toBe("rgb(0, 0, 0)");
      expect(coverage.backgroundImage).toContain("repeating-linear-gradient");
      expect(coverage.poster).toContain(viewport.width >= viewport.height ? "curtain-closed-wide.jpg" : "curtain-closed.jpg");
    };
    await verifyCoverage();
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.5);
    await verifyCoverage();
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
    await expect(page.locator(".hero__scene")).toHaveCSS("object-fit", "contain");
    const sceneBounds = await page.locator(".hero__scene").boundingBox();
    expect(sceneBounds.y).toBeGreaterThanOrEqual(0);
    expect(sceneBounds.y + sceneBounds.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.locator(".hero__scene").evaluate(image => image.naturalWidth)).toBeGreaterThanOrEqual(720);
  });
}

test("butterfly motion follows video frames rather than an independent particle timer", async ({ page }) => {
  await page.goto("/");
  await page.mouse.click(190, 400);
  await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.6);
  const sync = await page.locator(".entrance__butterfly").evaluate(element => {
    const video = document.querySelector("video");
    return { videoTime: video.currentTime * 1000, animationTimes: element.getAnimations({ subtree: true }).map(animation => animation.currentTime) };
  });
  expect(sync.animationTimes.length).toBe(3);
  for (const time of sync.animationTimes) expect(Math.abs(time - sync.videoTime)).toBeLessThan(200);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
});

test("the reveal copy has no duplicate IDs and is removed after opening", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(element => element.id);
    return ids.length === new Set(ids).size;
  })).toBe(true);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".entrance__reveal-copy")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".entrance__reveal-copy .couple-names")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".entrance__reveal-copy")).toBeEmpty();
  await page.reload();
  await expect(page.locator(".entrance__reveal-copy .couple-names")).toHaveCount(1);
});

test("the final image is decoded before fading and video resets only after the dialog is hidden", async ({ page }) => {
  await page.addInitScript(() => {
    window.videoResetVisibility = [];
    window.finalImageDecoded = false;
    window.fadeStartedWithDecodedImage = false;
    const load = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
      if (this.tagName === "VIDEO") window.videoResetVisibility.push(Boolean(document.querySelector("dialog")?.open));
      return load.call(this);
    };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const result = decode.call(this);
      if (this.classList.contains("hero__scene")) return result.then(() => { window.finalImageDecoded = true; });
      return result;
    };
    document.addEventListener("DOMContentLoaded", () => {
      const entrance = document.querySelector("dialog");
      new MutationObserver(() => {
        if (entrance.classList.contains("is-settling")) window.fadeStartedWithDecodedImage = window.finalImageDecoded;
      }).observe(entrance, { attributes: true, attributeFilter: ["class"] });
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  await expect(page.locator("video")).not.toHaveAttribute("src", /./);
  expect(await page.evaluate(() => window.fadeStartedWithDecodedImage)).toBe(true);
  expect(await page.evaluate(() => window.videoResetVisibility.length)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.videoResetVisibility.every(visible => !visible))).toBe(true);
});

test("gold trail and scene highlights stop after the opening and the scroll cue is clear", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".entrance__trail .spark")).toHaveCount(0);
  await expect(page.locator(".entrance__glints .spark")).toHaveCount(24);
  const trailHasPixels = () => page.locator(".entrance__trail").evaluate(canvas =>
    canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 5)
  );
  expect(await trailHasPixels()).toBe(false);
  await page.getByRole("button", { name: "Open invitation" }).click();
  await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(2.9);
  expect(await trailHasPixels()).toBe(true);
  expect(await page.locator(".entrance__glints").evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(25);
  await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  for (const selector of [".entrance__trail", ".entrance__glints"]) {
    expect(await page.locator(selector).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  }
  expect(await trailHasPixels()).toBe(false);
  await expect(page.getByRole("link", { name: "Scroll to go down", exact: true })).toBeVisible();
  const bounds = await page.locator(".scroll-invitation").boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("link", { name: "Scroll to go down", exact: true }).click();
  await expect(page.locator("#welcome")).toBeInViewport();
});

for (const viewport of [
  { width: 320, height: 568 }, { width: 390, height: 620 }, { width: 390, height: 844 },
  { width: 1000, height: 650 }, { width: 1440, height: 1000 }
]) {
  test(`the last-frame handoff preserves scene position and size at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.3);
    const movieFrame = await page.locator("video").evaluate(video => {
      const bounds = video.getBoundingClientRect();
      const scale = Math.min(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
      return {
        x: bounds.x + (bounds.width - video.videoWidth * scale) / 2,
        y: bounds.y + (bounds.height - video.videoHeight * scale) / 2,
        width: video.videoWidth * scale, height: video.videoHeight * scale
      };
    });
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
    const settledFrame = await page.locator(".hero__scene").evaluate(async image => {
      await image.decode();
      const bounds = image.getBoundingClientRect();
      const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
      return {
        x: bounds.x + (bounds.width - image.naturalWidth * scale) / 2,
        y: bounds.y + (bounds.height - image.naturalHeight * scale) / 2,
        width: image.naturalWidth * scale, height: image.naturalHeight * scale
      };
    });
    for (const dimension of ["x", "y", "width", "height"]) {
      expect(Math.abs(movieFrame[dimension] - settledFrame[dimension])).toBeLessThan(.5);
    }
    const heroWidth = await page.locator(".hero").evaluate(element => element.getBoundingClientRect().width);
    expect(heroWidth).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`only the selected ${viewport.width}px movie is prepared, without autoplay`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const movies = new Set();
    page.on("request", request => {
      if (new URL(request.url()).pathname.endsWith(".mp4")) movies.add(request.url());
    });
    const prepared = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(".mp4"));
    await page.goto("/");
    await (await prepared).finished();
    expect(movies.size).toBe(1);
    await expect(page.locator("video")).not.toHaveAttribute("src", /./);
    expect(await page.locator("video").evaluate(video => video.paused && video.currentTime === 0)).toBe(true);
    await page.getByRole("button", { name: "Open invitation" }).click();
    await expect.poll(() => page.locator("video").evaluate(video => video.currentTime)).toBeGreaterThan(.3);
    expect(movies.size).toBe(1);
    const source = await page.locator("video").evaluate(video => video.currentSrc);
    expect(source).toMatch(/^blob:/);
    expect([...movies][0]).toContain(viewport.width > viewport.height ? "curtain-reveal-wide.mp4" : "curtain-reveal.mp4");
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
  });

  test(`the settled poster matches the actual last movie frame at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const difference = await page.evaluate(async () => {
      const declared = document.querySelector(".entrance__film");
      const image = document.querySelector(".hero__scene");
      const movie = document.createElement("video");
      movie.muted = true;
      movie.preload = "auto";
      movie.src = matchMedia("(min-aspect-ratio: 1/1)").matches && declared.dataset.srcWide
        ? declared.dataset.srcWide : declared.dataset.src;
      await new Promise((resolve, reject) => {
        movie.addEventListener("loadeddata", resolve, { once: true });
        movie.addEventListener("error", () => reject(new Error("Could not decode the rendered opening")), { once: true });
      });
      await new Promise(resolve => {
        movie.addEventListener("seeked", resolve, { once: true });
        movie.currentTime = movie.duration - .02;
      });
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = movie.videoWidth;
      canvas.height = movie.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(movie, 0, 0, canvas.width, canvas.height);
      const lastFrame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const poster = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      for (let index = 0; index < lastFrame.length; index += 4) {
        for (let channel = 0; channel < 3; channel++) total += Math.abs(lastFrame[index + channel] - poster[index + channel]);
      }
      movie.removeAttribute("src");
      movie.load();
      return total / (canvas.width * canvas.height * 3);
    });
    expect(difference).toBeLessThan(3);
  });

  test(`rotation starts at two seconds and retains its endpoint at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const change = await page.evaluate(async () => {
      const declared = document.querySelector(".entrance__film");
      const movie = document.createElement("video");
      movie.muted = true;
      movie.preload = "auto";
      movie.src = matchMedia("(min-aspect-ratio: 1/1)").matches ? declared.dataset.srcWide : declared.dataset.src;
      await new Promise((resolve, reject) => {
        movie.addEventListener("loadeddata", resolve, { once: true });
        movie.addEventListener("error", () => reject(new Error("Could not decode the visible turn")), { once: true });
      });
      const canvas = document.createElement("canvas");
      canvas.width = 180; canvas.height = 180;
      const context = canvas.getContext("2d");
      const sample = async (time) => {
        await new Promise(resolve => {
          movie.addEventListener("seeked", resolve, { once: true });
          movie.currentTime = time;
        });
        context.drawImage(movie, movie.videoWidth * .35, movie.videoHeight * .58,
          movie.videoWidth * .3, movie.videoHeight * .36, 0, 0, 180, 180);
        return context.getImageData(0, 0, 180, 180).data;
      };
      const before = await sample(2);
      const justAfterOpening = await sample(2.2);
      const middle = await sample(3.5);
      const laterMiddle = await sample(3.7);
      const after = await sample(5.9);
      const holdStart = await sample(6.05);
      const holdEnd = await sample(6.6);
      const difference = (first, second) => {
        let total = 0;
        for (let index = 0; index < first.length; index += 4) {
          for (let channel = 0; channel < 3; channel++) total += Math.abs(first[index + channel] - second[index + channel]);
        }
        return total / (180 * 180 * 3);
      };
      movie.removeAttribute("src"); movie.load();
      return {
        beginning: difference(before, justAfterOpening),
        middle: difference(middle, laterMiddle),
        fullTurn: difference(before, after),
        finalHold: difference(holdStart, holdEnd)
      };
    });
    expect(change.beginning).toBeGreaterThan(.1);
    expect(change.middle).toBeGreaterThan(.1);
    expect(change.fullTurn).toBeGreaterThan(3);
    expect(change.finalHold).toBeLessThan(.25);
  });
}

test("the local server supports video byte ranges without exposing render sources", async ({ request }) => {
  const response = await request.get("/assets/video/curtain-reveal.mp4", { headers: { Range: "bytes=0-31" } });
  expect(response.status()).toBe(206);
  expect(response.headers()["content-type"]).toBe("video/mp4");
  expect((await response.body()).length).toBe(32);
  expect((await request.get("/tools/render_opening.py")).status()).toBe(404);
  expect((await request.get("/assets/video/opening.blend")).status()).toBe(404);
});

for (const width of [390, 1440]) {
  test(`capture ${width}px ruby glitter, parting velvet and revealed scene`, async ({ page }) => {
    await mkdir(screenshots, { recursive: true });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(screenshots, `ruby-closed-${width}.png`) });
    await page.mouse.click(width * 0.7, 600);
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(screenshots, `ruby-glitter-${width}.png`) });
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(screenshots, `ruby-parting-${width}.png`) });
    await expect(page.locator("dialog")).not.toBeVisible({ timeout: 12000 });
    await page.screenshot({ path: resolve(screenshots, `ruby-open-${width}.png`) });
    await page.evaluate(() => window.scrollTo(0, 620));
    await page.screenshot({ path: resolve(screenshots, `ruby-transition-${width}.png`) });
  });
}
