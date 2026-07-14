import { expect, test, vi } from "vitest";
import { computed, effect, runWithRoot, signal, untrack } from "../src/index.js";

test("peek inside memos", () => {
	runWithRoot(() => {
		const memoSpy = vi.fn();
		const x = signal("a");
		const a = computed(() => x.get() + "!");
		const b = computed(() => {
			memoSpy();
			return a.peek;
		});

		b.get();
		expect(memoSpy).toHaveBeenCalledTimes(1);
		expect(b.get()).toBeUndefined();

		x.set("x");
		expect(memoSpy).toHaveBeenCalledTimes(1);
	});
});

test("untrack inside effects", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = signal("b");
		const c = computed(() => a.get() + b.get());
		const spy = vi.fn(() => {
			[a.peek, b.peek, c.peek];
		});
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);

		a.set("x");

		expect(spy).toHaveBeenCalledTimes(1);

		b.set("y");

		expect(spy).toHaveBeenCalledTimes(1);
	});
});

test("untrack inside computed", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = signal("b");
		const spy = vi.fn();
		const c = computed(() => {
			spy();
			return untrack(() => a.get() + b.get());
		});

		c.get();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(c.get()).toBe("ab");

		a.set("x");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(c.peek).toBe("ab");
	});
});

test("untrack inside effect", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = signal("b");
		const spy = vi.fn();
		effect(() => {
			spy();
			untrack(() => a.get());
			b.get();
		});

		expect(spy).toHaveBeenCalledTimes(1);

		a.set("x");
		expect(spy).toHaveBeenCalledTimes(1);

		b.set("y");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

test("untrack returns value", () => {
	const result = untrack(() => 42);
	expect(result).toBe(42);
});
