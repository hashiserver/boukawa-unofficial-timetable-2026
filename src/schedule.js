export const DAY_DATES = Object.freeze({
  1: "2026-09-26",
  2: "2026-09-27",
});

export const TIMELINE_START_MINUTE = 12 * 60;
export const TIMELINE_END_MINUTE = 21 * 60;
export const PIXELS_PER_MINUTE = 4;

const EVENT_TIME_ZONE = "Asia/Tokyo";

export function parseClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`Invalid clock time: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new RangeError(`Invalid clock time: ${value}`);
  return hours * 60 + minutes;
}

export function getTokyoDateKey(date = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter(({ type }) => ["year", "month", "day"].includes(type))
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDefaultDay(date = new Date()) {
  const today = getTokyoDateKey(date);
  if (today === DAY_DATES[2]) return 2;
  return 1;
}

export function getEventStatus(event, now = new Date()) {
  const date = DAY_DATES[event.day];
  const start = Date.parse(`${date}T${event.start}:00+09:00`);
  const end = Date.parse(`${date}T${event.end}:00+09:00`);
  const timestamp = now.getTime();
  if (timestamp < start) return "upcoming";
  if (timestamp < end) return "live";
  return "finished";
}

function compareEvents(left, right) {
  return left.floor - right.floor || parseClock(left.start) - parseClock(right.start) || left.artist.localeCompare(right.artist);
}

export function getPinnedSummary(events, pinnedIds, now = new Date()) {
  const pinned = pinnedIds instanceof Set ? pinnedIds : new Set(pinnedIds);
  const saved = events.filter(({ id }) => pinned.has(id));
  const current = saved.filter((event) => getEventStatus(event, now) === "live").sort(compareEvents);
  const upcoming = saved
    .filter((event) => getEventStatus(event, now) === "upcoming")
    .sort((left, right) => parseClock(left.start) - parseClock(right.start) || compareEvents(left, right));

  if (upcoming.length === 0) return { now: current, next: [] };
  const nearestStart = parseClock(upcoming[0].start);
  return {
    now: current,
    next: upcoming.filter((event) => parseClock(event.start) === nearestStart),
  };
}

export function getTimelineOffset(clock) {
  return (parseClock(clock) - TIMELINE_START_MINUTE) * PIXELS_PER_MINUTE;
}

export function getNowLineOffset(now = new Date()) {
  if (getTokyoDateKey(now) !== DAY_DATES[getDefaultDay(now)]) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const clock = `${parts.find(({ type }) => type === "hour").value}:${parts.find(({ type }) => type === "minute").value}`;
  const minute = parseClock(clock);
  if (minute < TIMELINE_START_MINUTE || minute > TIMELINE_END_MINUTE) return null;
  return (minute - TIMELINE_START_MINUTE) * PIXELS_PER_MINUTE;
}
