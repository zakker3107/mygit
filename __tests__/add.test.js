const add = require('../src/add');

test('adds positive numbers', () => {
  expect(add(1, 2)).toBe(3);
});

test('adds zeros', () => {
  expect(add(0, 0)).toBe(0);
});

test('adds negative and positive', () => {
  expect(add(-1, 1)).toBe(0);
});
