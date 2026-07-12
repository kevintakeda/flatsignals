// adapted from https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx
/** biome-ignore-all lint/suspicious/noAssignInExpressions: conciseness */

import { expect, it, vi } from "vitest";
import { computed, effect, runWithRoot, signal } from "../src/index.js";

it("should run computeds once for multiple dep changes", () => {
	runWithRoot(() => {
		const a = signal("a");
		const b = signal("b");

		const compute = vi.fn(() => {
			// debugger;
			return a.get() + b.get();
		});
		const c = computed(compute);

		expect(c.get()).toBe("ab");
		expect(compute).toHaveBeenCalledOnce();
		compute.mockClear();

		a.set("aa");
		b.set("bb");
		c.get();
		expect(compute).toHaveBeenCalledOnce();
	});
});

it("should drop A->B->A updates", async () => {
	runWithRoot(() => {
		//     A
		//   / |
		//  B  | <- Looks like a flag doesn't it? :D
		//   \ |
		//     C
		//     |
		//     D
		const a = signal(2);

		const b = computed(() => a.get() - 1);
		const c = computed(() => a.get() + b.get());

		const compute = vi.fn(() => "d: " + c.get());
		const d = computed(compute);

		// Trigger read
		expect(d.get()).to.equal("d: 3");
		expect(compute).toHaveBeenCalledOnce();
		compute.mockClear();

		a.set(4);
		d.get();
		expect(compute).toHaveBeenCalledOnce();
	});
});

