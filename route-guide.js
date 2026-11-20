(() => {
    const guide = document.querySelector('[data-route-guide]');
    if (!guide) {
        return;
    }

    const start = guide.querySelector('[data-guide-start]');
    const mapButtons = [...guide.querySelectorAll('[data-guide-map] button[data-guide-target]')];
    const panels = [...guide.querySelectorAll('[data-guide-panel]')];
    const titles = panels.map((panel) => panel.querySelector('[data-guide-title]'));
    const controls = guide.querySelector('[data-guide-controls]');
    const previous = controls?.querySelector('[data-guide-prev]');
    const next = controls?.querySelector('[data-guide-next]');
    const progress = controls?.querySelector('[data-guide-progress]');

    if (panels.length === 0 || [start, previous, next, progress, ...titles].some((element) => !element)) {
        return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let currentIndex = -1;
    let animation;

    function motionEnabled() {
        return !reducedMotion.matches && document.documentElement.dataset.motion !== 'off';
    }

    function animatePanel(panel) {
        panel.classList.add('is-entering');
        const pending = Promise.allSettled(panel.getAnimations().map((entry) => entry.finished));
        animation = pending;
        pending.then(() => {
            if (animation === pending) {
                panel.classList.remove('is-entering');
                animation = undefined;
            }
        });
    }

    function showStop(index) {
        if (index === currentIndex || !panels[index]) {
            return;
        }

        const previousPanel = panels[currentIndex];
        const focused = document.activeElement;
        currentIndex = index;
        guide.dataset.guideStep = String(index + 1);

        for (const [panelIndex, panel] of panels.entries()) {
            panel.classList.remove('is-entering');
            panel.hidden = panelIndex !== index;
        }
        for (const button of mapButtons) {
            button.setAttribute('aria-pressed', String(button.dataset.guideTarget === panels[index].id));
        }

        previous.disabled = index === 0;
        next.disabled = index === panels.length - 1;
        progress.textContent = `Остановка ${index + 1} из ${panels.length}`;

        if (previousPanel && motionEnabled()) {
            animatePanel(panels[index]);
        }
        if (previousPanel?.contains(focused)) {
            titles[index].focus();
        } else if (focused === previous && previous.disabled) {
            next.focus();
        } else if (focused === next && next.disabled) {
            previous.focus();
        }
    }

    function indexFromHash() {
        const fragment = window.location.hash.slice(1);
        if (!fragment) {
            return 0;
        }

        try {
            const id = decodeURIComponent(fragment);
            return panels.findIndex((panel) => panel.id === id);
        } catch {
            return -1;
        }
    }

    function selectStop(index) {
        if (!panels[index]) {
            return;
        }

        showStop(index);
        if (window.location.hash === `#${panels[index].id}`) {
            return;
        }

        const fragment = `#${panels[index].id}`;
        try {
            window.history.replaceState(window.history.state, '', fragment);
        } catch {
            window.location.hash = fragment;
        }
    }

    start.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }

        event.preventDefault();
        selectStop(0);
        titles[0].focus({ preventScroll: true });
        panels[0].scrollIntoView({ behavior: motionEnabled() ? 'smooth' : 'instant' });
    });

    for (const button of mapButtons) {
        button.addEventListener('click', (event) => {
            const index = panels.findIndex((panel) => panel.id === button.dataset.guideTarget);
            selectStop(index);

            const title = titles[index];
            if (event.detail > 0 && title?.getBoundingClientRect().top >= window.innerHeight) {
                title.scrollIntoView({ behavior: motionEnabled() ? 'smooth' : 'instant' });
            }
        });
    }
    previous.addEventListener('click', () => selectStop(currentIndex - 1));
    next.addEventListener('click', () => selectStop(currentIndex + 1));

    window.addEventListener('hashchange', () => {
        const index = indexFromHash();
        if (index < 0 || index === currentIndex) {
            return;
        }

        showStop(index);
        if (window.location.hash) {
            panels[index].scrollIntoView({ behavior: 'instant' });
        }
    });

    showStop(Math.max(0, indexFromHash()));
    controls.hidden = false;
    guide.classList.add('guide-ready');
})();
