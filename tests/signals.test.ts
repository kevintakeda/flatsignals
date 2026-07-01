import { expect, test, vi } from "vitest";
import { computed, scoped, signal } from "../src/index.js";

test("store and return a value", () => {
	scoped(() => {
		const a = signal(1);
		expect(a.get()).toBe(1);
	});
});

test("updates its value", () => {
	scoped(() => {
		const a = signal(1);
		a.set(2);
		expect(a.get()).toBe(2);
	});
});

test("always updates", () => {
	scoped(() => {
		const a = signal(1);
		a.set(1);
		expect(a.get()).toBe(1);
		a.set(2);
		expect(a.get()).toBe(2);
	});
});

test("set with equal value triggers no reaction (defaultEquality)", () => {
	scoped(() => {
		const fn = vi.fn();
		const a = signal(0);
		const b = computed(() => {
			fn();
			return a.get();
		});
		b.get();
		expect(fn).toHaveBeenCalledTimes(1);
		fn.mockClear();
		a.set(0); // same value — defaultEquality returns true, no update
		expect(a.get()).toBe(0);
		expect(fn).toHaveBeenCalledTimes(0);
	});
});
