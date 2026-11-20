const routeButtons = document.querySelectorAll('[data-route]');
const routePanels = Array.from(document.querySelectorAll('[data-route-panel]'));
const booking = document.querySelector('#booking-form');
const bookingRoute = booking.elements.route;
const visitor = booking.elements.visitor;
const bookingEmail = booking.elements.email;
const bookingPrepare = document.querySelector('#booking-prepare');
const emailStatus = document.querySelector('#booking-email-status');
const emailEndpoint = (booking.dataset.formsubmit || '').trim();
const emailEnabled = location.protocol === 'https:' && /^[a-z\d_-]+$/i.test(emailEndpoint);
const emailService = 'https://formsubmit.co/';

const bookingStatus = document.querySelector('#booking-status');
const bookingResult = document.querySelector('#booking-result');
const bookingDownload = document.querySelector('#booking-download');
const previewTitle = document.querySelector('#booking-route-title');
const previewFacts = document.querySelector('#booking-preview-facts');
const previewSchedule = document.querySelector('#booking-preview-schedule');
const previewStops = document.querySelector('#booking-stops');
const profileForm = document.querySelector('#profile-form');
const profileName = document.querySelector('#profile-name');
const profileActive = document.querySelector('#profile-active');
const profileDisplay = document.querySelector('#profile-display-name');
const profileSignout = document.querySelector('#profile-signout');
const profileStatus = document.querySelector('#profile-status');
const profileEmpty = document.querySelector('#profile-empty');
const savedPlans = document.querySelector('#profile-plans');
const profileStorageKey = 'maykop-walks-profile-v1';
const routes = new Map();

for (const option of bookingRoute.options) {
    const panel = routePanels.find((item) => item.dataset.routePanel === option.value);
    const stops = Array.from(panel.querySelectorAll('ol li'), (stop) => ({
        name: stop.querySelector('strong')?.textContent.trim() || stop.textContent.trim(),
        note: stop.querySelector('span')?.textContent.trim() || ''
    }));

    routes.set(option.value, {
        title: option.textContent.trim(),
        distance: option.dataset.distance,
        duration: option.dataset.duration,
        stops
    });
}

let downloadUrl;
let lastEmail;
let previewRoute;
let storageUnavailable = false;
let profileState = readProfileState();

function readProfileState() {
    try {
        const saved = JSON.parse(localStorage.getItem(profileStorageKey));
        const entries = Array.isArray(saved?.profiles) ? saved.profiles : [];
        const profiles = entries.filter((profile) => (
            typeof profile?.name === 'string' && profile.name.trim() && profile.name.length <= 32
        )).map((profile) => ({
            name: profile.name,
            plans: Array.isArray(profile.plans) ? profile.plans.filter(isSavedPlan) : []
        }));

        return { active: saved?.active || '', profiles };
    } catch (error) {
        storageUnavailable = !(error instanceof SyntaxError);
        return { active: '', profiles: [] };
    }
}

function isSavedPlan(plan) {
    return routes.has(plan?.route)
        && typeof plan.visitor === 'string' && plan.visitor.trim().length > 0 && plan.visitor.length <= 80
        && typeof plan.date === 'string' && /^\d{4,}-\d{2}-\d{2}$/.test(plan.date)
        && typeof plan.time === 'string' && (!plan.time || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.time))
        && Number.isInteger(plan.people) && plan.people >= 1 && plan.people <= 20;
}

function activeProfile() {
    return profileState.profiles.find((profile) => profile.name === profileState.active);
}

function writeProfileState() {
    try {
        localStorage.setItem(profileStorageKey, JSON.stringify(profileState));
        storageUnavailable = false;
    } catch {
        storageUnavailable = true;
    }
}

function showProfileStatus(message = '') {
    const availability = storageUnavailable
        ? 'Хранилище браузера недоступно. Планы видны до закрытия страницы.'
        : '';
    profileStatus.textContent = [message, availability].filter(Boolean).join(' ');
}

function formatDate(value) {
    return value.split('-').reverse().join('.');
}

