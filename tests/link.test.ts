import { expect, test, vi } from "vitest";
import {
	computed,
	effect,
	FlatRoot,
	FlatSignal,
	link,
	runWithRoot,
	signal,
} from "../src/index.js";

test("initializes with the reader's peek value", () => {
	const s = signal(42);
	const m = link(s);
	expect(m.peek).toBe(42);
});

test("returns a signal", () => {
	const s = signal("hello");
	const m = link(s);
	expect(m).toBeInstanceOf(FlatSignal);
});

test("updates when source signal changes", () => {
	const s = signal(1);
	const m = link(s);
	expect(m.get()).toBe(1);
	s.set(2);
	expect(m.get()).toBe(2);
	s.set(3);
	expect(m.get()).toBe(3);
});

test("updates when source computed changes", () => {
	const a = signal(10);
	const c = computed(() => a.get() * 2);
	const m = link(c);
	expect(m.get()).toBe(20);
	a.set(5);
	expect(m.get()).toBe(10);
});

test("link can be read multiple times", () => {
	const s = signal(5);
	const m = link(s);
	expect(m.get()).toBe(5);
	expect(m.get()).toBe(5);
	expect(m.get()).toBe(5);
});

test("link can be memoized", () => {
	const s = signal(5);
	const c = computed(() => {
		s.get();
		return 1;
	});
	const m = link(c);
	const spy = vi.fn(() => {
		m.get();
	});
	effect(spy);
	expect(m.get()).toBe(1);
	expect(s.get()).toBe(5);
	expect(spy).toHaveBeenCalledTimes(1);
	s.set(2);
	expect(m.get()).toBe(1);
	expect(s.get()).toBe(2);
	expect(spy).toHaveBeenCalledTimes(1);
});

test("link value changes track source through multiple updates", () => {
	const s = signal(0);
	const m = link(s);
	const spy = vi.fn(() => m.get());
	spy();
	expect(spy).toHaveReturnedWith(0);
	s.set(1);
	expect(m.get()).toBe(1);
	s.set(2);
	expect(m.get()).toBe(2);
});

test("link works across roots", () => {
	const innerSpy = vi.fn();

	runWithRoot(() => {
		const external = signal(10);
		runWithRoot(() => {
			const m = link(external);
			effect(() => {
				m.get();
				innerSpy();
			});
			expect(m.get()).toBe(10);
			expect(innerSpy).toHaveBeenCalledTimes(1);

			m.set(10);
			expect(m.get()).toBe(10);
			expect(innerSpy).toHaveBeenCalledTimes(1);

			m.set(20);
			expect(m.get()).toBe(20);
			expect(innerSpy).toHaveBeenCalledTimes(2);

			m.set(30);
			expect(m.get()).toBe(30);
			expect(innerSpy).toHaveBeenCalledTimes(3);
		}, new FlatRoot());
	}, new FlatRoot());
});
