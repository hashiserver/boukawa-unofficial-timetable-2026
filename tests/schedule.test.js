import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultDay,
  getEventStatus,
  getPinnedSummary,
  getNowLineOffset,
  getTimelineOffset,
  getTokyoDateKey,
} from "../src/schedule.js";

test("Tokyo date and default day use JST even when the UTC date differs", () => {
  const justAfterTokyoMidnight = new Date("2026-09-25T15:30:00.000Z");
  assert.equal(getTokyoDateKey(justAfterTokyoMidnight), "2026-09-26");
  assert.equal(getDefaultDay(justAfterTokyoMidnight), 1);
  assert.equal(getDefaultDay(new Date("2026-09-27T04:00:00.000Z")), 2);
  assert.equal(getDefaultDay(new Date("2026-09-28T04:00:00.000Z")), 1);
});

test("an event changes from upcoming to live to finished at its JST boundaries", () => {
  const event = { day: 1, floor: 1, start: "12:30", end: "13:15" };
  assert.equal(getEventStatus(event, new Date("2026-09-26T03:29:00.000Z")), "upcoming");
  assert.equal(getEventStatus(event, new Date("2026-09-26T03:30:00.000Z")), "live");
  assert.equal(getEventStatus(event, new Date("2026-09-26T04:15:00.000Z")), "finished");
});

test("pinned summary keeps every live show and every tie for the nearest next start", () => {
  const events = [
    { id: "live-f1", day: 1, floor: 1, start: "12:30", end: "13:30", artist: "Live F1" },
    { id: "live-f2", day: 1, floor: 2, start: "12:45", end: "13:15", artist: "Live F2" },
    { id: "next-f1", day: 1, floor: 1, start: "13:30", end: "14:00", artist: "Next F1" },
    { id: "next-f2", day: 1, floor: 2, start: "13:30", end: "14:00", artist: "Next F2" },
    { id: "later", day: 1, floor: 3, start: "14:00", end: "14:30", artist: "Later" },
  ];
  const pinned = new Set(events.map((event) => event.id));
  const summary = getPinnedSummary(events, pinned, new Date("2026-09-26T04:00:00.000Z"));

  assert.deepEqual(summary.now.map((event) => event.id), ["live-f1", "live-f2"]);
  assert.deepEqual(summary.next.map((event) => event.id), ["next-f1", "next-f2"]);
});

test("pinned summary shows only the nearest next shows when nothing is live", () => {
  const events = [
    { id: "next-a", day: 1, floor: 1, start: "12:30", end: "13:15", artist: "Next A" },
    { id: "next-b", day: 1, floor: 2, start: "12:30", end: "13:00", artist: "Next B" },
    { id: "later", day: 1, floor: 3, start: "13:00", end: "13:30", artist: "Later" },
  ];
  const summary = getPinnedSummary(events, new Set(["next-a", "next-b", "later"]), new Date("2026-09-26T02:00:00.000Z"));

  assert.deepEqual(summary.now, []);
  assert.deepEqual(summary.next.map((event) => event.id), ["next-a", "next-b"]);
});

test("timeline offsets are measured from noon at four pixels per minute", () => {
  assert.equal(getTimelineOffset("12:00"), 0);
  assert.equal(getTimelineOffset("13:15"), 300);
  assert.equal(getTimelineOffset("20:30"), 2040);
});

test("the live line is placed only on an event day and within its time axis", () => {
  assert.equal(getNowLineOffset(new Date("2026-09-26T03:30:00.000Z")), 120);
  assert.equal(getNowLineOffset(new Date("2026-09-26T00:00:00.000Z")), null);
  assert.equal(getNowLineOffset(new Date("2026-09-26T12:01:00.000Z")), null);
  assert.equal(getNowLineOffset(new Date("2026-09-25T03:30:00.000Z")), null);
});
