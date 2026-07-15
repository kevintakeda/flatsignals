import { expect, test, vi } from "vitest";
import { computed, FlatRoot, runWithRoot, signal } from "../src/index.js";

test("store and return a value", () => {
	runWithRoot(() => {
		const a = signal(1);
		expect(a.get()).toBe(1);
	}, new FlatRoot());
});

test("updates its value", () => {
	runWithRoot(() => {
		const a = signal(1);
		a.set(2);
		expect(a.get()).toBe(2);
	}, new FlatRoot());
});

test("always updates", () => {
	runWithRoot(() => {
		const a = signal(1);
		a.set(1);
		expect(a.get()).toBe(1);
		a.set(2);
		expect(a.get()).toBe(2);
	}, new FlatRoot());
});

test("set with equal value triggers no reaction (defaultEquality)", () => {
	runWithRoot(() => {
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
