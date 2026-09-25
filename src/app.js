import { showIntroOnce } from "./intro.js";
const scheduleResponse = await fetch(new URL("../data/schedule.json", import.meta.url));
if (!scheduleResponse.ok) throw new Error(`Schedule data could not be loaded (${scheduleResponse.status}).`);
const scheduleData = await scheduleResponse.json();
import {
  getDefaultDay,
  getEventStatus,
  getNowLineOffset,
  getPinnedSummary,
  getTimelineOffset,
  getTokyoDateKey,
  parseClock,
  PIXELS_PER_MINUTE,
  TIMELINE_END_MINUTE,
  TIMELINE_START_MINUTE,
} from "./schedule.js";
import { requiredScale } from "./layout.js";
import { bindLongPress } from "./longpress.js";

const PIN_STORAGE_KEY = "bou-kwai-timetable:pins:v1";
const DAY_BY_NUMBER = new Map(scheduleData.days.map((day) => [day.day, day]));
const ALL_EVENTS = scheduleData.days.flatMap((day) =>
  day.floors.flatMap((floor) => floor.events.map((event) => ({
    ...event,
    day: day.day,
    date: day.date,
    floor: floor.floor,
  }))),
);
const KNOWN_IDS = new Set(ALL_EVENTS.map(({ id }) => id));

const scroller = document.querySelector("#schedule-scroller");
const timelineBody = document.querySelector("#timeline-body");
const floorHeader = document.querySelector("#floor-header");
const summary = document.querySelector("#pinned-summary");
const nowButton = document.querySelector("#now-button");
const liveRegion = document.querySelector("#live-region");
const dayButtons = [...document.querySelectorAll(".day-button")];

let selectedDay = getDefaultDay();
let pinnedIds = loadPinnedIds();
let currentNow = new Date();
let activeNowOffset = null;
let pixelsPerMinute = PIXELS_PER_MINUTE;
let followingNow = true;
let cardCleanups = [];
let summarySignature = "";
const eventById = new Map(ALL_EVENTS.map(event => [event.id, event]));

function loadPinnedIds() {
  try {
    const value = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((id) => typeof id === "string" && KNOWN_IDS.has(id)));
  } catch {
    return new Set();
  }
}