it("should only update every signal once (diamond graph)", () => {
	runWithRoot(() => {
		// In this scenario "D" should only update once when "A" receives
		// an update. This is sometimes referred to as the "diamond" scenario.
		//     A
		//   /   \
		//  B     C
		//   \   /
		//     D
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => a.get());

		const spy = vi.fn(() => b.get() + " " + c.get());
		const d = computed(spy);

		expect(d.get()).to.equal("a a");
		expect(spy).toHaveBeenCalledOnce();

		a.set("aa");
		expect(d.get()).to.equal("aa aa");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

it("should only update every signal once (diamond graph + tail)", () => {
	runWithRoot(() => {
		// "E" will be likely updated twice if our mark+sweep logic is buggy.
		//     A
		//   /   \
		//  B     C
		//   \   /
		//     D
		//     |
		//     E
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => a.get());

		const d = computed(() => b.get() + " " + c.get());

		const spy = vi.fn(() => d.get());
		const e = computed(spy);

		expect(e.get()).to.equal("a a");
		expect(spy).toHaveBeenCalledOnce();

		a.set("aa");
		expect(e.get()).to.equal("aa aa");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

// this library can't bail out.
// it("should bail out if result is the same", () => {
//   runWithRoot(() => {
//     // Bail out if value of "B" never changes
//     // A->B->C
//     const a = signal("a");
//     const b = computed(() => {
//       a.get();
//       return "foo";
//     });

//     const spy = vi.fn(() => b.get());
//     const c = computed(spy);

//     expect(c.get()).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();

//     a.set("aa");
//     expect(c.get()).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();
//   })
// });

it("should only update every signal once (jagged diamond graph + tails)", () => {
	runWithRoot(() => {
		// "F" and "G" will be likely updated twice if our mark+sweep logic is buggy.
		//     A
		//   /   \
		//  B     C
		//  |     |
		//  |     D
		//   \   /
		//     E
		//   /   \
		//  F     G
		const a = signal("a");

		const b = computed(() => a.get());
		const c = computed(() => a.get());

		const d = computed(() => c.get());

		const eSpy = vi.fn(() => b.get() + " " + d.get());
		const e = computed(eSpy);

		const fSpy = vi.fn(() => e.get());
		const f = computed(fSpy);
		const gSpy = vi.fn(() => e.get());
		const g = computed(gSpy);

		expect(f.get()).to.equal("a a");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.get()).to.equal("a a");
		expect(gSpy).toHaveBeenCalledOnce();

		eSpy.mockClear();
		fSpy.mockClear();
		gSpy.mockClear();

		a.set("b");

		expect(e.get()).to.equal("b b");
		expect(eSpy).toHaveBeenCalledOnce();

		expect(f.get()).to.equal("b b");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.get()).to.equal("b b");
		expect(gSpy).toHaveBeenCalledOnce();

		eSpy.mockClear();
		fSpy.mockClear();
		gSpy.mockClear();

		a.set("c");

		expect(e.get()).to.equal("c c");
		expect(eSpy).toHaveBeenCalledOnce();

		expect(f.get()).to.equal("c c");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.get()).to.equal("c c");
		expect(gSpy).toHaveBeenCalledOnce();

		// top to bottom
		// expect(eSpy).to.have.been.calledBefore(fSpy);
		// left to right
		// expect(fSpy).to.have.been.calledBefore(gSpy);
	});
});

it("should only subscribe to signals listened to", () => {
	runWithRoot(() => {
		//    *A
		//   /   \
		// *B     C <- we don't listen to C
		const a = signal("a");

		const b = computed(() => a.get());
		const spy = vi.fn(() => a.get());
		computed(spy);

		expect(b.get()).to.equal("a");
		expect(spy).not.toHaveBeenCalled();

		a.set("aa");
		expect(b.get()).to.equal("aa");
		expect(spy).not.toHaveBeenCalled();
	});
});

it("should only subscribe to signals listened to", () => {
	runWithRoot(() => {
		// Here both "B" and "C" are active in the beginning, but
		// "B" becomes inactive later. At that point it should
		// not receive any updates anymore.
		//    *A
		//   /   \
		// *B     D <- we don't listen to C
		//  |
		// *C
		const a = signal("a");
		const spyB = vi.fn(() => a.get());
		const b = computed(spyB);

		const spyC = vi.fn(() => b.get());
		const c = computed(spyC);

		const d = computed(() => a.get());

		let result = "";
		const unsub = effect(() => void (result = c.get()));

		expect(result).to.equal("a");
		expect(d.get()).to.equal("a");

		spyB.mockClear();
		spyC.mockClear();
		unsub();

		a.set("aa");

		expect(spyB).not.toHaveBeenCalled();
		expect(spyC).not.toHaveBeenCalled();
		expect(d.get()).to.equal("aa");
	});
});

it("should ensure subs update even if one dep unmarks it", () => {
	runWithRoot(() => {
		// In this scenario "C" always returns the same value. When "A"
		// changes, "B" will update, then "C" at which point its update
		// to "D" will be unmarked. But "D" must still update because
		// "B" marked it. If "D" isn't updated, then we have a bug.
		//     A
		//   /   \
		//  B     *C <- returns same value every time
		//   \   /
		//     D
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => {
			a.get();
			return "c";
		});
		const spy = vi.fn(() => b.get() + " " + c.get());
		const d = computed(spy);
		expect(d.get()).to.equal("a c");
		spy.mockClear();

		a.set("aa");
		d.get();
		expect(spy).toHaveReturnedWith("aa c");
	});
});

it("should ensure subs update even if two deps unmark it", () => {
	runWithRoot(() => {
		// In this scenario both "C" and "D" always return the same
		// value. But "E" must still update because "A"  marked it.
		// If "E" isn't updated, then we have a bug.
		//     A
		//   / | \
		//  B *C *D
		//   \ | /
		//     E
		const a = signal("a");
		const b = computed(() => a.get());
		const c = computed(() => {
			a.get();
			return "c";
		});
		const d = computed(() => {
			a.get();
			return "d";
		});
		const spy = vi.fn(() => b.get() + " " + c.get() + " " + d.get());
		const e = computed(spy);
		expect(e.get()).to.equal("a c d");
		spy.mockClear();

		a.set("aa");
		e.get();
		expect(spy).toHaveReturnedWith("aa c d");
	});
});
