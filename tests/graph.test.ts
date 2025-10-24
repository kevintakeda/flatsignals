// adapted from https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx
/** biome-ignore-all lint/suspicious/noAssignInExpressions: conciseness */

import { expect, it, vi } from "vitest";
import { computed, effect, scoped, signal } from "../src/index.js";

it("should run computeds once for multiple dep changes", () => {
	scoped(() => {
		const a = signal("a");
		const b = signal("b");

		const compute = vi.fn(() => {
			// debugger;
			return a.val + b.val;
		});
		const c = computed(compute);

		expect(c.val).toBe("ab");
		expect(compute).toHaveBeenCalledOnce();
		compute.mockClear();

		a.val = "aa";
		b.val = "bb";
		c.val;
		expect(compute).toHaveBeenCalledOnce();
	});
});

it("should drop A->B->A updates", async () => {
	scoped(() => {
		//     A
		//   / |
		//  B  | <- Looks like a flag doesn't it? :D
		//   \ |
		//     C
		//     |
		//     D
		const a = signal(2);

		const b = computed(() => a.val - 1);
		const c = computed(() => a.val + b.val);

		const compute = vi.fn(() => "d: " + c.val);
		const d = computed(compute);

		// Trigger read
		expect(d.val).to.equal("d: 3");
		expect(compute).toHaveBeenCalledOnce();
		compute.mockClear();

		a.val = 4;
		d.val;
		expect(compute).toHaveBeenCalledOnce();
	});
});

it("should only update every signal once (diamond graph)", () => {
	scoped(() => {
		// In this scenario "D" should only update once when "A" receives
		// an update. This is sometimes referred to as the "diamond" scenario.
		//     A
		//   /   \
		//  B     C
		//   \   /
		//     D
		const a = signal("a");
		const b = computed(() => a.val);
		const c = computed(() => a.val);

		const spy = vi.fn(() => b.val + " " + c.val);
		const d = computed(spy);

		expect(d.val).to.equal("a a");
		expect(spy).toHaveBeenCalledOnce();

		a.val = "aa";
		expect(d.val).to.equal("aa aa");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

it("should only update every signal once (diamond graph + tail)", () => {
	scoped(() => {
		// "E" will be likely updated twice if our mark+sweep logic is buggy.
		//     A
		//   /   \
		//  B     C
		//   \   /
		//     D
		//     |
		//     E
		const a = signal("a");
		const b = computed(() => a.val);
		const c = computed(() => a.val);

		const d = computed(() => b.val + " " + c.val);

		const spy = vi.fn(() => d.val);
		const e = computed(spy);

		expect(e.val).to.equal("a a");
		expect(spy).toHaveBeenCalledOnce();

		a.val = "aa";
		expect(e.val).to.equal("aa aa");
		expect(spy).toHaveBeenCalledTimes(2);
	});
});

// this library can't bail out.
// it("should bail out if result is the same", () => {
//   scoped(() => {
//     // Bail out if value of "B" never changes
//     // A->B->C
//     const a = signal("a");
//     const b = computed(() => {
//       a.val;
//       return "foo";
//     });

//     const spy = vi.fn(() => b.val);
//     const c = computed(spy);

//     expect(c.val).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();

//     a.val = "aa";
//     expect(c.val).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();
//   })
// });

it("should only update every signal once (jagged diamond graph + tails)", () => {
	scoped(() => {
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

		const b = computed(() => a.val);
		const c = computed(() => a.val);

		const d = computed(() => c.val);

		const eSpy = vi.fn(() => b.val + " " + d.val);
		const e = computed(eSpy);

		const fSpy = vi.fn(() => e.val);
		const f = computed(fSpy);
		const gSpy = vi.fn(() => e.val);
		const g = computed(gSpy);

		expect(f.val).to.equal("a a");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.val).to.equal("a a");
		expect(gSpy).toHaveBeenCalledOnce();

		eSpy.mockClear();
		fSpy.mockClear();
		gSpy.mockClear();

		a.val = "b";

		expect(e.val).to.equal("b b");
		expect(eSpy).toHaveBeenCalledOnce();

		expect(f.val).to.equal("b b");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.val).to.equal("b b");
		expect(gSpy).toHaveBeenCalledOnce();

		eSpy.mockClear();
		fSpy.mockClear();
		gSpy.mockClear();

		a.val = "c";

		expect(e.val).to.equal("c c");
		expect(eSpy).toHaveBeenCalledOnce();

		expect(f.val).to.equal("c c");
		expect(fSpy).toHaveBeenCalledOnce();

		expect(g.val).to.equal("c c");
		expect(gSpy).toHaveBeenCalledOnce();

		// top to bottom
		// expect(eSpy).to.have.been.calledBefore(fSpy);
		// left to right
		// expect(fSpy).to.have.been.calledBefore(gSpy);
	});
});

it("should only subscribe to signals listened to", () => {
	scoped(() => {
		//    *A
		//   /   \
		// *B     C <- we don't listen to C
		const a = signal("a");

		const b = computed(() => a.val);
		const spy = vi.fn(() => a.val);
		computed(spy);

		expect(b.val).to.equal("a");
		expect(spy).not.toHaveBeenCalled();

		a.val = "aa";
		expect(b.val).to.equal("aa");
		expect(spy).not.toHaveBeenCalled();
	});
});

it("should only subscribe to signals listened to", () => {
	scoped(() => {
		// Here both "B" and "C" are active in the beginning, but
		// "B" becomes inactive later. At that point it should
		// not receive any updates anymore.
		//    *A
		//   /   \
		// *B     D <- we don't listen to C
		//  |
		// *C
		const a = signal("a");
		const spyB = vi.fn(() => a.val);
		const b = computed(spyB);

		const spyC = vi.fn(() => b.val);
		const c = computed(spyC);

		const d = computed(() => a.val);

		let result = "";
		const unsub = effect(() => (result = c.val));

		expect(result).to.equal("a");
		expect(d.val).to.equal("a");

		spyB.mockClear();
		spyC.mockClear();
		unsub();

		a.val = "aa";

		expect(spyB).not.toHaveBeenCalled();
		expect(spyC).not.toHaveBeenCalled();
		expect(d.val).to.equal("aa");
	});
});

it("should ensure subs update even if one dep unmarks it", () => {
	scoped(() => {
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
		const b = computed(() => a.val);
		const c = computed(() => {
			a.val;
			return "c";
		});
		const spy = vi.fn(() => b.val + " " + c.val);
		const d = computed(spy);
		expect(d.val).to.equal("a c");
		spy.mockClear();

		a.val = "aa";
		d.val;
		expect(spy).toHaveReturnedWith("aa c");
	});
});

it("should ensure subs update even if two deps unmark it", () => {
	scoped(() => {
		// In this scenario both "C" and "D" always return the same
		// value. But "E" must still update because "A"  marked it.
		// If "E" isn't updated, then we have a bug.
		//     A
		//   / | \
		//  B *C *D
		//   \ | /
		//     E
		const a = signal("a");
		const b = computed(() => a.val);
		const c = computed(() => {
			a.val;
			return "c";
		});
		const d = computed(() => {
			a.val;
			return "d";
		});
		const spy = vi.fn(() => b.val + " " + c.val + " " + d.val);
		const e = computed(spy);
		expect(e.val).to.equal("a c d");
		spy.mockClear();

		a.val = "aa";
		e.val;
		expect(spy).toHaveReturnedWith("aa c d");
	});
});
