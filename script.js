const routeButtons = document.querySelectorAll('[data-route]');
const routePanels = document.querySelectorAll('[data-route-panel]');
const booking = document.querySelector('#booking-form');
const bookingRoute = booking.elements.route;
const visitor = booking.elements.visitor;
const bookingStatus = document.querySelector('#booking-status');
const bookingResult = document.querySelector('#booking-result');
const bookingDownload = document.querySelector('#booking-download');
let downloadUrl;

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
    for (const button of routeButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.route === route));
    }
    for (const panel of routePanels) {
        panel.hidden = panel.dataset.routePanel !== route;
    }
    if (bookingRoute.value !== route) {
        bookingRoute.value = route;
        clearBooking();
    }
}

for (const button of routeButtons) {
    button.addEventListener('click', function () {
        selectRoute(button.dataset.route);
    });
}

for (const link of document.querySelectorAll('[data-book-route]')) {
    link.addEventListener('click', function () {
        selectRoute(link.dataset.bookRoute);
    });
}

selectRoute(bookingRoute.value);

booking.addEventListener('input', function (event) {
    if (event.target === visitor) {
        visitor.setCustomValidity('');
    }
    clearBooking();
});

bookingRoute.addEventListener('change', function () {
    selectRoute(bookingRoute.value);
    clearBooking();
});

booking.addEventListener('submit', function (event) {
    event.preventDefault();
    clearBooking();

    const name = visitor.value.trim();
    visitor.setCustomValidity(name ? '' : 'Введите имя.');
    if (!booking.reportValidity()) {
        return;
    }

    const panel = Array.from(routePanels).find(function (panel) {
        return panel.dataset.routePanel === bookingRoute.value;
    });
    const title = panel.querySelector('h2, h3, h4').textContent.trim();
    const [year, month, day] = booking.elements.date.value.split('-');
    const date = [day, month, year].join('.');
    const people = booking.elements.people.value;
    const lines = [
        'Маршрут по Майкопу',
        '',
        title,
        'Имя — ' + name,
        'Дата — ' + date,
        'Участники — ' + people,
        ''
    ];
    const stops = panel.querySelectorAll('ol li');
    for (const [index, stop] of stops.entries()) {
        const label = stop.querySelector('strong');
        const instruction = stop.querySelector('span');
        const stopText = label && instruction
            ? label.textContent.trim() + ' — ' + instruction.textContent.trim()
            : stop.textContent.trim();
        lines.push((index + 1) + '. ' + stopText);
    }

    const file = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    downloadUrl = URL.createObjectURL(file);
    bookingDownload.href = downloadUrl;
    bookingResult.hidden = false;
    bookingStatus.textContent = 'План прогулки готов. ' + date + ' · участников: ' + people;
});

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
