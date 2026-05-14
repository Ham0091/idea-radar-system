const IRSMotion = (() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function detectTier(appearance = "default") {
    const width = window.innerWidth;
    const lowWidth = width < 360;
    const highWidth = width >= 1024;
    const lowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

    if (appearance === "off" || lowWidth || lowPower) {
      return "low";
    }
    if (highWidth && appearance !== "off") {
      return "high";
    }
    return "standard";
  }

  function applyEnvironment(appElement, options = {}) {
    const appearance = options.appearance || "default";
    const reducedMotion = options.reducedMotion || prefersReducedMotion.matches;
    const tier = detectTier(appearance);

    appElement.dataset.tier = tier;
    appElement.dataset.effects = appearance;
    appElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
  }

  function revealStagger(elements, intervalMs = 60) {
    elements.forEach((element, index) => {
      const delay = prefersReducedMotion.matches ? 0 : index * intervalMs;
      window.setTimeout(() => {
        element.classList.add("is-visible");
      }, delay);
    });
  }

  function cascadeIn(elements, intervalMs = 60, startDelay = 0) {
    elements.forEach((element, index) => {
      const delay = prefersReducedMotion.matches ? 0 : startDelay + index * intervalMs;
      window.setTimeout(() => element.classList.add("is-visible"), delay);
    });
  }

  function cascadeOut(elements, intervalMs = 40) {
    elements.forEach((element, index) => {
      const delay = prefersReducedMotion.matches ? 0 : index * intervalMs;
      window.setTimeout(() => element.classList.remove("is-visible"), delay);
    });
  }

  function runGlitch(element) {
    if (!element) {
      return;
    }
    element.classList.remove("glitch-resolve");
    void element.offsetWidth;
    element.classList.add("glitch-resolve");
  }

  function runCABeat(element) {
    if (!element) {
      return;
    }
    element.classList.remove("ca-beat");
    void element.offsetWidth;
    element.classList.add("ca-beat");
  }

  function runScanline(scanlineElement) {
    if (!scanlineElement) {
      return;
    }
    scanlineElement.classList.remove("is-active");
    void scanlineElement.offsetWidth;
    scanlineElement.classList.add("is-active");
  }

  function showSheet(sheetElement, scrimElement) {
    if (scrimElement) {
      scrimElement.hidden = false;
      requestAnimationFrame(() => scrimElement.classList.add("is-visible"));
    }
    sheetElement.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => sheetElement.classList.add("is-open"));
  }

  function hideSheet(sheetElement, scrimElement) {
    sheetElement.classList.remove("is-open");
    sheetElement.setAttribute("aria-hidden", "true");
    if (scrimElement) {
      scrimElement.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!document.querySelector(".sheet.is-open, .inspect-panel.is-open")) {
          scrimElement.hidden = true;
        }
      }, 220);
    }
  }

  function countUp(element, toValue, options = {}) {
    const duration = options.duration || 480;
    const decimals = options.decimals || 0;
    if (prefersReducedMotion.matches) {
      element.textContent = Number(toValue).toFixed(decimals);
      return;
    }

    const start = performance.now();
    const fromValue = 0;
    const target = Number(toValue);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = fromValue + (target - fromValue) * eased;
      element.textContent = value.toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function onReducedMotionChange(callback) {
    prefersReducedMotion.addEventListener("change", callback);
  }

  return {
    detectTier,
    applyEnvironment,
    revealStagger,
    cascadeIn,
    cascadeOut,
    runGlitch,
    runCABeat,
    runScanline,
    showSheet,
    hideSheet,
    countUp,
    onReducedMotionChange,
    prefersReducedMotion
  };
})();
