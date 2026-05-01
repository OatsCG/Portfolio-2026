(function () {
  const speed = 0.22;
  const APP_BOTTOM_EDGE = 85;
  const APP_TOP_A_LEFT = 24;
  const APP_TOP_A_RIGHT = 12;
  const APP_TOP_B_LEFT = 12;
  const APP_TOP_B_RIGHT = 24;
  const APP_BOTTOM_TILT = 10;

  const ANGLES = {
    a: [
      [-2, APP_TOP_A_LEFT],
      [102, APP_TOP_A_RIGHT],
      [102, APP_BOTTOM_EDGE - APP_BOTTOM_TILT / 2],
      [-2, APP_BOTTOM_EDGE + APP_BOTTOM_TILT / 2]
    ],
    b: [
      [-2, APP_TOP_B_LEFT],
      [102, APP_TOP_B_RIGHT],
      [102, APP_BOTTOM_EDGE + APP_BOTTOM_TILT / 2],
      [-2, APP_BOTTOM_EDGE - APP_BOTTOM_TILT / 2]
    ],
    hero: [
      [-2, 36],
      [102, 25],
      [102, 65],
      [-2, 76]
    ]
  };

  const sections = document.querySelectorAll('[data-parallax-section]');
  if (!sections.length) return;

  const state = Array.from(sections).map(sec => ({
    section: sec,
    angle: sec.dataset.angle,
    clip: sec.querySelector('.band-clip')
  }));

  let ticking = false;

  function update() {
    const vh = window.innerHeight;
    const vpCentre = vh / 2;

    for (const s of state) {
      const rect = s.section.getBoundingClientRect();
      if (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) continue;

      const sectionCentre = rect.top + rect.height / 2;
      const diff = sectionCentre - vpCentre;
      const shiftPct = (-diff / rect.height) * 100 * speed;
      const basePoints = ANGLES[s.angle] || ANGLES.a;

      const pts = basePoints
        .map(([x, y]) => `${x}% ${(y - shiftPct).toFixed(2)}%`)
        .join(', ');

      const clipStr = `polygon(${pts})`;
      s.clip.style.clipPath = clipStr;
      s.clip.style.webkitClipPath = clipStr;
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    window.addEventListener('resize', onScroll);
    update();
  } else {
    for (const s of state) {
      const basePoints = ANGLES[s.angle] || ANGLES.a;
      const pts = basePoints.map(([x, y]) => `${x}% ${y}%`).join(', ');
      s.clip.style.clipPath = `polygon(${pts})`;
      s.clip.style.webkitClipPath = `polygon(${pts})`;
    }
  }
})();