function formatPeople(people) {
    if (!Number.isInteger(people) || people < 1 || people > 20) return 'Укажите число участников';
    if (people === 1) return '1 участник';
    return people + (people < 5 ? ' участника' : ' участников');
}

function formatSchedule(plan) {
    return [
        plan.date ? formatDate(plan.date) : 'Дата пока не выбрана',
        plan.time,
        formatPeople(plan.people)
    ].filter(Boolean).join(' · ');
}

function currentPlan() {
    return {
        route: bookingRoute.value,
        visitor: visitor.value.trim(),
        date: booking.elements.date.value,
        time: booking.elements.time.value,
        people: booking.elements.people.valueAsNumber
    };
}

function samePlan(first, second) {
    return first.route === second.route && first.visitor === second.visitor
        && first.date === second.date && first.time === second.time && first.people === second.people;
}

function renderBookingPreview() {
    const plan = currentPlan();
    previewSchedule.textContent = formatSchedule(plan);
    if (plan.route === previewRoute) return;

    const route = routes.get(plan.route);
    previewRoute = plan.route;
    previewTitle.textContent = route.title;
    previewFacts.textContent = '≈ ' + route.distance + ' · ' + route.duration + ' пешком';
    previewStops.replaceChildren(...route.stops.map((stop) => {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = stop.name;
        item.append(name);
        if (stop.note) {
            const note = document.createElement('span');
            note.className = 'booking-stop-note';
            note.textContent = stop.note;
            item.append(note);
        }
        return item;
    }));
}

function clearBooking() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = undefined;
    }
    bookingDownload.removeAttribute('href');
    bookingStatus.textContent = '';
    bookingResult.hidden = true;
}

function selectRoute(route) {
    if (!routes.has(route)) route = bookingRoute.options[0].value;

    for (const button of routeButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.route === route));
    }
    for (const panel of routePanels) {
        panel.hidden = panel.dataset.routePanel !== route;
    }

    bookingRoute.value = route;
    if (route !== previewRoute) clearBooking();
    renderBookingPreview();
}

function planFileUrl(plan, email = '') {
    const route = routes.get(plan.route);
    const lines = [
        'Маршрут по Майкопу',
        '',
        route.title,
        'Имя — ' + plan.visitor,
        'Дата — ' + formatDate(plan.date),
        'Участники — ' + plan.people
    ];
    if (plan.time) lines.push('Время старта — ' + plan.time);
    if (email) lines.push('Email — ' + email);
    lines.push(
        'Расстояние — около ' + route.distance,
        'Время в пути — ' + route.duration + ' пешком',
        'Точка старта — Национальный музей Республики Адыгея, ул. Советская, 229',
        '',
        'Остановки'
    );
    for (const [index, stop] of route.stops.entries()) {
        const description = stop.note ? stop.name + ' — ' + stop.note : stop.name;
        lines.push((index + 1) + '. ' + description);
    }

    const file = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    return URL.createObjectURL(file);
}

function savedPlanItem(plan, index, profile) {
    const route = routes.get(plan.route);
    const item = document.createElement('li');
    item.className = 'booking-saved-plan';

    const description = document.createElement('div');
    const title = document.createElement('strong');
    const schedule = document.createElement('p');
    title.textContent = route.title;
    schedule.textContent = formatSchedule(plan);
    description.append(title, schedule);

    const actions = document.createElement('div');
    actions.className = 'booking-saved-actions';
    const download = document.createElement('a');
    download.href = planFileUrl(plan);
    download.download = bookingDownload.download;
    download.textContent = 'Скачать';
    download.setAttribute('aria-label', 'Скачать план прогулки «' + route.title + '» на ' + formatDate(plan.date));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Удалить';
    remove.setAttribute('aria-label', 'Удалить план прогулки «' + route.title + '» на ' + formatDate(plan.date));
    remove.addEventListener('click', () => {
        profile.plans.splice(index, 1);
        if (!bookingResult.hidden && samePlan(plan, currentPlan())) {
            bookingStatus.textContent = 'План прогулки готов. ' + formatSchedule(plan) + '.';
        }
        writeProfileState();
        renderProfile();
        const nextAction = savedPlans.children[index]?.querySelector('button')
            || savedPlans.lastElementChild?.querySelector('button')
            || profileSignout;
        nextAction.focus();
        showProfileStatus('План удалён.');
    });

    actions.append(download, remove);
    item.append(description, actions);
    return item;
}

