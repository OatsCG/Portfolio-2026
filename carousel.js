function initCarousel(trackSelector, barsSelector, shellSelector) {
  const track = document.querySelector(trackSelector);
  const barsContainer = document.querySelector(barsSelector);
  const carouselShell = document.querySelector(shellSelector);

  if (!track || !barsContainer || !carouselShell) {
    console.error('Carousel elements not found. Check selectors:', { trackSelector, barsSelector, shellSelector });
    return;
  }

  const originalEntries = Array.from(track.querySelectorAll('.carousel-entry'));
  const itemCount = originalEntries.length;
  let currentIndex = 0;
  let progressId = null;
  let pauseAnimationId = null;
  let startTime = null;
  const cycleDuration = 5000;
  const progressResetDuration = 200;
  let isScrollingProgrammatically = false;

  function buildIndicators() {
    barsContainer.innerHTML = '';
    originalEntries.forEach((entry, index) => {
      const indicator = document.createElement('button');
      indicator.type = 'button';
      indicator.className = 'indicator';
      indicator.dataset.index = index;
      indicator.innerHTML = '<span class="indicator-fill"></span>';
      indicator.addEventListener('click', () => {
        goToIndex(index);
        restartTimer();
      });
      indicator.addEventListener('mouseenter', () => {
        if (indicator.classList.contains('active')) {
          pauseProgressAnimation();
        }
      });
      indicator.addEventListener('mouseleave', () => {
        if (indicator.classList.contains('active')) {
          resumeProgressAnimation();
        }
      });
      barsContainer.appendChild(indicator);
    });
  }

  function updateActiveClasses() {
    const entries = Array.from(track.querySelectorAll('.carousel-entry'));
    entries.forEach((entry) => {
      entry.classList.toggle('active', Number(entry.dataset.index) === currentIndex);
    });
    Array.from(barsContainer.children).forEach((bar, index) => {
      const isActive = index === currentIndex;
      bar.classList.toggle('active', isActive);
      const fill = bar.querySelector('.indicator-fill');
      if (fill) {
        fill.style.width = '0%';
        fill.style.opacity = '0';
      }
      bar.style.background = isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)';
      bar.style.flex = isActive ? '2 1 0' : '1 1 0';
    });
  }

  function scrollToCurrent(behavior = 'smooth') {
    const entries = Array.from(track.querySelectorAll('.carousel-entry'));
    const target = entries[currentIndex];
    if (!target) return;
    isScrollingProgrammatically = true;
    const offset = target.offsetLeft - (track.clientWidth - target.offsetWidth) / 2;
    track.scrollTo({ left: offset, behavior });
  }

  function goToIndex(index) {
    currentIndex = (index + itemCount) % itemCount;
    updateActiveClasses();
    scrollToCurrent();
  }

  function updateVisualsFromScroll() {
    const center = track.scrollLeft + track.clientWidth / 2;
    const entries = Array.from(track.querySelectorAll('.carousel-entry'));
    
    // Find closest entry and update scroll-based visuals
    let closestDistance = Infinity;
    let closestDataIndex = 0;
    
    entries.forEach((entry) => {
      const entryCenter = entry.offsetLeft + entry.offsetWidth / 2;
      const distance = Math.abs(entryCenter - center);
      
      // Calculate blur and scale based on distance from center
      const maxDistance = track.clientWidth * 0.5;
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      const blur = normalizedDistance * 10;
      const scale = 1 - normalizedDistance * 0.08;
      const opacity = 1 - normalizedDistance * 0.34; // 0.66 at max distance
      
      // Update entry visuals
      entry.style.opacity = opacity;
      const image = entry.querySelector('.carousel-image');
      if (image) {
        image.style.filter = `blur(${blur}px)`;
        image.style.transform = `scale(${scale})`;
      }
      
      // Track closest entry for bar updates
      if (distance < closestDistance) {
        closestDistance = distance;
        closestDataIndex = Number(entry.dataset.index);
      }
    });
    
    // Only update bar indicators if not doing a programmatic scroll
    if (!isScrollingProgrammatically) {
      // Update bar indicators based on scroll position
      Array.from(barsContainer.children).forEach((bar, index) => {
        const isClosest = index === closestDataIndex;
        bar.classList.toggle('active', isClosest);
        bar.style.flex = isClosest ? '2 1 0' : '1 1 0';
        bar.style.background = isClosest ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)';
      });
      
      // Update zIndex based on closest
      entries.forEach(entry => {
        entry.style.zIndex = Number(entry.dataset.index) === closestDataIndex ? '2' : '1';
      });
      
      // Update currentIndex for progress bar
      currentIndex = closestDataIndex;
    }
  }

  function updateProgress(percent) {
    Array.from(barsContainer.children).forEach((bar, index) => {
      const fill = bar.querySelector('.indicator-fill');
      if (index === currentIndex) {
        fill.style.width = `${percent * 100}%`;
        fill.style.opacity = `${0.6 * percent}`;
        bar.style.background = `rgba(255,255,255,${0.6 * (1 - percent)})`;
      } else {
        bar.style.background = 'rgba(255,255,255,0.1)';
        fill.style.width = '0%';
        fill.style.opacity = '0';
      }
    });
  }

  function resetProgressState() {
    Array.from(barsContainer.children).forEach((bar, index) => {
      const isActive = index === currentIndex;
      const fill = bar.querySelector('.indicator-fill');
      if (fill) {
        fill.style.width = '0%';
        fill.style.opacity = '0';
      }
      bar.classList.toggle('active', isActive);
      bar.style.flex = isActive ? '2 1 0' : '1 1 0';
      bar.style.background = isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)';
    });
  }

  function tickProgress(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const percent = Math.min(elapsed / cycleDuration, 1);
    updateProgress(percent);
    if (elapsed >= cycleDuration) {
      goToIndex(currentIndex + 1);
      startTime = timestamp;
    }
    progressId = requestAnimationFrame(tickProgress);
  }

  function restartTimer() {
    cancelTimer();
    // Also cancel any pause animation
    if (pauseAnimationId) {
      cancelAnimationFrame(pauseAnimationId);
      pauseAnimationId = null;
    }
    startTime = null;
    resetProgressState();
    progressId = requestAnimationFrame(tickProgress);
  }

  function cancelTimer() {
    if (progressId) {
      cancelAnimationFrame(progressId);
      progressId = null;
    }
  }

  function pauseProgressAnimation() {
    if (progressId) {
      cancelAnimationFrame(progressId);
      progressId = null;
    }
    // Cancel any existing pause animation
    if (pauseAnimationId) {
      cancelAnimationFrame(pauseAnimationId);
      pauseAnimationId = null;
    }
    const activeBar = barsContainer.children[currentIndex];
    if (!activeBar) return;
    const fill = activeBar.querySelector('.indicator-fill');
    
    // Instantly reset progress to 0%
    if (fill) {
      fill.style.width = '0%';
      fill.style.opacity = '0';
    }
    activeBar.style.background = 'rgba(255,255,255,0.6)';
    activeBar.classList.add('active');
    activeBar.style.flex = '2 1 0';
  }

  function resumeProgressAnimation() {
    restartTimer();
  }

  function onMouseEnter() {
    cancelTimer();
    pauseProgressAnimation();
  }

  function onMouseLeave() {
    restartTimer();
  }

  function onScrollEnd() {
    isScrollingProgrammatically = false;
    updateVisualsFromScroll(); // Final update based on snap position
    restartTimer();
  }

  let scrollTimeout;
  function onScroll() {
    cancelTimer(); // Cancel progress animation during scroll
    resetProgressState(); // Reset progress bars instantly
    updateVisualsFromScroll();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(onScrollEnd, 120);
  }

  // Initialize
  buildIndicators();
  goToIndex(0);
  track.addEventListener('scroll', onScroll, { passive: true });
  carouselShell.addEventListener('mouseenter', onMouseEnter);
  carouselShell.addEventListener('mouseleave', onMouseLeave);
  updateVisualsFromScroll();
  restartTimer();
  updateActiveClasses();
}
