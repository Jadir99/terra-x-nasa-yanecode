/**
 * TERRA-X — High-Performance Motion & Animation Engine
 * File: static/js/landing-animations.js
 *
 * Implements smooth scroll reveals, animated metric counters, interactive card motion,
 * kinetic title parallax, scroll progress tracking, and navbar dynamic elevation.
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initScrollProgressBar();
    initScrollReveal();
    initCounterAnimations();
    initCardHoverMotion();
    initNavbarScroll();
    initHeadlineMagnetism();
    initHeadingAccents();
  });

  /**
   * 1. Global Scroll Progress Indicator
   */
  function initScrollProgressBar() {
    const bar = document.getElementById("scrollProgressBar");
    if (!bar) return;

    function updateProgress() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = Math.min(progress, 100).toFixed(1) + "%";
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
  }

  /**
   * 2. Scroll-Driven Reveal Animations (IntersectionObserver)
   */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll(
      ".section-header, .exploration-card, .mission-feature, .planetary-col, .citation-card, .stat-item, .intro-content, .intro-image-frame, .cta-box"
    );

    revealElements.forEach(el => {
      el.classList.add("reveal-on-scroll");
    });

    if (!("IntersectionObserver" in window)) {
      revealElements.forEach(el => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -50px 0px",
        threshold: 0.1,
      }
    );

    revealElements.forEach(el => observer.observe(el));
  }

  /**
   * 3. Metric Counter Roll-Up Animation with Completion Pop
   */
  function initCounterAnimations() {
    const statNumbers = document.querySelectorAll(".stat-number");
    if (!statNumbers.length) return;

    const countedSet = new WeakSet();

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !countedSet.has(entry.target)) {
            countedSet.add(entry.target);
            animateSingleCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    statNumbers.forEach(el => observer.observe(el));

    function animateSingleCounter(el) {
      const originalText = el.textContent.trim();

      if (originalText.includes("%")) {
        const target = parseInt(originalText, 10);
        runCount(el, 0, target, 1400, val => Math.round(val) + "%");
      } else if (/^\d+$/.test(originalText)) {
        const target = parseInt(originalText, 10);
        runCount(el, 0, target, 1200, val => Math.round(val));
      } else if (originalText.startsWith("3-")) {
        runCount(el, 1, 3, 1000, val => Math.round(val) + "-Score");
      }
    }

    function runCount(el, start, end, duration, formatFn) {
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentVal = start + (end - start) * easeProgress;
        el.textContent = formatFn(currentVal);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = formatFn(end);
          el.classList.add("count-completed");
        }
      }

      requestAnimationFrame(update);
    }
  }

  /**
   * 4. Interactive 3D Card Hover Physics
   */
  function initCardHoverMotion() {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const cards = document.querySelectorAll(".exploration-card, .planetary-col, .mission-feature");

    cards.forEach(card => {
      card.addEventListener("mousemove", function (e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -4;
        const rotateY = ((x - centerX) / centerX) * 4;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px)`;
      });

      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /**
   * 5. Navbar Dynamic Elevation on Scroll
   */
  function initNavbarScroll() {
    const nav = document.querySelector(".site-nav");
    if (!nav) return;

    function onScroll() {
      if (window.scrollY > 24) {
        nav.classList.add("nav-scrolled");
      } else {
        nav.classList.remove("nav-scrolled");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /**
   * 6. Hero Headline Interactive Magnetic Motion
   */
  function initHeadlineMagnetism() {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const hero = document.getElementById("hero");
    const words = document.querySelectorAll(".animated-title .title-word");
    if (!hero || !words.length) return;

    hero.addEventListener("mousemove", function (e) {
      const rect = hero.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;

      words.forEach((word, idx) => {
        const factor = (idx % 3 + 1) * 3;
        word.style.transform = `translate3d(${(normX * factor).toFixed(1)}px, ${(normY * factor).toFixed(1)}px, 0)`;
      });
    });

    hero.addEventListener("mouseleave", function () {
      words.forEach(word => {
        word.style.transform = "";
      });
    });
  }

  /**
   * 7. Section Heading Accent Expansions
   */
  function initHeadingAccents() {
    const headings = document.querySelectorAll(".section-header");
    headings.forEach(header => {
      const line = document.createElement("div");
      line.className = "heading-accent-line";
      line.setAttribute("aria-hidden", "true");
      header.appendChild(line);
    });
  }
})();