function renderProfile() {
    const profile = activeProfile();
    profileForm.hidden = Boolean(profile);
    profileActive.hidden = !profile;
    profileDisplay.textContent = profile?.name || '';
    profileEmpty.hidden = Boolean(profile?.plans.length);

    for (const download of savedPlans.querySelectorAll('a[download]')) {
        URL.revokeObjectURL(download.href);
    }
    savedPlans.replaceChildren();
    if (profile) {
        for (const [index, plan] of profile.plans.entries()) {
            savedPlans.append(savedPlanItem(plan, index, profile));
        }
    }
    showProfileStatus();
}

function fillVisitor(previousName, nextName) {
    if (!visitor.value.trim() || visitor.value === previousName) {
        visitor.value = nextName;
        visitor.setCustomValidity('');
        clearBooking();
    }
}

for (const button of routeButtons) {
    button.addEventListener('click', () => selectRoute(button.dataset.route));
}

for (const link of document.querySelectorAll('[data-book-route]')) {
    link.addEventListener('click', () => selectRoute(link.dataset.bookRoute));
}

booking.addEventListener('input', (event) => {
    if (event.target === bookingRoute) return;
    if (event.target === visitor) visitor.setCustomValidity('');
    clearBooking();
    renderBookingPreview();
});

bookingRoute.addEventListener('change', () => selectRoute(bookingRoute.value));

function warmEmailConnection() {
    if (!bookingEmail.value) return;
    const hint = document.createElement('link');
    hint.rel = 'preconnect';
    hint.href = emailService;
    document.head.append(hint);
    bookingEmail.removeEventListener('input', warmEmailConnection);
}

if (emailEnabled) {
    document.querySelector('#booking-email-note').hidden = false;
    bookingEmail.setAttribute('aria-describedby', 'booking-email-note');
    bookingEmail.addEventListener('input', warmEmailConnection);
}

function sendBookingEmail(plan, email) {
    if (bookingPrepare.disabled) return;
    if (lastEmail?.email === email && samePlan(lastEmail.plan, plan)) {
        emailStatus.textContent = 'Этот план уже отправлен на ' + email + '.';
        return;
    }
    if (!navigator.onLine) {
        emailStatus.textContent = 'Для отправки письма подключитесь к интернету. План можно скачать сейчас.';
        return;
    }

    const route = routes.get(plan.route);
    const attempt = crypto.randomUUID();
    const receipt = new URL('email-receipt.html', location.href);
    receipt.searchParams.set('attempt', attempt);

    const frame = document.createElement('iframe');
    frame.name = 'booking-email-' + attempt;
    frame.title = 'Проверка отправки письма';
    frame.className = 'booking-email-frame full-width';
    frame.sandbox = 'allow-forms allow-scripts allow-same-origin';
    frame.hidden = true;

    const transport = document.createElement('form');
    transport.method = 'post';
    transport.action = emailService + emailEndpoint;
    transport.target = frame.name;
    transport.hidden = true;

    const fields = {
        email,
        'Имя': plan.visitor,
        'Маршрут': route.title,
        'Дата': formatDate(plan.date),
        'Участники': String(plan.people),
        'Точка старта': 'Национальный музей Республики Адыгея, улица Советская, 229',
        'Остановки': route.stops.map((stop) => stop.name).join(' → '),
        _subject: 'Новый план прогулки по Майкопу',
        _autoresponse: 'Вот ваш план прогулки по Майкопу. Возьмите его с собой на маршрут.',
        _template: 'table',
        _url: new URL('index.html', location.href).href,
        _next: receipt.href
    };
    if (plan.time) fields['Время старта'] = plan.time;
    for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        transport.append(input);
    }

    let deadline;
    let slowNotice;
    function finish(accepted) {
        window.clearTimeout(deadline);
        window.clearTimeout(slowNotice);
        transport.remove();
        frame.remove();
        bookingPrepare.disabled = false;
        if (accepted) {
            lastEmail = { email, plan };
            emailStatus.textContent = 'План отправлен на ' + email + '.';
        } else {
            emailStatus.textContent = 'Сервис пока не подтвердил отправку. План доступен для скачивания.';
        }
    }

    frame.addEventListener('load', () => {
        let responseUrl;
        try {
            responseUrl = frame.contentWindow.location.href;
        } catch {
            if (frame.hidden) {
                frame.hidden = false;
                window.clearTimeout(slowNotice);
                emailStatus.textContent = 'Откройте сообщение ниже и завершите проверку отправки.';
                window.clearTimeout(deadline);
                deadline = window.setTimeout(() => finish(false), 120000);
            }
            return;
        }
        if (responseUrl === receipt.href) finish(true);
    });

    bookingPrepare.disabled = true;
    emailStatus.textContent = 'Отправляем копию плана на ' + email + '…';
    slowNotice = window.setTimeout(() => {
        emailStatus.textContent = 'Почтовый сервис отвечает дольше обычного. План уже доступен для скачивания.';
    }, 5000);
    deadline = window.setTimeout(() => finish(false), 25000);
    emailStatus.after(frame);
    document.body.append(transport);
    transport.submit();
}

