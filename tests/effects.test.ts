import { expect, test, vi } from "vitest";
import {
	batch,
	computed,
	effect,
	FlatRoot,
	runWithRoot,
	signal,
} from "../src/index.js";

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
	}, new FlatRoot());
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
	}, new FlatRoot());
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
	}, new FlatRoot());
});

test("nested effects own other roots and computeds", () => {
	const outerRoot = new FlatRoot();
	const innerRoot = new FlatRoot();
	const spy = vi.fn();
	let poke!: () => void;

	runWithRoot(() => {
		const a = signal(0);
		const dispose = effect(() => {
			a.get();
			// created in another root, still owned by this effect
			runWithRoot(() => {
				const b = signal(0);
				effect(() => {
					b.get();
					spy();
				});
				poke = () => b.set(b.get() + 1);
			}, innerRoot);
			// created in the same root, owned by this effect
			const c = computed(() => a.get() + 1);
			c.get();
		});

		expect(spy).toHaveBeenCalledTimes(1);
		poke();
		expect(spy).toHaveBeenCalledTimes(2);

		// parent re-run tears the old inner-root effect down, then recreates it
		a.set(1);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(innerRoot._c.length).toBe(1);
		poke();
		expect(spy).toHaveBeenCalledTimes(4);

		dispose();
		expect(innerRoot._c.length).toBe(0);
		expect(outerRoot._c.length).toBe(0);
		poke();
		expect(spy).toHaveBeenCalledTimes(4);
	}, outerRoot);
});

test("roots created inside an effect are owned by it", () => {
	const outerRoot = new FlatRoot();
	const roots: FlatRoot[] = [];
	const spy = vi.fn();

	runWithRoot(() => {
		const a = signal(0);
		const dispose = effect(() => {
			a.get();
			const root = new FlatRoot();
			roots.push(root);
			runWithRoot(() => {
				effect(() => {
					spy();
				});
			}, root);
		});

		expect(roots).toHaveLength(1);
		expect(roots[0]._c.length).toBe(1);
		expect(spy).toHaveBeenCalledTimes(1);

		// re-run disposes the root the previous run created
		a.set(1);
		expect(roots).toHaveLength(2);
		expect(roots[0]._c.length).toBe(0);
		expect(roots[1]._c.length).toBe(1);
		expect(spy).toHaveBeenCalledTimes(2);

		dispose();
		expect(roots[1]._c.length).toBe(0);
		expect(spy).toHaveBeenCalledTimes(2);
	}, outerRoot);
});

test("inner effects track the parent's root, not other roots", () => {
	const outerRoot = new FlatRoot();
	const otherRoot = new FlatRoot();
	const spy = vi.fn();
	let poke!: () => void;

	runWithRoot(() => {
		const a = signal(0);
		effect(() => {
			a.get();
			effect(() => {
				spy();
			});
		});
	}, outerRoot);

	runWithRoot(() => {
		const b = signal(0);
		effect(() => {
			b.get();
			spy();
		});
		poke = () => b.set(b.get() + 1);
	}, otherRoot);

	expect(spy).toHaveBeenCalledTimes(2);
	// only the other-root effect reacts: the inner one reads nothing from it
	poke();
	expect(spy).toHaveBeenCalledTimes(3);
});

test("inner effects join a root switched inside the outer body", () => {
	const outerRoot = new FlatRoot();
	const otherRoot = new FlatRoot();
	const spy = vi.fn();

	runWithRoot(() => {
		const a = signal(0);
		effect(() => {
			a.get();
			// the rest of this body runs against otherRoot, so the inner
			// effect lands there instead of the outer effect's root
			runWithRoot(() => {
				effect(() => {
					spy();
				});
			}, otherRoot);
		});
	}, outerRoot);

	expect(spy).toHaveBeenCalledTimes(1);
	expect(otherRoot._c.length).toBe(1);
	otherRoot.dispose();
	expect(otherRoot._c.length).toBe(0);
	expect(spy).toHaveBeenCalledTimes(1);
});

