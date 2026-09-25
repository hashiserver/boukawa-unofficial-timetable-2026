const INTRO_STORAGE_KEY = 'bou-kwai-timetable:intro-seen:v1';

export function showIntroOnce() {
  try {
    if (localStorage.getItem(INTRO_STORAGE_KEY) === '1') return;
  } catch { /* The guide remains usable when storage is unavailable. */ }
  const dialog = document.querySelector('#intro-dialog');
  if (!dialog) return;
  dialog.addEventListener('close', () => {
    try { localStorage.setItem(INTRO_STORAGE_KEY, '1'); } catch { /* Optional persistence. */ }
    document.querySelector('.day-button[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
}
