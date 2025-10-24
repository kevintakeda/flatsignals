import { expect, test, vi } from "vitest";
import { computed, effect, scoped, signal } from "../src/index.js";

test("peek inside memos", () => {
	scoped(() => {
		const memoSpy = vi.fn();
		const x = signal("a");
		const a = computed(() => x.val + "!");
		const b = computed(() => {
			memoSpy();
			return a.peek;
		});

		b.val;
		expect(memoSpy).toHaveBeenCalledTimes(1);
		expect(b.val).toBeUndefined();

		x.val = "x";
		expect(memoSpy).toHaveBeenCalledTimes(1);
	});
});

test("untrack inside effects", () => {
	scoped(() => {
		const a = signal("a");
		const b = signal("b");
		const c = computed(() => a.val + b.val);
		const spy = vi.fn(() => [a.peek, b.peek, c.peek]);
		effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);

		a.val = "x";

		expect(spy).toHaveBeenCalledTimes(1);

		b.val = "y";

		expect(spy).toHaveBeenCalledTimes(1);
	});
});