test("nested effects run once", () => {
	runWithRoot(() => {
		const a = signal(2);
		const spyX = vi.fn(() => a.get());
		const spyY = vi.fn(() => a.get());
		const spyZ = vi.fn(() => a.get());

		effect(() => {
			spyX();
			effect(() => {
				spyY();
				effect(() => {
					spyZ();
				});
			});
		});

		expect(spyX).toHaveBeenCalledTimes(1);
		expect(spyY).toHaveBeenCalledTimes(1);
		expect(spyZ).toHaveBeenCalledTimes(1);

		a.set(4);

		expect(spyX).toHaveBeenCalledTimes(2);
		expect(spyY).toHaveBeenCalledTimes(2);
		expect(spyZ).toHaveBeenCalledTimes(2);
	}, new FlatRoot());
});

test("nested effects do not leak subscriptions to parent", () => {
	const root = new FlatRoot();
	runWithRoot(() => {
		const a = signal(0);
		const b = signal(0);
		const parent = vi.fn(() => {
			a.get();
			effect(() => void b.get());
		});

		effect(parent);
		expect(parent).toHaveBeenCalledTimes(1);

		b.set(1);
		expect(parent).toHaveBeenCalledTimes(1);

		a.set(1);
		expect(parent).toHaveBeenCalledTimes(2);
	}, root);
});

test("nested effects are disposed with parent", () => {
	const root = new FlatRoot();
	const cleanup = vi.fn();

	runWithRoot(() => {
		const a = signal(0);
		const b = signal(0);
		const spy = vi.fn(() => void b.get());
		const dispose = effect(() => {
			a.get();
			effect(() => spy());
			return cleanup;
		});

		a.set(1);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(root._c.length).toBe(2);

		// parent re-run: old child disposed, new child created
		a.set(2);
		expect(cleanup).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenCalledTimes(3);
		expect(root._c.length).toBe(2);

		// disposing parent disposes children
		dispose();
		expect(cleanup).toHaveBeenCalledTimes(3);
		expect(root._c.length).toBe(0);

		b.set(1);
		a.set(3);
		expect(spy).toHaveBeenCalledTimes(3);
	}, root);
});

test("nested effects run once per update inside a batch", () => {
	runWithRoot(() => {
		const a = signal(0);
		const parent = vi.fn(() => {
			a.get();
			effect(() => void a.get());
		});

		effect(parent);
		expect(parent).toHaveBeenCalledTimes(1);

		batch(() => {
			a.set(1);
			a.set(2);
			a.set(3);
		});
		expect(parent).toHaveBeenCalledTimes(2);
	}, new FlatRoot());
});

test("nested effects run once when parent writes a signal", () => {
	runWithRoot(() => {
		const a = signal(0);
		const mirror = signal(0);
		const parent = vi.fn(() => {
			mirror.set(a.get());
			effect(() => void mirror.get());
		});
		const child = vi.fn(() => void mirror.get());

		effect(() => {
			parent();
			child();
		});

		expect(parent).toHaveBeenCalledTimes(1);
		expect(child).toHaveBeenCalledTimes(1);

		a.set(1);
		expect(parent).toHaveBeenCalledTimes(2);
		expect(child).toHaveBeenCalledTimes(2);
	}, new FlatRoot());
});

test("effect cleanup is a type-level contract", () => {
	// the signature accepts void or a cleanup fn, nothing else; there is no
	// runtime guard, so this must stay a compile error
	// @ts-expect-error an effect may not return a value
	// biome-ignore lint/suspicious/noConfusingVoidType: void is necessary here
	const invalid: () => void | (() => void) = () => 1;

	expect(invalid).toBeTypeOf("function");

	runWithRoot(() => {
		const a = signal(1);
		const cleanup = vi.fn();
		const stop = effect(() => {
			a.get();
			return cleanup;
		});
		expect(cleanup).toHaveBeenCalledTimes(0);
		a.set(2);
		expect(cleanup).toHaveBeenCalledTimes(1);
		stop();
		expect(cleanup).toHaveBeenCalledTimes(2);
	}, new FlatRoot());
});

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
	}, new FlatRoot());
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
	}, new FlatRoot());
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
	}, new FlatRoot());
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
	}, new FlatRoot());
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
	}, new FlatRoot());
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
	}, new FlatRoot());
});