booking.addEventListener('submit', (event) => {
    event.preventDefault();
    const plan = currentPlan();
    visitor.setCustomValidity(plan.visitor ? '' : 'Введите имя.');
    if (!booking.reportValidity()) return;

    clearBooking();
    downloadUrl = planFileUrl(plan, bookingEmail.value);
    bookingDownload.href = downloadUrl;
    bookingResult.hidden = false;
    const schedule = ' ' + formatSchedule(plan) + '.';
    bookingStatus.textContent = 'План прогулки готов.' + schedule;
    if (emailEnabled) {
        if (bookingEmail.value) sendBookingEmail(plan, bookingEmail.value);
        else emailStatus.textContent = '';
    }

    const profile = activeProfile();
    if (!profile) return;

    const alreadySaved = profile.plans.some((saved) => samePlan(saved, plan));
    if (!alreadySaved) {
        profile.plans.unshift(plan);
        writeProfileState();
        renderProfile();
    }
    bookingStatus.textContent = storageUnavailable
        ? 'План прогулки готов и доступен в профиле до закрытия страницы.' + schedule
        : 'План прогулки готов и сохранён в профиле.' + schedule;
});

profileName.addEventListener('input', () => profileName.setCustomValidity(''));

profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = profileName.value.trim();
    profileName.setCustomValidity(name ? '' : 'Введите имя профиля.');
    if (!profileForm.reportValidity()) return;

    const normalizedName = name.toLocaleLowerCase('ru-RU');
    let profile = profileState.profiles.find((entry) => entry.name.toLocaleLowerCase('ru-RU') === normalizedName);
    if (!profile) {
        profile = { name, plans: [] };
        profileState.profiles.push(profile);
    }

    profileState.active = profile.name;
    writeProfileState();
    fillVisitor('', profile.name);
    profileForm.reset();
    renderProfile();
    profileSignout.focus();
});

profileSignout.addEventListener('click', () => {
    const previousName = activeProfile()?.name;
    profileState.active = '';
    writeProfileState();
    fillVisitor(previousName, '');
    renderProfile();
    profileName.focus();
});

window.addEventListener('storage', (event) => {
    if (storageUnavailable || (event.key !== profileStorageKey && event.key !== null)) return;

    const previousName = activeProfile()?.name;
    profileState = readProfileState();
    fillVisitor(previousName, activeProfile()?.name || '');
    renderProfile();
});

