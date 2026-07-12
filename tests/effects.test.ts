import { expect, test, vi } from "vitest";
import { batch, computed, effect, runWithRoot, signal } from "../src/index.js";

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
			// inner batch flushed, outer still batched
			expect(fn).toHaveBeenCalledTimes(0);
			a.set(4);
		});
		// outer batch flushed
		expect(fn).toHaveBeenCalledTimes(1);
		// after outer flush: a = 4
		expect(a.get()).toBe(4);
	});
});

test("effects", () => {
	runWithRoot(() => {
		const a = signal(1);
		const b = signal(2);
		const cSpy = vi.fn(() => void (a.get() + b.get()));
		effect(cSpy);

		expect(cSpy).toHaveBeenCalledTimes(1);

		a.set(10);
		expect(cSpy).toHaveBeenCalledTimes(2);
		expect(cSpy).toHaveBeenCalledTimes(2);

		batch(() => {
			b.set(20);
			b.set(30);
		});

		expect(cSpy).toHaveBeenCalledTimes(3);
		expect(cSpy).toHaveBeenCalledTimes(3);
	});
});

test("unsubscribe invisible dependencies", () => {
	runWithRoot(() => {
		const a = signal(true);
		const b = signal("b");
		const c = signal("c");
		const fSpy = vi.fn(() => void (a.get() ? b.get() : c.get()));
		effect(fSpy);

		expect(fSpy).toHaveBeenCalledTimes(1);
		a.set(false);

		expect(fSpy).toHaveBeenCalledTimes(2);
		a.set(true);
		c.set("c!");
		c.set("c!!");

		expect(fSpy).toHaveBeenCalledTimes(3);
		a.set(false);
		b.set("b!");
		b.set("b!!");

		expect(fSpy).toHaveBeenCalledTimes(4);
		a.set(false);

		expect(fSpy).toHaveBeenCalledTimes(4);
		b.set("b!!!");

		expect(fSpy).toHaveBeenCalledTimes(4);
	});
});

// TODO: unsopported for now
// test("nested effects run once", () => {
// 	runWithRoot(() => {
// 		const a = signal(2);
// 		const spyX = vi.fn(() => a.get());
// 		const spyY = vi.fn(() => a.get());
// 		const spyZ = vi.fn(() => a.get());

// 		effect(() => {
// 			spyX();
// 			effect(() => {
// 				spyY();
// 				effect(() => {
// 					spyZ();
// 				});
// 			});
// 		});

// 		expect(spyX).toHaveBeenCalledTimes(1);
// 		expect(spyY).toHaveBeenCalledTimes(1);
// 		expect(spyZ).toHaveBeenCalledTimes(1);

// 		a.set(4);

// 		expect(spyX).toHaveBeenCalledTimes(2);
// 		expect(spyY).toHaveBeenCalledTimes(2);
// 		expect(spyZ).toHaveBeenCalledTimes(2);

// 		expect(a.get()).toBe(8);
// 	});
// });

test("double dispose is no-op", () => {
	const a = signal("a");
	const dispose = effect(() => void a.get());
	dispose();
	expect(() => dispose()).not.toThrow();
});

test("dispose effects", () => {
	runWithRoot(() => {
		const a = signal("a");
		const bSpy = vi.fn(() => void a.get());
		const dispose = effect(bSpy);
		expect(bSpy).toHaveBeenCalledTimes(1);

		// set a
		a.set("a!");
		expect(bSpy).toHaveBeenCalledTimes(2);
		a.set("a!!");
		expect(bSpy).toHaveBeenCalledTimes(3);
		dispose();
		bSpy.mockReset();

		a.set("a!!!");
		expect(bSpy).toHaveBeenCalledTimes(0);
		a.set("a!!!!");
		expect(bSpy).toHaveBeenCalledTimes(0);
		expect(bSpy).toHaveBeenCalledTimes(0);
	});
});

test("effect with conditional dependencies", () => {
	runWithRoot(() => {
		const s1 = signal(true);
		const s2 = signal("a");
		const s3 = signal("b");
		const s4 = computed(() => s2.get());
		const s5 = computed(() => s3.get());
		const result = { val: 0 };
		effect(() => {
			if (s1.get()) {
				s4.get();
				result.val = 1;
			} else {
				s5.get();
				result.val = 0;
			}
		});
		s1.set(false);

		expect(result.val).toBe(0);
		s1.set(true);

		expect(result.val).toBe(1);
	});
});

test("effect with deep dependencies", () => {
	runWithRoot(() => {
		const a = signal(2);
		const spyB = vi.fn(() => a.get() + 1);
		const b = computed(spyB);
		const spyC = vi.fn(() => b.get());
		const c = computed(spyC);
		const spyD = vi.fn(() => c.get());
		const d = computed(spyD);
		const spyE = vi.fn(() => void d.get());
		effect(spyE);

		expect(spyE).toHaveBeenCalledTimes(1);
		a.set(4);

		expect(spyE).toHaveBeenCalledTimes(2);
	});
});

test("dispose calls cleanup function", () => {
	runWithRoot(() => {
		const a = signal("a");
		const cleanup = vi.fn();
		const dispose = effect(() => {
			a.get();
			return cleanup;
		});

		expect(cleanup).toHaveBeenCalledTimes(0);
		dispose();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});

test("dispose stops effect from re-running on signal changes", () => {
	runWithRoot(() => {
		const a = signal(0);
		const spy = vi.fn(() => void a.get());
		const dispose = effect(spy);

		expect(spy).toHaveBeenCalledTimes(1);
		dispose();

		a.set(1);
		a.set(2);
		a.set(3);
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

test("effects using sources from top to bottom", () => {
	const count = vi.fn();
	return runWithRoot(() => {
		const x = signal("x");
		const a = computed(() => x.get());
		const b = computed(() => a.get());
		effect(() => {
			x.get();
			count();
		});
		effect(() => {
			a.get();
			count();
		});
		effect(() => {
			b.get();
			count();
		});

		expect(count).toBeCalledTimes(3);

		count.mockClear();
		x.set("x!");

		expect(count).toBeCalledTimes(3);

		count.mockClear();
		x.set("x!!");

		expect(count).toBeCalledTimes(3);
	});
});
