import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data/schedule.json", import.meta.url), "utf8"));
const expectedCounts = {
  1: { 1: 13, 2: 13, 3: 11 },
  2: { 1: 12, 2: 13, 3: 12 },
};

test("both event days contain all three floors and every transcribed performance", () => {
  assert.deepEqual(data.days.map(({ day }) => day), [1, 2]);
  assert.deepEqual(data.days.map(({ date }) => date), ["2026-09-26", "2026-09-27"]);

  for (const day of data.days) {
    assert.deepEqual(day.floors.map(({ floor }) => floor), [1, 2, 3]);
    for (const floor of day.floors) {
      assert.equal(floor.events.length, expectedCounts[day.day][floor.floor]);
      assert.ok(floor.events.every(({ artist, start, end }) => artist && start && end));
    }
  }
});

test("each show ends at the next start on its floor and each floor ends at 20:30", () => {
  for (const day of data.days) {
    for (const floor of day.floors) {
      const events = floor.events;
      assert.deepEqual(events.map(({ start }) => start), [...events.map(({ start }) => start)].sort());
      for (let index = 0; index < events.length - 1; index += 1) {
        assert.equal(events[index].end, events[index + 1].start);
      }
      assert.equal(events.at(-1).end, "20:30");
    }
  }
});

test("every performance has a stable unique pin identifier and source notes remain attached", () => {
  const events = data.days.flatMap((day) => day.floors.flatMap((floor) => floor.events));
  const ids = events.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(events.some(({ artist, note }) => artist === "Neko Hacker" && note === "feat. をとは"));
  assert.ok(events.some(({ artist, badges = [] }) => artist === "KOTONOHOUSE" && badges.includes("LIVE SET")));
  assert.ok(events.some(({ artist, badges }) => artist === "玲音 × nyankobrq" && badges.includes("B2B")));
});
