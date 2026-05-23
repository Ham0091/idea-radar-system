const IRSMotion = (() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /**
   * Stagger-reveal a list of elements by adding `is-visible` class
   * with a per-element delay. Uses IntersectionObserver when available.
   */
  function revealStagger(elements, intervalMs = 60) {
    if (prefersReducedMotion.matches) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    elements.forEach((el, i) => {
      window.setTimeout(() => el.classList.add("is-visible"), i * intervalMs);
    });
  }

  /**
   * Cascade-in: stagger add is-visible with an optional start delay.
   */
  function cascadeIn(elements, intervalMs = 50, startDelay = 0) {
    if (prefersReducedMotion.matches) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    elements.forEach((el, i) => {
      window.setTimeout(() => el.classList.add("is-visible"), startDelay + i * intervalMs);
    });
  }

  /**
   * Cascade-out: stagger remove is-visible.
   */
  function cascadeOut(elements, intervalMs = 30) {
    if (prefersReducedMotion.matches) {
      elements.forEach((el) => el.classList.remove("is-visible"));
      return;
    }
    elements.forEach((el, i) => {
      window.setTimeout(() => el.classList.remove("is-visible"), i * intervalMs);
    });
  }

  /**
   * Show a bottom-sheet with scrim.
   */
  function showSheet(sheetElement, scrimElement) {
    if (scrimElement) {
      scrimElement.hidden = false;
      requestAnimationFrame(() => scrimElement.classList.add("is-visible"));
    }
    sheetElement.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => sheetElement.classList.add("is-open"));
  }

  /**
   * Hide a bottom-sheet and conditionally hide scrim.
   */
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

  /**
   * Animate a number from 0 to `toValue` inside `element`.
   */
  function countUp(element, toValue, options = {}) {
    const duration = options.duration || 500;
    const decimals = options.decimals || 0;

    if (prefersReducedMotion.matches) {
      element.textContent = Number(toValue).toFixed(decimals);
      return;
    }

    const start = performance.now();
    const target = Number(toValue);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      element.textContent = value.toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  /**
   * Set up an IntersectionObserver that reveals elements when they enter viewport.
   */
  function observeReveals(scope, selector, staggerMs = 50) {
    const elements = scope.querySelectorAll(selector);
    if (!elements.length) return;

    if (prefersReducedMotion.matches) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let delay = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            window.setTimeout(() => entry.target.classList.add("is-visible"), delay);
            delay += staggerMs;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach((el) => observer.observe(el));
    return observer;
  }

  function onReducedMotionChange(callback) {
    prefersReducedMotion.addEventListener("change", callback);
  }

  return {
    prefersReducedMotion,
    revealStagger,
    cascadeIn,
    cascadeOut,
    showSheet,
    hideSheet,
    countUp,
    observeReveals,
    onReducedMotionChange
  };
})();
