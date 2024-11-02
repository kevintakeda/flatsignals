import { expect, test } from "vitest";
import { root, signal } from "../src/index.js";

test("store and return a value", () => {
  root(() => {
    const a = signal(1);
    expect(a.val).toBe(1);
  })
});

test("updates its value", () => {
  root(() => {
    const a = signal(1);
    a.val = 2;
    expect(a.val).toBe(2);
  })
});

test("always updates", () => {
  root(() => {
    const a = signal(1);
    a.val = 1;
    expect(a.val).toBe(1);
    a.val = 2;
    expect(a.val).toBe(2);
  })
});
