(() => {
  "use strict";

  const entrance = document.querySelector(".entrance");
  const openButton = document.querySelector(".open-invitation");
  const heading = document.getElementById("invitation");
  const music = document.getElementById("invitation-music");
  const film = document.querySelector(".entrance__film");
  const heroCopy = document.querySelector(".hero__copy");
  const heroScene = document.querySelector(".hero__scene");
  const revealCopy = document.querySelector(".entrance__reveal-copy");
  const butterfly = document.querySelector(".entrance__butterfly");
  const trail = document.querySelector(".entrance__trail");
  const sceneGlints = document.querySelector(".entrance__glints");
  const wideScene = window.matchMedia("(min-aspect-ratio: 1/1)");
  if (!entrance || !openButton || !heading ||
      typeof entrance.showModal !== "function") return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let destination = window.location.hash;
  let closing = false;
  let closeTimer;
  let settleTimer;
  let posterWaitTimer;
  let decoderCleanupFrame;
  let awaitingPoster = false;
  let resumeMusic = false;
  let revealSequence = 0;
  let videoFrame;
  let butterflyAnimations = [];
  let viewportWidth = window.innerWidth;
  const trailContext = trail?.getContext("2d");
  let trailPoints = [];
  let trailDust = [];
  let trailTime = null;
  let trailWidth = 0;
  let trailHeight = 0;

  if (trail && !trailContext) console.warn("The butterfly dust effect is unavailable; the invitation remains usable.");
  if (sceneGlints) {
    for (let index = 0; index < 7; index++) {
      const spark = document.createElement("span");
      spark.className = "spark";
      spark.style.setProperty("--spark-index", index);
      spark.append(document.createElement("i"));
      sceneGlints.append(spark);
    }
  }

  function clearTrail() {
    trailPoints = [];
    trailDust = [];
    trailTime = null;
    trailContext?.clearRect(0, 0, trailWidth, trailHeight);
  }

  function sizeTrail() {
    if (!trailContext) return;
    const bounds = entrance.getBoundingClientRect();
    trailWidth = bounds.width;
    trailHeight = bounds.height;
    const resolution = Math.min(window.devicePixelRatio || 1, 1.5);
    trail.width = Math.round(trailWidth * resolution);
    trail.height = Math.round(trailHeight * resolution);
    trailContext.setTransform(resolution, 0, 0, resolution, 0, 0);
    clearTrail();
  }

  function drawTrail(time) {
    if (!trailContext || !butterfly || !entrance.open) return;
    const bounds = butterfly.getBoundingClientRect();
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, time };
    if (trailTime !== null && (time < trailTime || time - trailTime > .3)) clearTrail();
    const elapsed = trailTime === null ? 0 : Math.max(0, time - trailTime);
    const previous = trailPoints.at(-1) || point;
    const emit = time < film.duration * .8 ? Math.min(6, Math.ceil(elapsed * 65)) : 0;
    for (let index = 0; index < emit; index++) {
      const between = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.sqrt(Math.random()) * 13;
      trailDust.push({
        x: previous.x + (point.x - previous.x) * between + Math.cos(angle) * spread,
        y: previous.y + (point.y - previous.y) * between + Math.sin(angle) * spread,
        vx: (Math.random() - .5) * 22, vy: (Math.random() - .3) * 18,
        size: .45 + Math.random() ** 2 * 1.9,
        born: time, life: .4 + Math.random() * .8,
        strength: .2 + Math.random() * .65,
        glint: Math.random() > .87
      });
    }
    trailTime = time;
    trailPoints.push(point);
    trailPoints = trailPoints.filter(item => time - item.time < .8);
    trailDust = trailDust.filter(item => time - item.born < item.life).slice(-120);
    const fade = Math.min(1, time / .3) * Math.max(0, Math.min(1, (film.duration * .94 - time) / .6));
    trailContext.clearRect(0, 0, trailWidth, trailHeight);
    trailContext.lineCap = "round";
    trailContext.shadowColor = "#f4cc91";
    trailContext.shadowBlur = 7;
    for (let index = 1; index < trailPoints.length; index++) {
      const from = trailPoints[index - 1];
      const to = trailPoints[index];
      const age = (time - to.time) / .8;
      trailContext.strokeStyle = `rgba(255, 230, 186, ${.1 * (1 - age) * fade})`;
      trailContext.lineWidth = 1.6;
      trailContext.beginPath();
      trailContext.moveTo(from.x, from.y);
      trailContext.lineTo(to.x, to.y);
      trailContext.stroke();
    }
    trailContext.shadowBlur = 0;
    for (const dust of trailDust) {
      const age = time - dust.born;
      const opacity = (1 - age / dust.life) ** 2 * dust.strength * fade;
      const x = dust.x + dust.vx * age;
      const y = dust.y + dust.vy * age;
      const radius = dust.size * (1 + age * .2);
      const glow = trailContext.createRadialGradient(x, y, 0, x, y, radius * 3);
      glow.addColorStop(0, `rgba(255, 247, 223, ${opacity})`);
      glow.addColorStop(.25, `rgba(246, 215, 164, ${opacity * .5})`);
      glow.addColorStop(1, "rgba(227, 184, 124, 0)");
      trailContext.fillStyle = glow;
      trailContext.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
      if (dust.glint) {
        trailContext.strokeStyle = `rgba(255, 239, 201, ${opacity * .7})`;
        trailContext.lineWidth = .6;
        trailContext.beginPath();
        trailContext.moveTo(x - radius * 1.8, y);
        trailContext.lineTo(x + radius * 1.8, y);
        trailContext.moveTo(x, y - radius * 1.8);
        trailContext.lineTo(x, y + radius * 1.8);
        trailContext.stroke();
      }
    }
  }

  function sizeScene() {
    const bounds = entrance.open ? entrance.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    document.documentElement.style.setProperty("--scene-width", `${bounds.width}px`);
    document.documentElement.style.setProperty("--scene-height", `${bounds.height}px`);
    viewportWidth = bounds.width;
    if (entrance.open) sizeTrail();
  }

  function selectScene() {
    if (!film) return;
    const useWide = wideScene.matches && film.dataset.srcWide;
    const poster = useWide ? film.dataset.posterWide : film.dataset.poster;
    if (poster) {
      film.poster = poster;
      entrance.style.setProperty("--closed-curtain", `url("${poster}")`);
    }
    return useWide ? film.dataset.srcWide : film.dataset.src;
  }
  function prepareRevealCopy() {
    if (!heroCopy || !revealCopy) return;
    // Reuse canonical wording without duplicate IDs or accessible headings.
    const copy = heroCopy.cloneNode(true);
    for (const element of copy.querySelectorAll("[id], [tabindex]")) {
      element.removeAttribute("id");
      element.removeAttribute("tabindex");
    }
    const names = copy.querySelector("h1");
    if (names) {
      const decorativeNames = document.createElement("div");
      decorativeNames.className = "couple-names";
      decorativeNames.append(...names.childNodes);
      names.replaceWith(decorativeNames);
    }
    revealCopy.replaceChildren(copy);
  }

  function stopVisualSync() {
    if (videoFrame !== undefined) film?.cancelVideoFrameCallback?.(videoFrame);
    videoFrame = undefined;
    butterflyAnimations = [];
  }

  function syncVisuals() {
    for (const animation of butterflyAnimations) animation.currentTime = film.currentTime * 1000;
    drawTrail(film.currentTime);
    if (film.duration > 0) {
      const clearTime = Number(film.dataset.curtainsClear) || film.duration * .5;
      const progress = Math.min(1, film.currentTime / clearTime);
      entrance.style.setProperty("--curtain-edge-opacity", String(1 - progress * progress * (3 - 2 * progress)));
    }
    if (closing && !film.paused && !document.hidden && typeof film.requestVideoFrameCallback === "function") {
      videoFrame = film.requestVideoFrameCallback(syncVisuals);
    }
  }

  function playMusic() {
    if (!music) return;
    if (!music.hasAttribute("src")) music.src = music.dataset.src;
    music.volume = 0.65;
    music.play().catch((error) => {
      if (error.name === "AbortError") {
        console.info("Invitation music was paused before playback started.");
      } else {
        resumeMusic = false;
        console.warn("Invitation music could not play. The invitation remains available.", error);
      }
    });
  }

  function resetScroll() {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  function focusInvitation() {
    const target = destination
      ? document.getElementById(destination.slice(1))
      : heading;
    const focusTarget = target?.matches("main [tabindex='-1']") ? target : heading;
    focusTarget.focus({ preventScroll: true });
    if (focusTarget !== heading) {
      focusTarget.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      resetScroll();
    }
    destination = "";
  }

  function closeEntrance() {
    clearTimeout(closeTimer);
    clearTimeout(settleTimer);
    clearTimeout(posterWaitTimer);
    cancelAnimationFrame(decoderCleanupFrame);
    awaitingPoster = false;
    stopVisualSync();
    clearTrail();
    const sequence = ++revealSequence;
    film?.pause();
    entrance.close();
    revealCopy?.replaceChildren();
    document.documentElement.classList.remove("entrance-closed");
    document.documentElement.classList.add("invitation-ready");
    entrance.classList.remove("is-opening", "is-playing", "has-scene-copy", "is-settling", "has-keyboard-focus");
    closing = false;
    const releaseDecoder = () => {
      if (film && !entrance.open && sequence === revealSequence) {
        film.removeAttribute("src");
        film.load();
      }
      decoderCleanupFrame = undefined;
    };
    // Do not expose the closed poster while the video is still in the top layer.
    if (document.hidden) releaseDecoder();
    else decoderCleanupFrame = requestAnimationFrame(() => {
      decoderCleanupFrame = requestAnimationFrame(releaseDecoder);
    });
    focusInvitation();
    if (resumeMusic && !document.hidden) {
      resumeMusic = false;
      playMusic();
    }
  }

  function finishOpening(immediate = false) {
    clearTimeout(closeTimer);
    stopVisualSync();
    if (immediate || motion.matches || document.hidden) {
      closeEntrance();
    } else if (!entrance.classList.contains("is-settling") && !awaitingPoster) {
      film?.pause();
      entrance.classList.add("has-scene-copy");
      awaitingPoster = true;
      const sequence = revealSequence;
      const dissolve = () => {
        if (!closing || sequence !== revealSequence || !awaitingPoster) return;
        clearTimeout(posterWaitTimer);
        awaitingPoster = false;
        requestAnimationFrame(() => {
          if (!closing || sequence !== revealSequence) return;
          entrance.classList.add("is-settling");
          settleTimer = window.setTimeout(closeEntrance, 450);
        });
      };
      posterWaitTimer = window.setTimeout(() => {
        console.warn("The final opening image is slow to decode. Showing the invitation.");
        dissolve();
      }, 1000);
      (heroScene?.decode?.() || Promise.resolve()).then(dissolve).catch(error => {
        console.warn("The final opening image could not decode. Showing the invitation.", error);
        dissolve();
      });
    }
  }

  function openInvitation(skipAnimation = false) {
    if (closing) return;
    closing = true;
    if (skipAnimation || motion.matches) {
      finishOpening(true);
      return;
    }
    entrance.classList.add("is-opening");
    const sequence = ++revealSequence;
    closeTimer = window.setTimeout(() => {
      console.warn("The rendered opening did not finish in time. Showing the invitation.");
      finishOpening(true);
    }, 10500);
    if (!film) {
      finishOpening(true);
      return;
    }
    film.src = selectScene();
    film.play().then(() => {
      if (sequence !== revealSequence || !closing) return;
      const duration = Number.isFinite(film.duration) ? film.duration : 4;
      entrance.style.setProperty("--reveal-duration", `${duration}s`);
      entrance.classList.add("is-playing");
      if (butterfly && typeof film.requestVideoFrameCallback === "function") {
        butterflyAnimations = [butterfly, sceneGlints].filter(Boolean)
          .flatMap(element => element.getAnimations({ subtree: true }));
        for (const animation of butterflyAnimations) animation.pause();
        syncVisuals();
      }
    }).catch(error => {
      if (sequence !== revealSequence || !closing) return;
      console.warn("The rendered opening could not play. Showing the invitation.", error);
      finishOpening(true);
    });
  }

  function showEntrance() {
    clearTimeout(closeTimer);
    clearTimeout(settleTimer);
    clearTimeout(posterWaitTimer);
    cancelAnimationFrame(decoderCleanupFrame);
    awaitingPoster = false;
    stopVisualSync();
    revealSequence++;
    if (film) {
      film.pause();
      film.removeAttribute("src");
      film.load();
    }
    resumeMusic = false;
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    closing = false;
    entrance.style.removeProperty("--curtain-edge-opacity");
    entrance.classList.remove("is-opening", "is-playing", "has-scene-copy", "is-settling", "has-keyboard-focus");
    prepareRevealCopy();
    destination = window.location.hash;
    // Keep an initial anchor for after opening, without browser scroll restoration.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    resetScroll();
    entrance.showModal();
    document.documentElement.classList.add("entrance-closed");
    document.documentElement.classList.remove("invitation-ready");
    selectScene();
    sizeScene();
    openButton.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (entrance.open) resetScroll();
    });
  }

  function activateEntrance(event) {
    if (closing || !entrance.open) return;
    if (event.type === "pointerup" && (event.button !== 0 || !event.isPrimary)) return;
    entrance.classList.remove("has-keyboard-focus");
    playMusic();
    openInvitation();
  }

  entrance.addEventListener("pointerup", activateEntrance);
  openButton.addEventListener("click", activateEntrance);
  window.addEventListener("resize", () => {
    if (entrance.open || window.scrollY === 0 || window.innerWidth !== viewportWidth) sizeScene();
  });
  wideScene.addEventListener("change", () => {
    if (closing) finishOpening(true);
    selectScene();
  });
  film?.addEventListener("ended", () => {
    if (closing) finishOpening();
  });
  film?.addEventListener("timeupdate", () => {
    if (closing && typeof film.requestVideoFrameCallback !== "function" && film.duration > 0) {
      syncVisuals();
    }
    if (closing && film.duration > 0 && film.currentTime / film.duration >= 0.4) {
      entrance.classList.add("has-scene-copy");
    }
  });
  film?.addEventListener("error", () => {
    if (!closing) return;
    console.warn("The rendered opening is unavailable. Showing the invitation.", film.error);
    finishOpening(true);
  });
  music?.addEventListener("error", () => {
    console.warn("Invitation music could not load. The invitation remains available.", music.error);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && closing) finishOpening(true);
    if (!music) return;
    if (document.hidden) {
      resumeMusic = !music.paused;
      music.pause();
    } else if (resumeMusic && !entrance.open) {
      resumeMusic = false;
      playMusic();
    }
  });
  window.addEventListener("pagehide", () => {
    if (closing) closeEntrance();
    resumeMusic = false;
    music?.pause();
  });
  entrance.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      entrance.classList.add("has-keyboard-focus");
      openButton.focus();
    }
  });
  entrance.addEventListener("cancel", (event) => {
    event.preventDefault();
    finishOpening(true);
  });
  motion.addEventListener("change", () => {
    if (closing && motion.matches) finishOpening(true);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) showEntrance();
    else if (entrance.open) resetScroll();
  });

  // The dialog stays hidden until all escape routes are attached.
  try {
    showEntrance();
  } catch (error) {
    entrance.close();
    document.documentElement.classList.remove("entrance-closed");
    console.error("The invitation entrance could not start. The invitation remains available.", error);
  }
})();

