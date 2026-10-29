'use strict';
document.documentElement.classList.add('js');
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [
  ...scope.querySelectorAll(selector),
];
let toastTimer;
function announce(message) {
  const toast = $('#live-announcement');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}
const dialogTriggers = new WeakMap();
function showDialog(dialog, trigger) {
  if (!dialog || dialog.open) return;
  dialogTriggers.set(dialog, trigger);
  dialog.showModal();
  document.body.classList.add('has-dialog');
}
$$('[data-open-dialog]').forEach((trigger) =>
  trigger.addEventListener('click', () => {
    const dialog = document.getElementById(trigger.dataset.openDialog);
    if (dialog?.id === 'photo-dialog')
      setPhoto(Number(trigger.dataset.galleryIndex || 0));
    if (dialog?.id === 'share-dialog')
      $('[data-share-url]', dialog).value = location.origin + location.pathname;
    showDialog(dialog, trigger);
  }),
);
$$('dialog').forEach((dialog) => {
  $$('[data-close-dialog]', dialog).forEach((button) =>
    button.addEventListener('click', () => dialog.close()),
  );
  dialog.addEventListener('close', () => {
    if (!$('dialog[open]')) document.body.classList.remove('has-dialog');
    dialogTriggers.get(dialog)?.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
});
const menus = $$('[data-menu]');
menus.forEach((menu) =>
  menu.addEventListener('toggle', () => {
    $('summary', menu).setAttribute('aria-expanded', String(menu.open));
    if (menu.open)
      menus.forEach((other) => {
        if (other !== menu) other.open = false;
      });
  }),
);
document.addEventListener('pointerdown', (event) =>
  menus.forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  }),
);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape')
    menus.forEach((menu) => {
      menu.open = false;
    });
});
$$('[data-dismiss-notice]').forEach((button) =>
  button.addEventListener('click', () =>
    button.closest('.success-notice').remove(),
  ),
);
$$('[data-step]').forEach((button) =>
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.stepTarget);
    if (!input) return;
    const isSearchGuest = input.hasAttribute('data-guest-input');
    const min = isSearchGuest ? 0 : Number(input.min || 0);
    const max = Number(input.max || 30);
    const next = Math.max(
      min,
      Math.min(max, Number(input.value || 0) + Number(button.dataset.step)),
    );
    input.value = isSearchGuest && next === 0 ? '' : String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }),
);
function updateSteppers() {
  $$('[data-step]').forEach((button) => {
    const input = document.getElementById(button.dataset.stepTarget);
    if (!input) return;
    const min = input.hasAttribute('data-guest-input')
      ? 0
      : Number(input.min || 0);
    button.disabled =
      Number(button.dataset.step) < 0
        ? Number(input.value || 0) <= min
        : Number(input.value || 0) >= Number(input.max || 30);
  });
}
const guestInput = $('[data-guest-input]');
if (guestInput)
  guestInput.addEventListener('input', () => {
    const summary = $('[data-guest-summary]');
    summary.textContent = guestInput.value
      ? guestInput.value + (guestInput.value === '1' ? ' guest' : ' guests')
      : 'Add guests';
    updateSteppers();
  });
$$('.stepper-control input').forEach((input) =>
  input.addEventListener('input', updateSteppers),
);
updateSteppers();
$('[data-clear-filters]')?.addEventListener('click', () => {
  const dialog = $('#filters-dialog');
  $$('input[type="radio"]', dialog).forEach((input) => {
    input.checked = input.value === '';
  });
  $$('input[type="number"]', dialog).forEach((input) => {
    input.value = '';
  });
  $('select[name="sort"]', dialog).value = 'newest';
});
const calendarTime = (value) =>
  value ? Date.parse(value + 'T00:00:00Z') : NaN;
