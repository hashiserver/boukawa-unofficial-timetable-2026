import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredScale } from '../src/layout.js';
test('dense cards expand the shared time axis rather than clipping text', () => {
  assert.equal(requiredScale([{height:194,duration:25}]), 8);
  assert.equal(requiredScale([{height:80,duration:45}]), 4);
});