(() => {
  "use strict";

  const section = document.querySelector(".countdown");
  const numbers = document.querySelector(".countdown__numbers");
  const fallback = document.querySelector(".countdown__fallback");
  const phere = document.querySelector('[data-event="phere"] time');
  if (!section || !numbers || !fallback || !phere) return;

  const weddingTime = Date.parse(phere.dateTime);
  if (!Number.isFinite(weddingTime)) {
    console.error("The countdown needs a valid Phere date and time in the programme.");
    return;
  }
  const units = ["days", "hours", "minutes", "seconds"].map((unit) =>
    numbers.querySelector(`[data-unit="${unit}"]`));
  let interval;
  let inView = false;

  function update() {
    const remaining = Math.max(0, Math.floor((weddingTime - Date.now()) / 1000));
    if (remaining === 0) {
      numbers.hidden = true;
      fallback.hidden = false;
      fallback.textContent = "Celebrating Shubh & Suchita.";
      clearInterval(interval);
      return;
    }
    const values = [
      Math.floor(remaining / 86400),
      Math.floor(remaining / 3600) % 24,
      Math.floor(remaining / 60) % 60,
      remaining % 60
    ];
    units.forEach((element, index) => {
      element.textContent = String(values[index]).padStart(2, "0");
    });
    numbers.hidden = false;
    fallback.hidden = true;
  }

  function sync() {
    clearInterval(interval);
    if (!document.hidden && inView) {
      update();
      if (Date.now() < weddingTime) interval = window.setInterval(update, 1000);
    }
  }

  update();
  document.addEventListener("visibilitychange", sync);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(section);
  } else {
    inView = true;
    sync();
  }
})();

