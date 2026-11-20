(() => {
    const root = document.documentElement;
    const hero = document.querySelector('.hero');
    const layers = [...hero.querySelectorAll('.hero-image-stage .hero-layer')];
    const controls = hero.querySelector('#hero-scenes');
    const scenes = [...controls.querySelectorAll('[data-hero-scene]')];
    const caption = hero.querySelector('#hero-caption');
    const route = hero.querySelector('#hero-route');
    const replay = hero.querySelector('#hero-replay');
    let currentLayer = layers.find((layer) => layer.classList.contains('is-current'));
    let currentScene = scenes.find((scene) => scene.getAttribute('aria-pressed') === 'true');
    let sceneRequest = 0;
    let replayRequest = 0;
    let sceneTransition;

    function clearSceneTransition() {
        sceneTransition = undefined;
        for (const layer of layers) {
            layer.classList.remove('is-entering', 'is-leaving');
        }
    }

    function clearReplay() {
        replayRequest++;
        hero.classList.remove('is-replaying');
    }

    async function selectScene(scene) {
        const request = ++sceneRequest;
        if (scene === currentScene) {
            return;
        }

        clearReplay();
        clearSceneTransition();

        const nextLayer = layers.find((layer) => layer !== currentLayer);
        const source = scene.dataset.sceneSrc;
        nextLayer.setAttribute('src', source);
        try {
            await nextLayer.decode();
        } catch {
            return;
        }
        if (request !== sceneRequest || nextLayer.getAttribute('src') !== source) {
            return;
        }

        const previousLayer = currentLayer;
        previousLayer.classList.remove('is-current');
        nextLayer.classList.add('is-current');
        currentLayer = nextLayer;
        currentScene.setAttribute('aria-pressed', 'false');
        scene.setAttribute('aria-pressed', 'true');
        currentScene = scene;
        caption.textContent = scene.dataset.sceneCaption;
        route.dataset.bookRoute = scene.dataset.heroScene;

        if (root.dataset.motion === 'on') {
            previousLayer.classList.add('is-leaving');
            nextLayer.classList.add('is-entering');
            const animations = [...previousLayer.getAnimations(), ...nextLayer.getAnimations()];
            const transition = Promise.allSettled(animations.map((animation) => animation.finished));
            sceneTransition = transition;
            await transition;
            if (sceneTransition === transition) {
                clearSceneTransition();
            }
        }
    }

    function syncMotionMode() {
        const motionEnabled = root.dataset.motion === 'on';
        if (!motionEnabled) {
            clearSceneTransition();
            clearReplay();
            if (document.activeElement === replay) {
                currentScene.focus({ preventScroll: true });
            }
        }
        replay.hidden = !motionEnabled;
    }

    for (const scene of scenes) {
        scene.addEventListener('click', () => selectScene(scene));
    }

    replay.addEventListener('click', () => {
        clearSceneTransition();
        clearReplay();
        const request = replayRequest;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (request === replayRequest && root.dataset.motion === 'on') {
                    hero.classList.add('is-replaying');
                }
            });
        });
    });

    new MutationObserver(syncMotionMode).observe(root, { attributeFilter: ['data-motion'] });
    syncMotionMode();
    controls.hidden = false;
})();
