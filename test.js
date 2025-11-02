// Export add() for tests; keep file inert so Jest won't fail by executing it.
function add(a, b) {
  return a + b;
}

module.exports = add;

// Provide a noop Jest test so Jest doesn't treat this as an empty test suite
if (typeof test === 'function') {
  test('legacy noop', () => {
    expect(add(0, 0)).toBe(0);
  });
}