const dateValue = (time) => new Date(time).toISOString().slice(0, 10);
const money = (paise) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
$$('form').forEach((form) => {
  const arrival = $('[data-check-in]', form),
    departure = $('[data-check-out]', form);
  if (!arrival || !departure) return;
  const booking = form.hasAttribute('data-booking-form');
  const occupied = (form.dataset.occupied || '').split(',').filter(Boolean);
  function refreshDates() {
    const start = calendarTime(arrival.value),
      end = calendarTime(departure.value);
    const hasStart = Number.isFinite(start),
      hasEnd = Number.isFinite(end);
    if (!booking) {
      arrival.required = !!departure.value;
      departure.required = !!arrival.value;
    }
    departure.min = hasStart ? dateValue(start + 86400000) : arrival.min;
    departure.max = hasStart ? dateValue(start + 90 * 86400000) : '';
    let error = '';
    if (hasStart && hasEnd && (end <= start || end - start > 90 * 86400000))
      error = 'Choose a stay between 1 and 90 nights.';
    if (
      !error &&
      booking &&
      hasStart &&
      hasEnd &&
      occupied.some((day) => {
        const time = calendarTime(day);
        return time >= start && time < end;
      })
    )
      error =
        'Some of these nights are already reserved. Please choose different dates.';
    departure.setCustomValidity(error);
    const message = $('[data-booking-error]', form);
    if (message) {
      message.textContent = error;
      message.hidden = !error;
    }
    const preview = $('[data-price-preview]', form);
    if (preview) {
      preview.hidden = !hasStart || !hasEnd || !!error;
      if (!preview.hidden) {
        const nights = (end - start) / 86400000,
          nightly = Number(form.dataset.nightly),
          total = nightly * nights;
        $('[data-nightly-label]', form).textContent =
          money(nightly) +
          ' × ' +
          nights +
          (nights === 1 ? ' night' : ' nights');
        $('[data-stay-price]', form).textContent = money(total);
        $('[data-total-price]', form).textContent = money(total);
      }
    }
  }
  arrival.addEventListener('input', refreshDates);
  departure.addEventListener('input', refreshDates);
  form.addEventListener('submit', (event) => {
    refreshDates();
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
  refreshDates();
});
$$('[data-save-form]').forEach((form) =>
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button', form);
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(new FormData(form)),
        credentials: 'same-origin',
      });
      if (response.redirected && new URL(response.url).pathname === '/login') {
        location.assign('/login');
        return;
      }
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json')
      )
        throw Error('save');
      const result = await response.json();
      $$('[data-save-form]')
        .filter(
          (other) =>
            other.getAttribute('action') === form.getAttribute('action'),
        )
        .forEach((other) => {
          const toggle = $('button', other);
          $('[name="action"]', other).value = result.saved ? 'remove' : 'save';
          toggle.classList.toggle('is-saved', result.saved);
          toggle.setAttribute('aria-pressed', String(result.saved));
          const label = toggle.getAttribute('aria-label');
          if (label)
            toggle.setAttribute(
              'aria-label',
              label.replace(
                /^(Remove from saved|Save)/,
                result.saved ? 'Remove from saved' : 'Save',
              ),
            );
          const text = $('[data-save-label]', other);
          if (text) text.textContent = result.saved ? 'Saved' : 'Save';
        });
      announce(
        result.saved ? 'Added to your wishlist' : 'Removed from your wishlist',
      );
      if ($('[data-saved-page="true"]') && !result.saved) location.reload();
    } catch {
      announce(
        'Couldn’t update your wishlist. Refresh the page and try again.',
      );
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }),
);
let activePhoto = 0;
const galleryPhotos = $$('[data-gallery-photo]');
function setPhoto(index) {
  if (!galleryPhotos.length) return;
  activePhoto = (index + galleryPhotos.length) % galleryPhotos.length;
  galleryPhotos.forEach((photo, i) => {
    photo.hidden = i !== activePhoto;
  });
  const counter = $('[data-gallery-counter]');
  if (counter)
    counter.textContent = activePhoto + 1 + ' / ' + galleryPhotos.length;
}
$$('[data-gallery-step]').forEach((button) =>
  button.addEventListener('click', () =>
    setPhoto(activePhoto + Number(button.dataset.galleryStep)),
  ),
);
document.addEventListener('keydown', (event) => {
  if (!$('#photo-dialog')?.open) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    setPhoto(activePhoto + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
$('[data-copy-link]')?.addEventListener('click', async () => {
  const input = $('[data-share-url]');
  try {
    await navigator.clipboard.writeText(input.value);
    const label = $('[data-copy-label]');
    if (label) label.textContent = 'Link copied';
    const status = $('[data-copy-status]');
    if (status) status.textContent = 'Property link copied to clipboard.';
  } catch {
    input.focus();
    input.select();
    announce('Select and copy the property link.');
  }
});
$('[data-expand-description]')?.addEventListener('click', (event) => {
  const text = $('[data-description]'),
    button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  text.classList.toggle('description-collapsed', !expanded);
  button.setAttribute('aria-expanded', String(expanded));
  $('u', button).textContent = expanded ? 'Show less' : 'Show more';
});
$$('[data-toggle-password]').forEach((button) =>
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword),
      visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute(
      'aria-label',
      visible ? 'Hide password' : 'Show password',
    );
    button.setAttribute('aria-pressed', String(visible));
  }),
);
$$('[data-count-input]').forEach((input) =>
  input.addEventListener('input', () => {
    const count = document.querySelector('[data-count-for="' + input.id + '"]');
    if (count) count.textContent = String(input.value.length);
  }),
);
$('[data-image-url]')?.addEventListener('change', (event) => {
  const input = event.currentTarget;
  if (!input.value || !input.checkValidity()) return;
  try {
    const url = new URL(input.value);
    if (['https:', 'http:'].includes(url.protocol))
      $('[data-image-preview]').src = url.href;
  } catch {}
});
let uploadUrl;
const upload = $('[data-upload-preview]');
if (upload) {
  upload.addEventListener('change', () => {
    const file = upload.files[0];
    upload.setCustomValidity('');
    if (!file) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      upload.setCustomValidity('Choose a JPEG, PNG or WebP photo up to 5 MB.');
      upload.reportValidity();
      return;
    }
    $('[data-file-name]').textContent = file.name;
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    uploadUrl = URL.createObjectURL(file);
    $('[data-image-preview]').src = uploadUrl;
  });
}
const tripTabs = $$('[data-trip-filter]');
function selectTripTab(button) {
  const filter = button.dataset.tripFilter;
  tripTabs.forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const cards = $$('[data-trip-group]');
  cards.forEach((card) => {
    card.hidden = filter !== 'all' && card.dataset.tripGroup !== filter;
  });
  const empty = $('[data-trip-empty]');
  if (empty) empty.hidden = !cards.length || cards.some((card) => !card.hidden);
}
tripTabs.forEach((button, index) => {
  button.addEventListener('click', () => selectTripTab(button));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tripTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tripTabs.length) %
            tripTabs.length;
    selectTripTab(tripTabs[next]);
    tripTabs[next].focus();
  });
});
$$('form[method="POST"], form[method="post"]').forEach((form) =>
  form.addEventListener('submit', (event) => {
    if (
      event.defaultPrevented ||
      !form.checkValidity() ||
      form.hasAttribute('data-save-form')
    )
      return;
    const submit = event.submitter;
    if (submit) {
      submit.disabled = true;
      submit.classList.add('is-loading');
      submit.setAttribute('aria-busy', 'true');
    }
  }),
);
window.addEventListener('pageshow', () =>
  $$('button.is-loading').forEach((button) => {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }),
);
$$('.mobile-nav a').forEach((link) => {
  const path = new URL(link.href).pathname;
  link.classList.toggle(
    'active',
    path === '/listings'
      ? location.pathname.startsWith('/listings')
      : location.pathname.startsWith(path),
  );
});

