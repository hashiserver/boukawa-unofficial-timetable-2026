const DEFAULT_DELAY_MS = 540;
const DEFAULT_MOVE_LIMIT = 10;

export function bindLongPress(target, onActivate, options = {}) {
  const setTimer = options.setTimeoutFn || setTimeout;
  const clearTimer = options.clearTimeoutFn || clearTimeout;
  const delay = options.delay ?? DEFAULT_DELAY_MS;
  const moveLimit = options.moveLimit ?? DEFAULT_MOVE_LIMIT;
  let timerId = null;
  let origin = null;

  const stopTimer = () => {
    if (timerId !== null) clearTimer(timerId);
    timerId = null;
    origin = null;
  };

  const onPointerDown = (event) => {
    if (event.isPrimary === false) { stopTimer(); return; }
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopTimer();
    origin = { x: event.clientX, y: event.clientY };
    timerId = setTimer(() => {
      timerId = null;
      onActivate();
    }, delay);
  };

  const onPointerMove = (event) => {
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > moveLimit) stopTimer();
  };

  const onPointerEnd = () => {
    stopTimer();
  };

  const onKeyDown = (event) => {
    if ((event.key !== "Enter" && event.key !== " ") || event.repeat) return;
    event.preventDefault();
    onActivate();
  };

  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerup", onPointerEnd);
  target.addEventListener("pointercancel", onPointerEnd);
  target.addEventListener("pointerleave", onPointerEnd);
  target.addEventListener("contextmenu", preventDefault);
  target.addEventListener("keydown", onKeyDown);

  return () => {
    stopTimer();
    target.removeEventListener("pointerdown", onPointerDown);
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", onPointerEnd);
    target.removeEventListener("pointercancel", onPointerEnd);
    target.removeEventListener("pointerleave", onPointerEnd);
    target.removeEventListener("contextmenu", preventDefault);
    target.removeEventListener("keydown", onKeyDown);
  };
}

function preventDefault(event) {
  event.preventDefault();
}
