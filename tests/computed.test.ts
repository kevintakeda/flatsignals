import { vi, expect, test } from "vitest";
import { computed, root, signal, tick } from "../src/index.js";

test("is cached", () => {
  root(() => {
    const a = signal(1);
    const b = signal(2);
    const cSpy = vi.fn(() => a.val + b.val);
    const c = signal(cSpy);
    expect(c.val).toBe(3);
    expect(c.val).toBe(3);
    expect(cSpy).toHaveBeenCalledTimes(1);
  })
});

test("is lazy", () => {
  root(() => {
    const a = signal("a");
    const b = signal("b");
    const cSpy = vi.fn(() => a.val + b.val);
    const c = signal(cSpy);
    a.val = "a!";
    b.val = "b!";
    expect(cSpy).toHaveBeenCalledTimes(0);
    expect(c.val).toBe("a!b!");
    expect(cSpy).toHaveBeenCalledTimes(1);
  })
});

test("is updated", () => {
  root(() => {
    const a = signal(false);
    const bSpy = vi.fn(() => a.val ? "1" : "2");
    const b = signal(bSpy);
    expect(b.val).toBe("2");
    a.val = true;
    expect(b.val).toBe("1");
    a.val = false;
    expect(b.val).toBe("2");
    a.val = true;
    expect(b.val).toBe("1");
    expect(bSpy).toHaveBeenCalledTimes(4);
  })
});

test("is dynamic (unsubscribe invisible dependencies)", () => {
  root(() => {
    const a = signal(false);
    const b = signal("b");
    const c = signal("c");

    const dSpy = vi.fn(() => a.val ? b.val : c.val);
    const d = signal(dSpy);
    expect(d.val).toBe("c");

    a.val = true;
    a.val = false;
    expect(d.val).toBe("c");
    expect(dSpy).toHaveBeenCalledTimes(2);
    b.val = "b!";
    b.val = "b!!";
    expect(d.val).toBe("c");
    expect(dSpy).toHaveBeenCalledTimes(2);

    a.val = true;
    expect(d.val).toBe("b!!");
    expect(dSpy).toHaveBeenCalledTimes(3);

    c.val = "c!";
    c.val = "c!!";
    expect(d.val).toBe("b!!");
    expect(dSpy).toHaveBeenCalledTimes(3);

    a.val = false;
    expect(d.val).toBe("c!!");
    expect(dSpy).toHaveBeenCalledTimes(4);
  })
});

test("diamond graph runs once", () => {
  root(() => {
    const a = signal("a");
    const b = computed(() => a.val);
    const c = computed(() => a.val);

    const spy = vi.fn(() => b.val + c.val);
    const d = signal(spy);

    expect(d.val).toBe("aa");
    expect(spy).toHaveBeenCalledTimes(1);

    a.val = "a!";

    expect(d.val).toBe("a!a!");
    expect(spy).toHaveBeenCalledTimes(2);
  })
});

test("repeating computeds runs once", () => {
  root(() => {
    const a = signal(1);
    const spyB = vi.fn(() => a.val + a.val);
    const b = computed(spyB);
    const spyC = vi.fn(() => a.val + b.val + a.val + b.val);
    const c = computed(spyC);
    const spyD = vi.fn(() => a.val + b.val + c.val + a.val + b.val + c.val);
    const d = computed(spyD);
    expect(d.val).toBe(18);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);
    a.val = 4;
    d.val;
    expect(spyB).toHaveBeenCalledTimes(2);
    expect(spyC).toHaveBeenCalledTimes(2);
    expect(spyD).toHaveBeenCalledTimes(2);
  })
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
  root(() => {
    const a = signal("a");
    const b = computed(() => a.val);
    const c = computed(() => a.val);
    const dSpy = vi.fn(() => b.val + c.val);
    const d = computed(dSpy);
    const e = computed(() => d.val);
    const f = computed(() => e.val);

    expect(e.val).toBe("aa");
    expect(f.val).toBe("aa");
    expect(dSpy).toBeCalledTimes(1);

    a.val = "b";
    expect(e.val).toBe("bb");
    expect(f.val).toBe("bb");
    expect(dSpy).toBeCalledTimes(2);
  })
});


test("track dependencies optimally", () => {
  root(() => {
    // After X is read changing A1 source shouldn't affect B2 computed.
    // A1  B1
    // |   |
    // A2  B2
    //  \  /
    //   X
    const a1 = signal("a");
    const a2Spy = vi.fn(() => a1.val);
    const a2 = computed(a2Spy);

    const b1 = signal("b");
    const b2Spy = vi.fn(() => b1.val);
    const b2 = computed(b2Spy);

    const x = computed(() => a2.val + b2.val)

    x.val; // trick the graph (to catch more dependencies than needed)
    expect(a2Spy).toBeCalledTimes(1);
    expect(b2Spy).toBeCalledTimes(1);

    b2Spy.mockClear();
    b2.val;
    expect(b2Spy).toBeCalledTimes(0);
    a1.val = "a!"; // updating A shouldn't affect B
    b2.val;
    expect(b2Spy).toBeCalledTimes(0);

    a2Spy.mockClear();
    a2.val;
    expect(a2Spy).toBeCalledTimes(1);
    b1.val = "b!"; // updating B shouldn't affect A
    a2.val;
    expect(a2Spy).toBeCalledTimes(1);
  })
})