import { vi, expect, test } from "vitest";
import { root, signal, tick } from "../src/index.js";

test("caching", () => {
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

test("laziness", () => {
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

test("with simple condition", () => {
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

test("unsubscribe invisible dependencies", () => {
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

test("diamond", () => {
  root(() => {
    const a = signal("a");
    const b = signal(() => a.val);
    const c = signal(() => a.val);

    const spy = vi.fn(() => b.val + c.val);
    const d = signal(spy);

    expect(d.val).toBe("aa");
    expect(spy).toHaveBeenCalledTimes(1);

    a.val = "a!";

    expect(d.val).toBe("a!a!");
    expect(spy).toHaveBeenCalledTimes(2);
  })
});

test("deep nested memos", () => {
  root(() => {
    const a = signal(2);
    const spyB = vi.fn(() => a.val + 1);
    const b = signal(spyB);
    const spyC = vi.fn(() => a.val + b.val);
    const c = signal(spyC);
    const spyD = vi.fn(() => a.val + b.val + c.val);
    const d = signal(spyD);
    expect(d.val).toBe(10);
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

test("chained memos", () => {
  root(() => {
    const a = signal("a");
    const spyB = vi.fn(() => a.val);
    const b = signal(spyB);
    const c = signal(() => b.val);
    const d = signal(() => c.val);
    const e = signal(() => d.val);

    expect(c.val).toBe("a");
    expect(a.val).toBe("a");
    expect(b.val).toBe("a");
    expect(e.val).toBe("a");
    expect(d.val).toBe("a");
    expect(spyB).toHaveBeenCalledTimes(1);

    a.val = "a!";
    expect(c.val).toBe("a!");
    expect(a.val).toBe("a!");
    expect(b.val).toBe("a!");
    expect(e.val).toBe("a!");
    expect(d.val).toBe("a!");
    expect(spyB).toHaveBeenCalledTimes(2);
  })
});

test("multi-branch linked by memo", () => {
  root(() => {
    const a = signal("a");
    const b = signal(() => a.val);
    const c = signal(() => a.val);
    const dSpy = vi.fn(() => b.val + c.val);
    const d = signal(dSpy);
    const e = signal(() => d.val);
    const f = signal(() => d.val);

    expect(e.val).toBe("aa");
    expect(f.val).toBe("aa");
    expect(dSpy).toBeCalledTimes(1);

    a.val = "b";
    expect(e.val).toBe("bb");
    expect(f.val).toBe("bb");
    expect(dSpy).toBeCalledTimes(2);
  })
});

test("tree", () => {
  root(() => {
    const a = signal("a");
    const b = signal("b");
    const c = signal("c");
    const d = signal("d");
    const e = signal(() => a.val + b.val);
    const f = signal(() => c.val + d.val);
    const gSpy = vi.fn(() => e.val + f.val);
    const g = signal(gSpy);
    expect(e.val).toBe("ab");
    expect(f.val).toBe("cd");
    expect(gSpy).toBeCalledTimes(0);
    expect(g.val).toBe("abcd");
    expect(gSpy).toBeCalledTimes(1);
    d.val = "d!";
    c.val = "c!";
    b.val = "b!";
    a.val = "a!";
    expect(e.val).toBe("a!b!");
    expect(f.val).toBe("c!d!");
    expect(gSpy).toBeCalledTimes(1);
    expect(g.val).toBe("a!b!c!d!");
    expect(gSpy).toBeCalledTimes(2);
  })
});
