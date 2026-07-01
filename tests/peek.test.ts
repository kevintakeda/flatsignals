import { expect, test, vi } from "vitest";
import { computed, effect, scoped, signal } from "../src/index.js";

test("peek inside memos", () => {
	scoped(() => {
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
	scoped(() => {
		const a = signal("a");
		const b = signal("b");
		const c = computed(() => a.get() + b.get());
		const spy = vi.fn(() => [a.peek, b.peek, c.peek]);
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);

		a.set("x");

		expect(spy).toHaveBeenCalledTimes(1);

		b.set("y");

		expect(spy).toHaveBeenCalledTimes(1);
	});
});
