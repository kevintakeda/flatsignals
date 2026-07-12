/** biome-ignore-all lint/style/noNonNullAssertion: tests will throw */
import { expect, test, vi } from "vitest";
import {
	batch,
	computed,
	effect,
	FlatRoot,
	type FlatSignal,
	runWithRoot,
	signal,
} from "../src/index.js";

test("batches signal sets and defers effects until batch completes", () => {
	runWithRoot(() => {
		const a = signal(1);
		const b = signal(2);
		const spy = vi.fn(() => void (a.get(), b.get()));
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockClear();

		batch(() => {
			a.set(10);
			b.set(20);
			expect(spy).toHaveBeenCalledTimes(0);
		});

		expect(spy).toHaveBeenCalledTimes(1);
		expect(a.get()).toBe(10);
		expect(b.get()).toBe(20);
	});
});

test("nested batch becomes part of outer flush", () => {
	runWithRoot(() => {
		const a = signal(0);
		const fn = vi.fn(() => void a.get());
		effect(fn);
		expect(fn).toHaveBeenCalledTimes(1);
		fn.mockClear();

		batch(() => {
			a.set(1);
			batch(() => {
				a.set(2);
				a.set(3);
			});
			expect(fn).toHaveBeenCalledTimes(0);
			a.set(4);
		});

		expect(fn).toHaveBeenCalledTimes(1);
		expect(a.get()).toBe(4);
	});
});

test("empty batch does not trigger effects", () => {
	runWithRoot(() => {
		const a = signal(0);
		const spy = vi.fn(() => void a.get());
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockClear();

		batch(() => {});

		expect(spy).toHaveBeenCalledTimes(0);
		expect(a.get()).toBe(0);
	});
});

test("batch with multiple signals on same root triggers effect once", () => {
	runWithRoot(() => {
		const a = signal(0);
		const b = signal(0);
		const c = signal(0);
		const spy = vi.fn(() => void (a.get(), b.get(), c.get()));
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockClear();

		batch(() => {
			a.set(1);
			b.set(2);
			c.set(3);
		});

		expect(spy).toHaveBeenCalledTimes(1);
	});
});

test("computed reads inside batch return cached values (lazy until flush)", () => {
	runWithRoot(() => {
		const a = signal(1);
		const b = computed(() => a.get() * 2);
		const spy = vi.fn(() => void b.get());
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		expect(b.get()).toBe(2);
		spy.mockClear();

		batch(() => {
			a.set(3);
			expect(b.get()).toBe(2);
		});

		expect(spy).toHaveBeenCalledTimes(1);
		expect(b.get()).toBe(6);
	});
});

test("signal sets to same value inside batch do not queue flush", () => {
	runWithRoot(() => {
		const a = signal(0);
		const spy = vi.fn(() => void a.get());
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockClear();

		batch(() => {
			a.set(0);
		});

		expect(spy).toHaveBeenCalledTimes(0);
	});
});

test("batch with signals on different roots flushes each root", () => {
	const rootA = new FlatRoot();
	const rootB = new FlatRoot();
	let a: FlatSignal<string>;
	let b: FlatSignal<string>;

	runWithRoot(() => {
		a = signal("a");
	}, rootA);
	runWithRoot(() => {
		b = signal("b");
	}, rootB);

	const spyA = vi.fn(() => void a.get());
	const spyB = vi.fn(() => void b.get());
	runWithRoot(() => effect(spyA), rootA);
	runWithRoot(() => effect(spyB), rootB);
	spyA.mockClear();
	spyB.mockClear();

	batch(() => {
		a.set("a!");
		b.set("b!");
	});

	expect(spyA).toHaveBeenCalledTimes(1);
	expect(spyB).toHaveBeenCalledTimes(1);
});

test("batch does not flush roots with autoFlush disabled", () => {
	const root = new FlatRoot(false);
	let a: FlatSignal<string>;

	runWithRoot(() => {
		a = signal("a");
	}, root);

	const spy = vi.fn(() => void a.get());
	runWithRoot(() => effect(spy), root);
	spy.mockClear();

	batch(() => {
		a.set("a!");
	});

	expect(spy).toHaveBeenCalledTimes(0);
	expect(a!.get()).toBe("a!");

	root.flush();
	expect(spy).toHaveBeenCalledTimes(1);
});

test("batch with computed that reads signals triggers effect once", () => {
	runWithRoot(() => {
		const a = signal(2);
		const b = signal(3);
		const sum = computed(() => a.get() + b.get());
		const spy = vi.fn(() => void sum.get());
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		expect(sum.get()).toBe(5);
		spy.mockClear();

		batch(() => {
			a.set(10);
			b.set(20);
		});

		expect(spy).toHaveBeenCalledTimes(1);
		expect(sum.get()).toBe(30);
	});
});