(() => {
  "use strict";

  const link = document.getElementById("rsvp-link");
  const embed = document.getElementById("rsvp-embed");
  const pending = document.querySelector(".rsvp__pending");
  if (!link || !embed || !link.hasAttribute("href")) return;

  let responder;
  try {
    responder = new URL(link.getAttribute("href"));
    if (responder.origin !== "https://docs.google.com" ||
        !/^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/.test(responder.pathname)) {
      throw new Error("RSVP requires a published Google Forms responder URL.");
    }
  } catch (error) {
    link.removeAttribute("href");
    if (pending) pending.textContent = "The RSVP link is unavailable. Please contact the hosts.";
    console.error("Could not configure the RSVP form:", error);
    return;
  }

  const help = document.createElement("p");
  help.className = "rsvp__help";
  help.textContent = "If the form does not load below, use the separate-tab link above.";
  embed.before(help);
  embed.classList.add("rsvp-embed--ready");

  function loadForm() {
    responder.searchParams.set("embedded", "true");
    const frame = document.createElement("iframe");
    frame.title = "RSVP for Shubh and Suchita's wedding";
    frame.src = responder.href;
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    embed.append(frame);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadForm();
      }
    }, { rootMargin: "400px" });
    observer.observe(embed);
  } else {
    loadForm();
  }
})();
