(() => {
  "use strict";

  const entrance = document.querySelector(".entrance");
  const openButton = document.querySelector(".open-invitation");
  const heading = document.getElementById("invitation");
  const music = document.getElementById("invitation-music");
  if (!entrance || !openButton || !heading ||
      typeof entrance.showModal !== "function") return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let destination = window.location.hash;
  let closing = false;
  let closeTimer;
  let resumeMusic = false;

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

  function finishOpening() {
    clearTimeout(closeTimer);
    entrance.close();
    document.documentElement.classList.remove("entrance-closed");
    entrance.classList.remove("is-opening");
    closing = false;
    focusInvitation();
    if (resumeMusic && !document.hidden) {
      resumeMusic = false;
      playMusic();
    }
  }

  function openInvitation(skipAnimation = false) {
    if (closing) return;
    closing = true;
    if (skipAnimation || motion.matches) {
      finishOpening();
      return;
    }
    entrance.classList.add("is-opening");
    closeTimer = window.setTimeout(finishOpening, 1300);
  }

  function showEntrance() {
    clearTimeout(closeTimer);
    resumeMusic = false;
    if (music) {
      music.pause();
      music.currentTime = 0;
    }
    closing = false;
    entrance.classList.remove("is-opening");
    destination = window.location.hash;
    // Keep an initial anchor for after opening, without browser scroll restoration.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    resetScroll();
    entrance.showModal();
    document.documentElement.classList.add("entrance-closed");
    openButton.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (entrance.open) resetScroll();
    });
  }

  openButton.addEventListener("click", () => {
    playMusic();
    openInvitation();
  });
  music?.addEventListener("error", () => {
    console.warn("Invitation music could not load. The invitation remains available.", music.error);
  });
  document.addEventListener("visibilitychange", () => {
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
    resumeMusic = false;
    music?.pause();
  });
  entrance.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      openButton.focus();
    }
  });
  entrance.addEventListener("cancel", (event) => {
    event.preventDefault();
    openInvitation(true);
  });
  motion.addEventListener("change", () => {
    if (closing && motion.matches) finishOpening();
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
