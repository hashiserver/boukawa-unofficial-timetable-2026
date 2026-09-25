import test from "node:test";
import assert from "node:assert/strict";
import { bindLongPress } from "../src/longpress.js";

class FakeTarget extends EventTarget {
  send(type, values = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(values)) {
      Object.defineProperty(event, key, { value });
    }
    this.dispatchEvent(event);
    return event;
  }
}

function fakeTimers() {
  let nextId = 1;
  const tasks = new Map();
  return {
    setTimeoutFn(callback, delay) {
      const id = nextId++;
      tasks.set(id, { callback, delay });
      return id;
    },
    clearTimeoutFn(id) {
      tasks.delete(id);
    },
    run() {
      const current = [...tasks.values()];
      tasks.clear();
      for (const task of current) task.callback();
    },
    delays() {
      return [...tasks.values()].map(({ delay }) => delay);
    },
  };
}

test("a short tap does not toggle a pin", () => {
  const target = new FakeTarget();
  const timers = fakeTimers();
  let toggles = 0;
  bindLongPress(target, () => toggles++, timers);

  target.send("pointerdown", { pointerType: "touch", button: 0, clientX: 20, clientY: 40 });
  target.send("pointerup");
  timers.run();

  assert.equal(toggles, 0);
});

test("a stationary hold toggles once after the long-press delay", () => {
  const target = new FakeTarget();
  const timers = fakeTimers();
  let toggles = 0;
  bindLongPress(target, () => toggles++, timers);

  target.send("pointerdown", { pointerType: "touch", button: 0, clientX: 20, clientY: 40 });
  assert.deepEqual(timers.delays(), [540]);
  timers.run();
  target.send("pointerup");

  assert.equal(toggles, 1);
});

test("dragging cancels the hold and keyboard activation remains available", () => {
  const target = new FakeTarget();
  const timers = fakeTimers();
  let toggles = 0;
  bindLongPress(target, () => toggles++, timers);

  target.send("pointerdown", { pointerType: "touch", button: 0, clientX: 20, clientY: 40 });
  target.send("pointermove", { clientX: 32, clientY: 40 });
  timers.run();
  assert.equal(toggles, 0);

  const keyEvent = target.send("keydown", { key: "Enter", repeat: false });
  assert.equal(keyEvent.defaultPrevented, true);
  assert.equal(toggles, 1);
});