// A reusable date-range picker; native date inputs remain the form's source of truth.
const datesDialog = $('#dates-dialog');
let calendarForm,
  calendarStart = '',
  calendarEnd = '',
  calendarMonth;
const calendarToday = new Date().toISOString().slice(0, 10);
const dayMs = 86400000;
function dateLabel(value) {
  return new Date(value + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
function calendarDateDisabled(value) {
  const time = calendarTime(value),
    now = calendarTime(calendarToday);
  if (time < now) return true;
  const selectingEnd = calendarStart && !calendarEnd;
  const occupied = (calendarForm?.dataset.occupied || '')
    .split(',')
    .filter(Boolean);
  if (!selectingEnd)
    return time > now + 365 * dayMs || occupied.includes(value);
  const start = calendarTime(calendarStart);
  if (time <= start)
    return occupied.includes(value) || time > now + 365 * dayMs;
  return (
    time - start > 90 * dayMs ||
    occupied.some((date) => {
      const night = calendarTime(date);
      return night >= start && night < time;
    })
  );
}
function renderCalendar() {
  const container = $('[data-calendar-months]');
  if (!container || !calendarMonth) return;
  container.replaceChildren();
  for (let offset = 0; offset < 2; offset++) {
    const month = new Date(
      Date.UTC(
        calendarMonth.getUTCFullYear(),
        calendarMonth.getUTCMonth() + offset,
        1,
      ),
    );
    const section = document.createElement('section');
    section.className = 'calendar-month';
    const heading = document.createElement('h3');
    heading.textContent = month.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    section.append(heading);
    const weekdays = document.createElement('div');
    weekdays.className = 'calendar-weekdays';
    for (const name of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) {
      const label = document.createElement('span');
      label.textContent = name;
      weekdays.append(label);
    }
    section.append(weekdays);
    const days = document.createElement('div');
    days.className = 'calendar-days';
    const padding = (month.getUTCDay() + 6) % 7;
    for (let empty = 0; empty < padding; empty++)
      days.append(document.createElement('span'));
    const count = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    for (let day = 1; day <= count; day++) {
      const value = dateValue(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day),
      );
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      button.textContent = String(day);
      button.dataset.calendarDate = value;
      button.setAttribute('aria-label', dateLabel(value));
      button.disabled = calendarDateDisabled(value);
      const selected = value === calendarStart || value === calendarEnd;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
      button.classList.toggle('today', value === calendarToday);
      button.classList.toggle(
        'in-range',
        !!calendarStart &&
          !!calendarEnd &&
          value > calendarStart &&
          value < calendarEnd,
      );
      button.addEventListener('click', () => {
        if (!calendarStart || calendarEnd || value <= calendarStart) {
          calendarStart = value;
          calendarEnd = '';
        } else calendarEnd = value;
        renderCalendar();
        $('[data-calendar-date="' + value + '"]')?.focus();
      });
      days.append(button);
    }
    section.append(days);
    container.append(section);
  }
  const current = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  );
  $('[data-calendar-month="-1"]').disabled = calendarMonth <= current;
  $('[data-calendar-month="1"]').disabled =
    calendarMonth >=
    new Date(
      Date.UTC(current.getUTCFullYear() + 1, current.getUTCMonth() + 3, 1),
    );
  $('[data-calendar-instruction]').textContent =
    calendarStart && !calendarEnd
      ? 'Now choose a check-out date.'
      : 'Choose a check-in date, then a check-out date.';
  $('[data-calendar-selection]').textContent = calendarStart
    ? dateLabel(calendarStart) +
      (calendarEnd ? ' — ' + dateLabel(calendarEnd) : ' — Select check-out')
    : 'Your next getaway starts with a date.';
  $('[data-apply-dates]').disabled =
    (!calendarStart || !calendarEnd) &&
    (!!calendarStart ||
      !!calendarEnd ||
      calendarForm?.hasAttribute('data-booking-form'));
}
function openCalendar(input) {
  calendarForm = input.closest('form');
  if (!calendarForm || !datesDialog) return;
  calendarStart = $('[data-check-in]', calendarForm).value;
  calendarEnd = $('[data-check-out]', calendarForm).value;
  const initial = calendarStart
    ? new Date(calendarStart + 'T00:00:00Z')
    : new Date();
  calendarMonth = new Date(
    Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1),
  );
  renderCalendar();
  showDialog(datesDialog, input);
}
$$('[data-check-in], [data-check-out]').forEach((input) => {
  input.setAttribute('aria-haspopup', 'dialog');
  input.addEventListener('click', (event) => {
    event.preventDefault();
    openCalendar(input);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCalendar(input);
    }
  });
});
$$('[data-calendar-month]').forEach((button) =>
  button.addEventListener('click', () => {
    calendarMonth = new Date(
      Date.UTC(
        calendarMonth.getUTCFullYear(),
        calendarMonth.getUTCMonth() + Number(button.dataset.calendarMonth),
        1,
      ),
    );
    renderCalendar();
  }),
);
$('[data-clear-dates]')?.addEventListener('click', () => {
  calendarStart = '';
  calendarEnd = '';
  renderCalendar();
});
$('[data-apply-dates]')?.addEventListener('click', () => {
  if (!calendarForm) return;
  const arrival = $('[data-check-in]', calendarForm),
    departure = $('[data-check-out]', calendarForm);
  arrival.value = calendarStart;
  departure.value = calendarEnd;
  arrival.dispatchEvent(new Event('input', { bubbles: true }));
  departure.dispatchEvent(new Event('input', { bubbles: true }));
  datesDialog.close();
});

// Follow the currently visible editor/settings section without changing form data.
const sectionLinks = $$(
  '.editor-sidebar a[href^="#"], .account-sidebar a[href^="#"]',
);
if (sectionLinks.length) {
  let sectionFrame = false;
  const updateSections = () => {
    let active = sectionLinks[0];
    for (const link of sectionLinks) {
      const section = document.querySelector(link.getAttribute('href'));
      if (section && section.getBoundingClientRect().top <= 170) active = link;
    }
    sectionLinks.forEach((link) => {
      link.classList.toggle('active', link === active);
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    sectionFrame = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!sectionFrame) {
        sectionFrame = true;
        requestAnimationFrame(updateSections);
      }
    },
    { passive: true },
  );
  updateSections();
}
