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
  const preparationStatus = document.querySelector(".entrance__status");
  const wideScene = window.matchMedia("(min-aspect-ratio: 1/1)");
  if (!entrance || !openButton || !heading ||
      typeof entrance.showModal !== "function") return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const turnStartsAt = 2;
  const turnPlaybackRate = 1.5;
  let destination = window.location.hash;
  let closing = false;
  let closeTimer;
  let settleTimer;
  let posterWaitTimer;
  let decoderCleanupFrame;
  let awaitingPoster = false;
  let resumeMusic = false;
  let resumeFilm = false;
  let musicStarted = false;
  let primerUrl;
  let preparationController;
  let preparationPromise;
  let preparationSource;
  let preparedMovieUrl;
  let preparationTimer;
  let preparationFeedbackTimer;
  let preparationSequence = 0;
  let playbackSequence = 0;
  let lastPlaybackTime = 0;
  let closedPosterSource;
  let closedPosterSequence = 0;
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
    for (let index = 0; index < 24; index++) {
      const spark = document.createElement("span");
      spark.className = "spark";
      spark.style.setProperty("--spark-index", index);
      spark.style.left = `${index % 2 ? 74 + index % 6 * 2.8 : 11 + index % 6 * 3.1}%`;
      spark.style.top = `${53 + index * 13 % 43}%`;
      spark.style.setProperty("--spark-size", `${3 + index % 4 * 1.1}px`);
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
    const emit = time < film.duration * .76 ? Math.min(12, Math.ceil(elapsed * 180)) : 0;
    for (let index = 0; index < emit; index++) {
      const between = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.sqrt(Math.random()) * 15;
      trailDust.push({
        x: previous.x + (point.x - previous.x) * between + Math.cos(angle) * spread,
        y: previous.y + (point.y - previous.y) * between + Math.sin(angle) * spread,
        vx: (Math.random() - .5) * 28, vy: (Math.random() - .25) * 22,
        size: .6 + Math.random() ** 2 * 2.7,
        born: time, life: 1.1 + Math.random() * .9,
        strength: .5 + Math.random() * .45,
        phase: Math.random() * Math.PI,
        glint: Math.random() > .8
      });
    }
    trailTime = time;
    trailPoints.push(point);
    trailPoints = trailPoints.filter(item => time - item.time < 1.5);
    trailDust = trailDust.filter(item => time - item.born < item.life).slice(-320);
    const fade = Math.min(1, time / .25) * Math.max(0, Math.min(1, (film.duration * .93 - time) / .7));
    trailContext.clearRect(0, 0, trailWidth, trailHeight);
    trailContext.globalCompositeOperation = "lighter";
    trailContext.lineCap = "round";
    for (let index = 1; index < trailPoints.length; index++) {
      const from = trailPoints[index - 1];
      const to = trailPoints[index];
      const strength = (1 - (time - to.time) / 1.5) ** 1.5 * fade;
      for (const [width, alpha, color] of [
        [13, .045, "236, 173, 83"], [5, .15, "255, 218, 145"], [1.4, .45, "255, 249, 222"]
      ]) {
        trailContext.strokeStyle = `rgba(${color}, ${alpha * strength})`;
        trailContext.lineWidth = width;
        trailContext.beginPath();
        trailContext.moveTo(from.x, from.y);
        trailContext.lineTo(to.x, to.y);
        trailContext.stroke();
      }
    }
    for (const dust of trailDust) {
      const age = time - dust.born;
      const twinkle = .65 + .35 * Math.sin(age * 5 + dust.phase) ** 2;
      const opacity = (1 - age / dust.life) ** 1.3 * dust.strength * twinkle * fade;
      const x = dust.x + dust.vx * age;
      const y = dust.y + dust.vy * age;
      const radius = dust.size * (1 + age * .2);
      const glow = trailContext.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, `rgba(255, 252, 235, ${opacity})`);
      glow.addColorStop(.18, `rgba(255, 229, 174, ${opacity * .8})`);
      glow.addColorStop(.48, `rgba(239, 181, 87, ${opacity * .25})`);
      glow.addColorStop(1, "rgba(227, 168, 75, 0)");
      trailContext.fillStyle = glow;
      trailContext.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
      if (dust.glint) {
        trailContext.strokeStyle = `rgba(255, 246, 214, ${opacity * .9})`;
        trailContext.lineWidth = .8;
        trailContext.beginPath();
        trailContext.moveTo(x - radius * 1.8, y);
        trailContext.lineTo(x + radius * 1.8, y);
        trailContext.moveTo(x, y - radius * 2.6);
        trailContext.lineTo(x, y + radius * 2.6);
        trailContext.stroke();
      }
    }
    trailContext.globalCompositeOperation = "source-over";
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
      if (poster !== closedPosterSource) {
        closedPosterSource = poster;
        const sequence = ++closedPosterSequence;
        entrance.style.setProperty("--closed-curtain", "none");
        const image = new Image();
        image.fetchPriority = "high";
        image.src = poster;
        image.decode().then(() => {
          if (sequence === closedPosterSequence) entrance.style.setProperty("--closed-curtain", `url("${poster}")`);
        }).catch(error => {
          if (sequence === closedPosterSequence) console.warn("The curtain image could not load. Using the fabric fallback.", error);
        });
      }
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
    if (videoFrame !== undefined) {
      if (typeof film.requestVideoFrameCallback === "function") film.cancelVideoFrameCallback(videoFrame);
      else cancelAnimationFrame(videoFrame);
    }
    videoFrame = undefined;
    butterflyAnimations = [];
  }

  function startVisualSync() {
    butterflyAnimations = [butterfly, sceneGlints].filter(Boolean)
      .flatMap(element => element.getAnimations?.({ subtree: true }) || []);
    for (const animation of butterflyAnimations) animation.pause();
    syncVisuals();
  }

  function syncVisuals() {
    const rate = film.currentTime < turnStartsAt ? 1 : turnPlaybackRate;
    if (film.playbackRate !== rate) film.playbackRate = rate;
    for (const animation of butterflyAnimations) animation.currentTime = film.currentTime * 1000;
    drawTrail(film.currentTime);
    if (film.duration > 0) {
      const clearTime = Number(film.dataset.curtainsClear) || film.duration * .5;
      const progress = Math.min(1, film.currentTime / clearTime);
      entrance.style.setProperty("--curtain-edge-opacity", String(1 - progress * progress * (3 - 2 * progress)));
    }
    if (closing && !film.paused && !document.hidden) {
      videoFrame = typeof film.requestVideoFrameCallback === "function"
        ? film.requestVideoFrameCallback(syncVisuals) : requestAnimationFrame(syncVisuals);
    }
  }

  function releasePrimer() {
    if (primerUrl) URL.revokeObjectURL(primerUrl);
    primerUrl = undefined;
  }

  function unlockMusic() {
    if (!music || primerUrl) return;
    // Unlock this audio element on the gesture without competing with the movie download.
    const silence = new Uint8Array(204);
    const header = new DataView(silence.buffer);
    silence.set(new TextEncoder().encode("RIFF"), 0);
    header.setUint32(4, 196, true);
    silence.set(new TextEncoder().encode("WAVEfmt "), 8);
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 1, true);
    header.setUint32(24, 8000, true);
    header.setUint32(28, 16000, true);
    header.setUint16(32, 2, true);
    header.setUint16(34, 16, true);
    silence.set(new TextEncoder().encode("data"), 36);
    header.setUint32(40, 160, true);
    primerUrl = URL.createObjectURL(new Blob([silence], { type: "audio/wav" }));
    music.src = primerUrl;
    music.loop = false;
    music.play().catch(error => {
      if (error.name !== "AbortError") console.warn("Music could not be prepared on this device.", error);
    });
  }

  function playMusic() {
    if (!music) return;
    musicStarted = true;
    if (music.getAttribute("src") !== music.dataset.src) music.src = music.dataset.src;
    releasePrimer();
    music.loop = true;
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

  function cancelPreparation() {
    preparationSequence++;
    preparationController?.abort();
    preparationController = undefined;
    clearTimeout(preparationTimer);
    preparationPromise = undefined;
    preparationSource = undefined;
  }

  function releasePreparedMovie() {
    if (preparedMovieUrl) URL.revokeObjectURL(preparedMovieUrl);
    preparedMovieUrl = undefined;
  }

  function prepareMovie() {
    const source = selectScene();
    if (!film || !source || motion.matches) return Promise.resolve(null);
    if (preparationPromise && preparationSource === source) return preparationPromise;
    cancelPreparation();
    releasePreparedMovie();
    preparationSource = source;
    const sequence = preparationSequence;
    preparationController = new AbortController();
    const controller = preparationController;
    preparationTimer = window.setTimeout(() => controller.abort(), 30000);
    preparationPromise = fetch(source, { signal: controller.signal, priority: "low" })
      .then(response => {
        if (!response.ok) throw new Error(`Opening movie request failed (${response.status}).`);
        return response.blob();
      })
      .then(blob => {
        if (sequence !== preparationSequence || !entrance.open) return null;
        clearTimeout(preparationTimer);
        if (!blob.size) throw new Error("The opening movie was empty.");
        preparedMovieUrl = URL.createObjectURL(blob);
        return preparedMovieUrl;
      })
      .catch(error => {
        if (sequence !== preparationSequence) return null;
        clearTimeout(preparationTimer);
        console.warn("The rendered opening could not be downloaded. The invitation remains available.", error);
        return null;
      });
    return preparationPromise;
  }

  function stopPreparationFeedback() {
    clearTimeout(preparationFeedbackTimer);
    entrance.classList.remove("is-preparing");
    openButton.removeAttribute("aria-busy");
    if (preparationStatus) preparationStatus.hidden = true;
  }

  function watchPlayback() {
    clearTimeout(closeTimer);
    lastPlaybackTime = film.currentTime;
    closeTimer = window.setTimeout(() => {
      if (!closing || document.hidden || awaitingPoster || entrance.classList.contains("is-settling")) return;
      if (film.currentTime > lastPlaybackTime + .01) watchPlayback();
      else {
        console.warn("The prepared opening stopped responding. Showing the invitation.");
        finishOpening(true);
      }
    }, 8000);
  }

  function beginPlayback(url, sequence) {
    if (!closing || sequence !== revealSequence || document.hidden) return;
    if (!url) {
      if (!musicStarted) playMusic();
      finishOpening(true);
      return;
    }
    if (film.getAttribute("src") !== url) film.src = url;
    const playback = ++playbackSequence;
    watchPlayback();
    film.play().then(() => {
      if (sequence !== revealSequence || playback !== playbackSequence || !closing || document.hidden) return;
      stopPreparationFeedback();
      const duration = Number.isFinite(film.duration) ? film.duration : 6.75;
      entrance.style.setProperty("--reveal-duration", `${duration}s`);
      entrance.classList.add("is-playing");
      if (!musicStarted) playMusic();
      startVisualSync();
    }).catch(error => {
      if (sequence !== revealSequence || playback !== playbackSequence || !closing) return;
      console.warn("The prepared opening could not play. Showing the invitation.", error);
      if (!musicStarted) playMusic();
      finishOpening(true);
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
    resumeFilm = false;
    stopPreparationFeedback();
    cancelPreparation();
    stopVisualSync();
    clearTrail();
    const sequence = ++revealSequence;
    film?.pause();
    entrance.close();
    if (!musicStarted && music) {
      music.pause();
      music.removeAttribute("src");
      music.load();
      releasePrimer();
    }
    revealCopy?.replaceChildren();
    document.documentElement.classList.remove("entrance-closed");
    document.documentElement.classList.add("invitation-ready");
    entrance.classList.remove("is-opening", "is-playing", "is-paused", "has-scene-copy", "is-settling", "has-keyboard-focus");
    closing = false;
    const releaseDecoder = () => {
      if (film && !entrance.open && sequence === revealSequence) {
        film.removeAttribute("src");
        film.load();
        releasePreparedMovie();
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
      if (!musicStarted) playMusic();
      finishOpening(true);
      return;
    }
    entrance.classList.add("is-opening", "is-preparing");
    openButton.setAttribute("aria-busy", "true");
    const sequence = ++revealSequence;
    preparationFeedbackTimer = window.setTimeout(() => {
      if (closing && sequence === revealSequence && entrance.classList.contains("is-preparing") && preparationStatus) {
        preparationStatus.hidden = false;
      }
    }, 400);
    prepareMovie().then(url => beginPlayback(url, sequence));
  }

  function showEntrance() {
    clearTimeout(closeTimer);
    clearTimeout(settleTimer);
    clearTimeout(posterWaitTimer);
    cancelAnimationFrame(decoderCleanupFrame);
    awaitingPoster = false;
    resumeFilm = false;
    musicStarted = false;
    stopPreparationFeedback();
    cancelPreparation();
    stopVisualSync();
    revealSequence++;
    if (film) {
      film.pause();
      film.removeAttribute("src");
      film.load();
    }
    releasePreparedMovie();
    resumeMusic = false;
    if (music) {
      music.pause();
      music.removeAttribute("src");
      music.load();
      music.currentTime = 0;
      music.loop = true;
    }
    releasePrimer();
    closing = false;
    entrance.style.removeProperty("--curtain-edge-opacity");
    entrance.classList.remove("is-opening", "is-playing", "is-paused", "has-scene-copy", "is-settling", "has-keyboard-focus");
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
      if (entrance.open) {
        resetScroll();
        if (!motion.matches) prepareMovie();
      }
    });
  }

  function activateEntrance(event) {
    if (closing || !entrance.open) return;
    if (event.type === "pointerup" && (event.button !== 0 || !event.isPrimary)) return;
    entrance.classList.remove("has-keyboard-focus");
    if (motion.matches || preparedMovieUrl) playMusic();
    else unlockMusic();
    openInvitation();
  }

  entrance.addEventListener("pointerup", activateEntrance);
  openButton.addEventListener("click", activateEntrance);
  window.addEventListener("resize", () => {
    if (entrance.open || window.scrollY === 0 || window.innerWidth !== viewportWidth) sizeScene();
  });
  wideScene.addEventListener("change", () => {
    if (closing) finishOpening(true);
    if (entrance.open) {
      selectScene();
      if (!motion.matches) prepareMovie();
    }
  });
  film?.addEventListener("ended", () => {
    if (closing) finishOpening();
  });
  film?.addEventListener("timeupdate", () => {
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
    if (document.hidden) {
      if (closing && (awaitingPoster || entrance.classList.contains("is-settling"))) finishOpening(true);
      else if (closing) {
        resumeFilm = Boolean(film && !film.paused);
        playbackSequence++;
        film?.pause();
        clearTimeout(closeTimer);
        stopVisualSync();
        entrance.classList.add("is-paused");
      }
      resumeMusic = Boolean(musicStarted && music && !music.paused);
      if (musicStarted) music?.pause();
    } else {
      entrance.classList.remove("is-paused");
      if (closing && resumeFilm) {
        resumeFilm = false;
        beginPlayback(preparedMovieUrl, revealSequence);
      } else if (closing && !entrance.classList.contains("is-playing")) {
        const sequence = revealSequence;
        prepareMovie().then(url => beginPlayback(url, sequence));
      }
      if (resumeMusic) {
        resumeMusic = false;
        playMusic();
      }
    }
  });
  window.addEventListener("pagehide", () => {
    if (closing) closeEntrance();
    else {
      cancelPreparation();
      releasePreparedMovie();
    }
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
    else if (entrance.open) {
      if (motion.matches) {
        cancelPreparation();
        releasePreparedMovie();
      } else prepareMovie();
    }
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