const requestedRoute = new URLSearchParams(location.search).get('route');
selectRoute(routes.has(requestedRoute) ? requestedRoute : bookingRoute.value);
fillVisitor('', activeProfile()?.name || '');
renderProfile();
bookingPrepare.disabled = false;

const photoDialog = document.querySelector('#photo-dialog');
const photoButtons = Array.from(document.querySelectorAll('.photo-button'));
const enlargedPhoto = document.querySelector('#enlarged-photo');
const photoCaption = document.querySelector('#photo-caption');
const photoCount = document.querySelector('#photo-count');
const previousPhoto = photoDialog.querySelector('[data-gallery-direction="previous"]');
const nextPhoto = photoDialog.querySelector('[data-gallery-direction="next"]');
let photoIndex = 0;
let galleryOpener;

function showPhoto(index) {
    photoIndex = (index + photoButtons.length) % photoButtons.length;
    const button = photoButtons[photoIndex];
    const photo = button.querySelector('img');
    const caption = button.closest('figure').querySelector('figcaption');

    enlargedPhoto.setAttribute('src', photo.getAttribute('src'));
    enlargedPhoto.alt = photo.alt;
    photoCaption.textContent = caption.textContent.trim();
    photoCount.textContent = (photoIndex + 1) + ' из ' + photoButtons.length;
}

for (const [index, button] of photoButtons.entries()) {
    button.addEventListener('click', function () {
        galleryOpener = button;
        showPhoto(index);
        photoDialog.showModal();
    });
}

previousPhoto.addEventListener('click', function () {
    showPhoto(photoIndex - 1);
});

nextPhoto.addEventListener('click', function () {
    showPhoto(photoIndex + 1);
});

function handleGalleryTouch(button, action) {
    button.addEventListener('touchend', function (event) {
        if (!event.cancelable || event.touches.length || event.changedTouches.length !== 1) return;

        const touch = event.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!button.contains(target)) return;

        event.preventDefault();
        action();
    }, { passive: false });
}

handleGalleryTouch(previousPhoto, () => showPhoto(photoIndex - 1));
handleGalleryTouch(nextPhoto, () => showPhoto(photoIndex + 1));
handleGalleryTouch(photoDialog.querySelector('form button'), () => photoDialog.close());

photoDialog.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPhoto(photoIndex - 1);
    }
    if (event.key === 'ArrowRight') {
        event.preventDefault();
        showPhoto(photoIndex + 1);
    }
});

photoDialog.addEventListener('click', function (event) {
    if (event.target !== photoDialog) {
        return;
    }
    const dialogBounds = photoDialog.getBoundingClientRect();
    if (event.clientX < dialogBounds.left || event.clientX > dialogBounds.right ||
        event.clientY < dialogBounds.top || event.clientY > dialogBounds.bottom) {
        photoDialog.close();
    }
});

photoDialog.addEventListener('close', function () {
    if (galleryOpener) {
        galleryOpener.focus();
        galleryOpener = undefined;
    }
});

let swipeStart;

enlargedPhoto.addEventListener('pointerdown', function (event) {
    if (event.pointerType !== 'touch') return;

    if (!event.isPrimary) {
        swipeStart = undefined;
        return;
    }

    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    enlargedPhoto.setPointerCapture(event.pointerId);
});

enlargedPhoto.addEventListener('pointerup', function (event) {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;

    const horizontal = event.clientX - swipeStart.x;
    const vertical = event.clientY - swipeStart.y;
    swipeStart = undefined;

    if (Math.abs(horizontal) >= 45 && Math.abs(horizontal) > Math.abs(vertical) * 1.25) {
        showPhoto(photoIndex + (horizontal < 0 ? 1 : -1));
    }
});

function cancelSwipe(event) {
    if (swipeStart?.id === event.pointerId) swipeStart = undefined;
}

enlargedPhoto.addEventListener('pointercancel', cancelSwipe);
enlargedPhoto.addEventListener('lostpointercapture', cancelSwipe);
photoDialog.addEventListener('close', function () {
    swipeStart = undefined;
});
