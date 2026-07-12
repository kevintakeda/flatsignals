import { expect, test, vi } from "vitest";
import { computed, runWithRoot, signal } from "../src/index.js";

test("creates implicit root when called outside runWithRoot", () => {
	const c = computed(() => 42);
	expect(c.get()).toBe(42);
	c.dispose();
});

test("is cached", () => {
	runWithRoot(() => {
		const a = signal(1);
		const b = signal(2);
		const cSpy = vi.fn(() => a.get() + b.get());
		const c = computed(cSpy);
		expect(c.get()).toBe(3);
		expect(c.get()).toBe(3);
		expect(cSpy).toHaveBeenCalledTimes(1);
	});
});

test("is lazy", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = signal("b");
		const cSpy = vi.fn(() => a.get() + b.get());
		const c = computed(cSpy);
		a.set("a!");
		b.set("b!");
		expect(cSpy).toHaveBeenCalledTimes(0);
		expect(c.get()).toBe("a!b!");
		expect(cSpy).toHaveBeenCalledTimes(1);
	});
});

test("is updated", () => {
	runWithRoot(() => {
		const a = signal(false);
		const bSpy = vi.fn(() => (a.get() ? "1" : "2"));
		const b = computed(bSpy);
		expect(b.get()).toBe("2");
		a.set(true);
		expect(b.get()).toBe("1");
		a.set(false);
		expect(b.get()).toBe("2");
		a.set(true);
		expect(b.get()).toBe("1");
		expect(bSpy).toHaveBeenCalledTimes(4);
	});
});

test("is dynamic (unsubscribe invisible dependencies)", () => {
	runWithRoot(() => {
		const a = signal(false);
		const b = signal("b");
		const c = signal("c");

		const dSpy = vi.fn(() => (a.get() ? b.get() : c.get()));
		const d = computed(dSpy);
		expect(d.get()).toBe("c");

		a.set(true);
		a.set(false);
		expect(d.get()).toBe("c");
		expect(dSpy).toHaveBeenCalledTimes(2);
		b.set("b!");
		b.set("b!!");
		expect(d.get()).toBe("c");
		expect(dSpy).toHaveBeenCalledTimes(2);

		a.set(true);
		expect(d.get()).toBe("b!!");
		expect(dSpy).toHaveBeenCalledTimes(3);

		c.set("c!");
		c.set("c!!");
		expect(d.get()).toBe("b!!");
		expect(dSpy).toHaveBeenCalledTimes(3);

		a.set(false);
		expect(d.get()).toBe("c!!");
		expect(dSpy).toHaveBeenCalledTimes(4);
	});
});

test("diamond graph runs once", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => a.get());

		const spy = vi.fn(() => b.get() + c.get());
		const d = computed(spy);

		expect(d.get()).toBe("aa");
		expect(spy).toHaveBeenCalledTimes(1);

		a.set("a!");

		expect(d.get()).toBe("a!a!");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

test("repeating computeds runs once", () => {
	runWithRoot(() => {
		const a = signal(1);
		const spyB = vi.fn(() => a.get() + a.get());
		const b = computed(spyB);
		const spyC = vi.fn(() => a.get() + b.get() + a.get() + b.get());
		const c = computed(spyC);
		const spyD = vi.fn(
			() => a.get() + b.get() + c.get() + a.get() + b.get() + c.get(),
		);
		const d = computed(spyD);
		expect(d.get()).toBe(18);
		expect(spyB).toHaveBeenCalledTimes(1);
		expect(spyC).toHaveBeenCalledTimes(1);
		expect(spyD).toHaveBeenCalledTimes(1);
		a.set(4);
		d.get();
		expect(spyB).toHaveBeenCalledTimes(2);
		expect(spyC).toHaveBeenCalledTimes(2);
		expect(spyD).toHaveBeenCalledTimes(2);
	});
});

//   A
//  / \
// B   C
//  \ /
//   D
//   |
//   E
//   |
//   F
test("branching (updates and runs once)", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => a.get());
		const dSpy = vi.fn(() => b.get() + c.get());
		const d = computed(dSpy);
		const e = computed(() => d.get());
		const f = computed(() => e.get());

		expect(e.get()).toBe("aa");
		expect(f.get()).toBe("aa");
		expect(dSpy).toBeCalledTimes(1);

		a.set("b");
		expect(e.get()).toBe("bb");
		expect(f.get()).toBe("bb");
		expect(dSpy).toBeCalledTimes(2);
	});
});

test("track dependencies optimally", () => {
	runWithRoot(() => {
		// After X is read changing A1 source shouldn't affect B2 computed.
		// A1  B1
		// |   |
		// A2  B2
		//  \  /
		//   X
		const a1 = signal("a");
		const a2Spy = vi.fn(() => a1.get());
		const a2 = computed(a2Spy);

		const b1 = signal("b");
		const b2Spy = vi.fn(() => b1.get());
		const b2 = computed(b2Spy);

		const x = computed(() => a2.get() + b2.get());

		x.get(); // trick the graph (to catch more dependencies than needed)
		expect(a2Spy).toBeCalledTimes(1);
		expect(b2Spy).toBeCalledTimes(1);

		b2Spy.mockClear();
		b2.get();
		expect(b2Spy).toBeCalledTimes(0);
		a1.set("a!"); // updating A shouldn't affect B
		b2.get();
		expect(b2Spy).toBeCalledTimes(0);

		a2Spy.mockClear();
		a2.get();
		expect(a2Spy).toBeCalledTimes(1);
		b1.set("b!"); // updating B shouldn't affect A
		a2.get();
		expect(a2Spy).toBeCalledTimes(1);
	});
});