function savePinnedIds() {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...pinnedIds]));
  } catch {
    liveRegion.textContent = "このブラウザでは予定を保存できませんでした。";
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function dayEvents(dayNumber = selectedDay) {
  const day = DAY_BY_NUMBER.get(dayNumber);
  return day.floors.flatMap((floor) => floor.events.map((event) => ({
    ...event,
    day: day.day,
    date: day.date,
    floor: floor.floor,
  })));
}

function addTimeLabels(timeAxis) {
  for (let minute = TIMELINE_START_MINUTE; minute <= TIMELINE_END_MINUTE; minute += 30) {
    const label = makeElement("time", "time-label", `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
    label.dataset.minute = minute;
    label.style.top = `${(minute - TIMELINE_START_MINUTE) * PIXELS_PER_MINUTE}px`;
    timeAxis.append(label);
  }
}

function makePinMark() {
  const wrapper = makeElement("span", "pin-mark");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = "<svg viewBox=\"0 0 16 16\"><path d=\"M10.8 1.6a.8.8 0 0 0-1.1 0L8.2 3.1l-1.1-.3a.8.8 0 0 0-.8 1.3l1.2 1.2-3.9 3.9a.8.8 0 0 0 .3 1.3l2.5.9 1 2.6a.8.8 0 0 0 1.3.2l3.8-4 1.2 1.2a.8.8 0 0 0 1.3-.8l-.4-1.1 1.5-1.5a.8.8 0 0 0 0-1.1zM7.1 13.1l-.7-1.8 3.8-3.8 1.1 1.1-3.7 3.9z\"/></svg>";
  return wrapper;
}

function formatEventLabel(event, status) {
  const parts = [`${event.start}–${event.end}`, `FLOOR ${event.floor}`, event.artist];
  if (event.vj?.length) parts.push(`VJ ${event.vj.join(", ")}`);
  if (event.badges?.length) parts.push(event.badges.join(", "));
  if (event.note) parts.push(event.note);
  if (status === "live") parts.push("進行中");
  if (pinnedIds.has(event.id)) parts.push("予定に追加済み");
  return `${parts.join("、")}。長押しで予定を切り替え`;
}

function makeEventCard(event) {
  const card = makeElement("article", `event-card floor-${["", "one", "two", "three"][event.floor]}`);
  const startOffset = getTimelineOffset(event.start);
  const endOffset = getTimelineOffset(event.end);
  card.style.top = `${startOffset}px`;
  card.style.height = `${Math.max(1, endOffset - startOffset)}px`;
  card.dataset.eventId = event.id;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-pressed", String(pinnedIds.has(event.id)));

  const meta = makeElement("div", "event-meta");
  const time = makeElement("time", "event-time", event.start);
  time.dateTime = `${event.date}T${event.start}:00+09:00`;
  meta.append(time);
  if (event.vj?.length) {
    const vj = makeElement("span", "event-vj");
    vj.append(makeElement("span", "vj-tag", "VJ"), document.createTextNode(event.vj.join(" / ")));
    meta.append(vj);
  }

  const titleRow = makeElement("div", "event-subline");
  const title = makeElement("span", "event-title", event.artist);
  titleRow.append(title);
  for (const badge of event.badges || []) titleRow.append(makeElement("span", "event-badge", badge));

  const content = makeElement("div", "event-content");
  content.append(titleRow);
  if (event.note) content.append(makeElement("p", "event-note", event.note));
  card.append(meta, content);
  card.append(makePinMark());
  addCardStatus(card, event);
  card.setAttribute("aria-label", formatEventLabel(event, getEventStatus(event, currentNow)));
  cardCleanups.push(bindLongPress(card, () => {
    togglePinned(event, card);
    if (typeof navigator.vibrate === "function") navigator.vibrate(12);
  }));
  return card;
}

function addCardStatus(card, event) {
  const status = getEventStatus(event, currentNow);
  card.classList.toggle("is-live", status === "live");
  card.classList.toggle("is-finished", status === "finished");
  card.classList.toggle("is-pinned", pinnedIds.has(event.id));
  card.setAttribute("aria-pressed", String(pinnedIds.has(event.id)));
  card.setAttribute("aria-label", formatEventLabel(event, status));
}

function togglePinned(event, card) {
  if (pinnedIds.has(event.id)) {
    pinnedIds.delete(event.id);
    liveRegion.textContent = `${event.artist}を予定から外しました。`;
  } else {
    pinnedIds.add(event.id);
    liveRegion.textContent = `${event.artist}を予定に追加しました。`;
  }
  savePinnedIds();
  addCardStatus(card, event);
  card.classList.remove("just-toggled");
  requestAnimationFrame(() => card.classList.add("just-toggled"));
  renderSummary();
}

function renderSummary() {
  const selectedEvents = dayEvents();
  const { now, next } = getPinnedSummary(selectedEvents, pinnedIds, currentNow);
  const signature = JSON.stringify([now.map(e => e.id), next.map(e => e.id)]);
  if (signature === summarySignature) return;
  summarySignature = signature;
  summary.replaceChildren();
  if (now.length === 0 && next.length === 0) {
    summary.hidden = true;
    return;
  }

  const addSummaryRow = (label, events, isNext) => {
    if (events.length === 0) return;
    const row = makeElement("div", "summary-row");
    row.append(makeElement("span", `summary-label${isNext ? " next" : ""}`, label));
    const items = makeElement("div", "summary-items");
    for (const event of events) {
      const prefix = isNext ? `${event.start} ` : "";
      items.append(makeElement("span", "summary-item", `${prefix}F${event.floor} / ${event.artist}`));
    }
    row.append(items);
    summary.append(row);
  };

  addSummaryRow("NOW", now, false);
  addSummaryRow("NEXT", next, true);
  summary.hidden = false;
}

function getTokyoClockMinute(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find(({ type }) => type === "hour").value) * 60
    + Number(parts.find(({ type }) => type === "minute").value);
}

function getNowLineY(day, date = currentNow) {
  if (day.date !== getTokyoDateKey(date)) return null;
  const offset = getNowLineOffset(date);
  return offset === null ? null : offset * pixelsPerMinute / PIXELS_PER_MINUTE;
}

function updateNowLine() {
  const day = DAY_BY_NUMBER.get(selectedDay);
  const offset = getNowLineY(day);
  let line = timelineBody.querySelector(".now-line");
  if (offset === null) {
    line?.remove();
    activeNowOffset = null;
    nowButton.hidden = true;
    return;
  }

  if (!line) {
    line = makeElement("div", "now-line");
    line.setAttribute("aria-hidden", "true");
    line.append(makeElement("span", "now-label"));
    timelineBody.append(line);
  }
  line.style.top = `${offset}px`;
  line.querySelector(".now-label").textContent = `${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(currentNow)} NOW`;
  activeNowOffset = offset;
  updateNowButton();
}

function getScrollTarget() {
  const day = DAY_BY_NUMBER.get(selectedDay);
  if (day.date !== getTokyoDateKey(currentNow)) return 0;
  const currentMinute = getTokyoClockMinute(currentNow);
  const clampedMinute = Math.max(TIMELINE_START_MINUTE, Math.min(TIMELINE_END_MINUTE, currentMinute));
  const offset = (clampedMinute - TIMELINE_START_MINUTE) * pixelsPerMinute;
  const target = floorHeader.offsetHeight + offset - scroller.clientHeight * 0.58;
  return Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
}

function scrollToNow(smooth = true) {
  followingNow = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({ top: getScrollTarget(), behavior: smooth && !reduced ? "smooth" : "auto" });
  window.setTimeout(updateNowButton, smooth ? 350 : 0);
}

function updateNowButton() {
  if (activeNowOffset === null) {
    nowButton.hidden = true;
    return;
  }
  const lineY = floorHeader.offsetHeight + activeNowOffset;
  const visibleTop = scroller.scrollTop + floorHeader.offsetHeight + 22;
  const visibleBottom = scroller.scrollTop + scroller.clientHeight - 42;
  nowButton.hidden = lineY >= visibleTop && lineY <= visibleBottom;
}

function refreshClockState() {
  currentNow = new Date();
  for (const card of timelineBody.querySelectorAll(".event-card")) {
    const event = eventById.get(card.dataset.eventId);
    if (event) addCardStatus(card, event);
  }
  renderSummary();
  updateNowLine();
  if (followingNow && activeNowOffset !== null) scrollToNow(false);
}

function renderDay(dayNumber, { jumpToCurrent = false } = {}) {
  selectedDay = dayNumber;
  followingNow = true;
  const day = DAY_BY_NUMBER.get(dayNumber);
  for (const button of dayButtons) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.day) === dayNumber));
  }

  cardCleanups.forEach(cleanup => cleanup());
  cardCleanups = [];
  timelineBody.replaceChildren();
  timelineBody.style.setProperty("--timeline-height", `${(TIMELINE_END_MINUTE - TIMELINE_START_MINUTE) * PIXELS_PER_MINUTE}px`);
  const timeAxis = makeElement("div", "time-axis");
  timeAxis.setAttribute("aria-hidden", "true");
  addTimeLabels(timeAxis);
  timelineBody.append(timeAxis);

  for (const floor of day.floors) {
    const column = makeElement("section", "floor-column");
    column.setAttribute("aria-label", `FLOOR ${floor.floor}`);
    for (const rawEvent of floor.events) {
      const event = { ...rawEvent, day: day.day, date: day.date, floor: floor.floor };
      column.append(makeEventCard(event));
    }
    timelineBody.append(column);
  }

  currentNow = new Date();
  layoutTimeline();
  renderSummary();
  updateNowLine();
  requestAnimationFrame(() => {
    if (jumpToCurrent && day.date === getTokyoDateKey(currentNow)) scrollToNow(false);
    else if (jumpToCurrent) scroller.scrollTop = 0;
    updateNowButton();
  });
}

function layoutTimeline() {
  const cards = [...timelineBody.querySelectorAll(".event-card")];
  const sizes = cards.map(card => {
    card.style.height = "auto";
    const event = eventById.get(card.dataset.eventId);
    return { height: card.getBoundingClientRect().height, duration: parseClock(event.end) - parseClock(event.start) };
  });
  pixelsPerMinute = requiredScale(sizes);
  timelineBody.style.setProperty("--timeline-height", `${(TIMELINE_END_MINUTE - TIMELINE_START_MINUTE) * pixelsPerMinute}px`);
  timelineBody.style.setProperty("--half-hour", `${30 * pixelsPerMinute}px`);
  cards.forEach((card, index) => {
    const event = eventById.get(card.dataset.eventId);
    card.style.top = `${(parseClock(event.start) - TIMELINE_START_MINUTE) * pixelsPerMinute}px`;
    card.style.height = `${sizes[index].duration * pixelsPerMinute - 3}px`;
  });
  timelineBody.querySelectorAll(".time-label").forEach(label => {
    label.style.top = `${(Number(label.dataset.minute) - TIMELINE_START_MINUTE) * pixelsPerMinute}px`;
  });
}

dayButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const dayNumber = Number(button.dataset.day);
    renderDay(dayNumber, { jumpToCurrent: true });
  });
});

scroller.addEventListener("scroll", updateNowButton, { passive: true });
nowButton.addEventListener("click", () => scrollToNow(true));
// User intent stops following before native scroll starts, including keyboard scrolling.
const stopFollowing = () => { followingNow = false; };
scroller.addEventListener("wheel", stopFollowing, { passive: true });
scroller.addEventListener("touchmove", stopFollowing, { passive: true });
scroller.addEventListener("pointerdown", stopFollowing, { passive: true });
scroller.addEventListener("keydown", event => {
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) stopFollowing();
});
new ResizeObserver(() => {
  const minuteAtTop = scroller.scrollTop / pixelsPerMinute;
  layoutTimeline();
  scroller.scrollTop = minuteAtTop * pixelsPerMinute;
  updateNowLine();
}).observe(timelineBody);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshClockState();
});
window.addEventListener("storage", (event) => {
  if (event.key !== PIN_STORAGE_KEY) return;
  pinnedIds = loadPinnedIds();
  refreshClockState();
});

renderDay(selectedDay, { jumpToCurrent: true });
window.setInterval(refreshClockState, 15_000);

showIntroOnce();
