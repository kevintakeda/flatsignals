// adapted from https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx

import { vi, it, expect } from "vitest";
import { root, tick, FlatSignals } from "../src/index.js";

it("should run computeds once for multiple dep changes", () => {
  root(() => {
    const a = new FlatSignals("a");
    const b = new FlatSignals("b");

    const compute = vi.fn(() => {
      // debugger;
      return a.val + b.val;
    });
    const c = new FlatSignals(compute);

    expect(c.val).toBe("ab");
    expect(compute).toHaveBeenCalledOnce();
    compute.mockClear();

    a.val = "aa";
    b.val = "bb";
    c.val;
    expect(compute).toHaveBeenCalledOnce();
  })
});

it("should drop A->B->A updates", async () => {
  root(() => {
    //     A
    //   / |
    //  B  | <- Looks like a flag doesn't it? :D
    //   \ |
    //     C
    //     |
    //     D
    const a = new FlatSignals(2);

    const b = new FlatSignals(() => a.val - 1);
    const c = new FlatSignals(() => a.val + b.val);

    const compute = vi.fn(() => "d: " + c.val);
    const d = new FlatSignals(compute);

    // Trigger read
    expect(d.val).to.equal("d: 3");
    expect(compute).toHaveBeenCalledOnce();
    compute.mockClear();

    a.val = 4;
    d.val;
    expect(compute).toHaveBeenCalledOnce();
  })
});

it("should only update every new signal once (diamond graph)", () => {
  root(() => {
    // In this scenario "D" should only update once when "A" receives
    // an update. This is sometimes referred to as the "diamond" scenario.
    //     A
    //   /   \
    //  B     C
    //   \   /
    //     D
    const a = new FlatSignals("a");
    const b = new FlatSignals(() => a.val);
    const c = new FlatSignals(() => a.val);

    const spy = vi.fn(() => b.val + " " + c.val);
    const d = new FlatSignals(spy);

    expect(d.val).to.equal("a a");
    expect(spy).toHaveBeenCalledOnce();

    a.val = "aa";
    expect(d.val).to.equal("aa aa");
    expect(spy).toHaveBeenCalledTimes(2);
  })
});

it("should only update every new FlatSignals once (diamond graph + tail)", () => {
  root(() => {
    // "E" will be likely updated twice if our mark+sweep logic is buggy.
    //     A
    //   /   \
    //  B     C
    //   \   /
    //     D
    //     |
    //     E
    const a = new FlatSignals("a");
    const b = new FlatSignals(() => a.val);
    const c = new FlatSignals(() => a.val);

    const d = new FlatSignals(() => b.val + " " + c.val);

    const spy = vi.fn(() => d.val);
    const e = new FlatSignals(spy);

    expect(e.val).to.equal("a a");
    expect(spy).toHaveBeenCalledOnce();

    a.val = "aa";
    expect(e.val).to.equal("aa aa");
    expect(spy).toHaveBeenCalledTimes(2);
  })
});

// this library can't bail out.
// it("should bail out if result is the same", () => {
//   root(() => {
//     // Bail out if value of "B" never changes
//     // A->B->C
//     const a = new FlatSignals("a");
//     const b = new FlatSignals(() => {
//       a.val;
//       return "foo";
//     });

//     const spy = vi.fn(() => b.val);
//     const c = new FlatSignals(spy);

//     expect(c.val).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();

//     a.val = "aa";
//     expect(c.val).to.equal("foo");
//     expect(spy).toHaveBeenCalledOnce();
//   })
// });

it("should only update every new signal once (jagged diamond graph + tails)", () => {
  root(() => {
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
    const a = new FlatSignals("a");

    const b = new FlatSignals(() => a.val);
    const c = new FlatSignals(() => a.val);

    const d = new FlatSignals(() => c.val);

    const eSpy = vi.fn(() => b.val + " " + d.val);
    const e = new FlatSignals(eSpy);

    const fSpy = vi.fn(() => e.val);
    const f = new FlatSignals(fSpy);
    const gSpy = vi.fn(() => e.val);
    const g = new FlatSignals(gSpy);

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
  })
});

it("should only subscribe to signals listened to", () => {
  root(() => {
    //    *A
    //   /   \
    // *B     C <- we don't listen to C
    const a = new FlatSignals("a");

    const b = new FlatSignals(() => a.val);
    const spy = vi.fn(() => a.val);
    new FlatSignals(spy);

    expect(b.val).to.equal("a");
    expect(spy).not.toHaveBeenCalled();

    a.val = "aa";
    expect(b.val).to.equal("aa");
    expect(spy).not.toHaveBeenCalled();
  })
});

it("should only subscribe to signals listened to", () => {
  root(() => {
    // Here both "B" and "C" are active in the beginning, but
    // "B" becomes inactive later. At that point it should
    // not receive any updates anymore.
    //    *A
    //   /   \
    // *B     D <- we don't listen to C
    //  |
    // *C
    const a = new FlatSignals("a");
    const spyB = vi.fn(() => a.val);
    const b = new FlatSignals(spyB);

    const spyC = vi.fn(() => b.val);
    const c = new FlatSignals(spyC);

    const d = new FlatSignals(() => a.val);

    let result = "";
    const unsub = new FlatSignals(() => (result = c.val), true);
    tick();

    expect(result).to.equal("a");
    expect(d.val).to.equal("a");

    spyB.mockClear();
    spyC.mockClear();
    unsub.val = ""; // unsubscribe

    a.val = "aa";

    expect(spyB).not.toHaveBeenCalled();
    expect(spyC).not.toHaveBeenCalled();
    expect(d.val).to.equal("aa");
  })
});

it("should ensure subs update even if one dep unmarks it", () => {
  root(() => {
    // In this scenario "C" always returns the same value. When "A"
    // changes, "B" will update, then "C" at which point its update
    // to "D" will be unmarked. But "D" must still update because
    // "B" marked it. If "D" isn't updated, then we have a bug.
    //     A
    //   /   \
    //  B     *C <- returns same value every time
    //   \   /
    //     D
    const a = new FlatSignals("a");
    const b = new FlatSignals(() => a.val);
    const c = new FlatSignals(() => {
      a.val;
      return "c";
    });
    const spy = vi.fn(() => b.val + " " + c.val);
    const d = new FlatSignals(spy);
    expect(d.val).to.equal("a c");
    spy.mockClear();

    a.val = "aa";
    d.val;
    expect(spy).toHaveReturnedWith("aa c");
  })
});

it("should ensure subs update even if two deps unmark it", () => {
  root(() => {
    // In this scenario both "C" and "D" always return the same
    // value. But "E" must still update because "A"  marked it.
    // If "E" isn't updated, then we have a bug.
    //     A
    //   / | \
    //  B *C *D
    //   \ | /
    //     E
    const a = new FlatSignals("a");
    const b = new FlatSignals(() => a.val);
    const c = new FlatSignals(() => {
      a.val;
      return "c";
    });
    const d = new FlatSignals(() => {
      a.val;
      return "d";
    });
    const spy = vi.fn(() => b.val + " " + c.val + " " + d.val);
    const e = new FlatSignals(spy);
    expect(e.val).to.equal("a c d");
    spy.mockClear();

    a.val = "aa";
    e.val;
    expect(spy).toHaveReturnedWith("aa c d");
  })
});
