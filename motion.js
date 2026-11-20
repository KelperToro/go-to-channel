(() => {
    const root = document.documentElement;
    const toggle = document.querySelector('#motion-toggle');
    const state = document.querySelector('#motion-state');
    const progress = document.querySelector('#scroll-progress');
    const revealItems = document.querySelectorAll('[data-reveal]');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const photo = document.querySelector('#enlarged-photo');
    const dialog = document.querySelector('#photo-dialog');
    let motionEnabled = false;
    let userSelected = false;
    let progressFrame;
    let pendingPhoto;
    let photoAnimation;

    const revealObserver = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            }
        })
        : null;

    function revealFocus(element) {
        for (let item = element?.closest('[data-reveal]'); item; item = item.parentElement?.closest('[data-reveal]')) {
            item.classList.add('is-visible');
            revealObserver?.unobserve(item);
        }
    }

    function scheduleProgress() {
        if (!motionEnabled || !progress || progressFrame !== undefined) {
            return;
        }

        progressFrame = requestAnimationFrame(() => {
            progressFrame = undefined;
            const scroll = document.scrollingElement ?? root;
            const distance = scroll.scrollHeight - scroll.clientHeight;
            const fraction = distance > 0 ? Math.max(0, Math.min(1, scroll.scrollTop / distance)) : 0;
            progress.style.transform = `scaleX(${fraction})`;
        });
    }

    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(scheduleProgress) : null;

    function cancelPhotoTransition() {
        pendingPhoto = undefined;
        photoAnimation?.cancel();
        photoAnimation = undefined;
    }

    function animateLoadedPhoto() {
        if (!pendingPhoto || !dialog.open || !photo.complete || !photo.naturalWidth ||
            photo.getAttribute('src') !== pendingPhoto || photo.currentSrc !== photo.src) {
            return;
        }

        pendingPhoto = undefined;
        photoAnimation = photo.animate([
            { opacity: 0.45, transform: 'translateY(7px) scale(0.99)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], {
            duration: 260,
            easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)'
        });
    }

    function setMotion(enabled) {
        motionEnabled = enabled;
        root.dataset.motion = enabled ? 'on' : 'off';
        toggle.setAttribute('aria-pressed', String(enabled));
        state.textContent = enabled ? 'Вкл.' : 'Выкл.';

        if (enabled) {
            revealFocus(document.activeElement);
            for (const item of revealItems) {
                if (revealObserver && !item.classList.contains('is-visible')) {
                    revealObserver.observe(item);
                } else {
                    item.classList.add('is-visible');
                }
            }
            resizeObserver?.observe(document.body);
            scheduleProgress();
            return;
        }

        revealObserver?.disconnect();
        resizeObserver?.disconnect();
        if (progressFrame !== undefined) {
            cancelAnimationFrame(progressFrame);
            progressFrame = undefined;
        }
        cancelPhotoTransition();
    }

    if (photo?.animate && dialog) {
        new MutationObserver((records) => {
            const source = photo.getAttribute('src');
            if (source === records[0].oldValue) {
                return;
            }
            cancelPhotoTransition();
            if (motionEnabled && dialog.open) {
                pendingPhoto = source;
                animateLoadedPhoto();
            }
        }).observe(photo, { attributeFilter: ['src'], attributeOldValue: true });

        photo.addEventListener('load', animateLoadedPhoto);
        dialog.addEventListener('close', cancelPhotoTransition);
    }

    document.addEventListener('focusin', (event) => revealFocus(event.target));
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress, { passive: true });
    window.addEventListener('load', scheduleProgress);

    toggle.addEventListener('click', () => {
        userSelected = true;
        setMotion(!motionEnabled);
    });

    preference.addEventListener('change', (event) => {
        if (!userSelected) {
            setMotion(!event.matches);
        }
    });

    setMotion(!preference.matches);
    toggle.hidden = false;
})();
