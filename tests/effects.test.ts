
import { vi, expect, test } from "vitest";
import { effect, root, signal, tick } from "../src/index.js";

test("effects", () => {
  root(() => {
    const a = signal(1);
    const b = signal(2);
    const cSpy = vi.fn(() => a.val + b.val);
    const c = effect(cSpy);
    expect(cSpy).toHaveBeenCalledTimes(0);
    expect(c.val).toBe(3);
    expect(c.val).toBe(3);
    expect(cSpy).toHaveBeenCalledTimes(1);
    a.val = 10;
    expect(cSpy).toHaveBeenCalledTimes(1);
    expect(c.val).toBe(12);
    expect(cSpy).toHaveBeenCalledTimes(2);
    b.val = 20;
    expect(cSpy).toHaveBeenCalledTimes(2);
    expect(c.val).toBe(30);
    expect(cSpy).toHaveBeenCalledTimes(3);
  })
});

test("unsubscribe invisible dependencies", () => {
  root(() => {
    const a = signal(true);
    const b = signal("b");
    const c = signal("c");
    const d = effect(() => b.val);
    const e = effect(() => c.val);
    const fSpy = vi.fn(() => a.val ? d.val : e.val);
    const f = effect(fSpy);

    expect(f.val).toBe("b");
    expect(fSpy).toHaveBeenCalledTimes(1);
    a.val = false;
    expect(f.val).toBe("c");
    expect(fSpy).toHaveBeenCalledTimes(2);
    a.val = true;
    expect(f.val).toBe("b");
    c.val = "c!";
    c.val = "c!!";
    expect(fSpy).toHaveBeenCalledTimes(3);
    a.val = false;
    expect(f.val).toBe("c!!");
    b.val = "b!";
    b.val = "b!!";
    expect(fSpy).toHaveBeenCalledTimes(4);
    a.val = false;
    expect(fSpy).toHaveBeenCalledTimes(4);
    b.val = "b!!!";
    expect(fSpy).toHaveBeenCalledTimes(4);
  })
});

test("nested effects run once", () => {
  root(() => {
    const a = signal(2);
    const spyB = vi.fn(() => a.val);
    const b = effect(spyB);
    const spyC = vi.fn(() => a.val);
    const c = effect(spyC);
    const spyD = vi.fn(() => a.val);
    const d = effect(spyD);

    // read a
    expect(a.val).toBe(2);
    expect(spyB).toHaveBeenCalledTimes(0);
    expect(spyC).toHaveBeenCalledTimes(0);
    expect(spyD).toHaveBeenCalledTimes(0);

    // read effect
    expect(d.val).toBe(2);
    expect(spyD).toHaveBeenCalledTimes(1);

    // set twice
    a.val = 4;
    a.val = 4;
    expect(spyB).toHaveBeenCalledTimes(0);
    expect(spyC).toHaveBeenCalledTimes(0);
    expect(spyD).toHaveBeenCalledTimes(1);

    // read all values
    expect(a.val).toBe(4);
    expect(b.val).toBe(4);
    expect(c.val).toBe(4);
    expect(d.val).toBe(4);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(2);
    tick();
  })
});

test("dispose effects", () => {
  root(() => {
    const a = signal("a");
    const bSpy = vi.fn(() => a.val);
    const b = effect(bSpy);
    expect(bSpy).toHaveBeenCalledTimes(0);

    // read effect
    expect(b.val).toBe("a");
    expect(bSpy).toHaveBeenCalledTimes(1);

    // set a
    a.val = "a!";
    expect(bSpy).toHaveBeenCalledTimes(1);

    // dispose effect
    b.dispose();
    expect(b.val).toBe(null);
    expect(bSpy).toHaveBeenCalledTimes(1);
    a.val = "a!!";
    expect(bSpy).toHaveBeenCalledTimes(1);
    a.val = "a!!!";
    expect(bSpy).toHaveBeenCalledTimes(1);
    tick();
  })
});

test("effect with conditional dependencies", () => {
  root(() => {
    const s1 = signal(true);
    const s2 = signal("a");
    const s3 = signal("b");
    const s4 = signal(() => s2.val);
    const s5 = signal(() => s3.val);
    let result = { val: 0 };
    effect(
      () => {
        if (s1.val) {
          s4.val;
          result.val = 1;
        } else {
          s5.val;
          result.val = 0;
        }
      }
    );
    s1.val = false;
    tick();
    expect(result.val).toBe(0);
    s1.val = true;
    tick();
    expect(result.val).toBe(1);
  })
});

test("effect with deep dependencies", () => {
  root(() => {
    const a = signal(2);
    const spyB = vi.fn(() => a.val + 1);
    const b = signal(spyB);
    const spyC = vi.fn(() => b.val);
    const c = signal(spyC);
    const spyD = vi.fn(() => c.val);
    const d = signal(spyD);
    const spyE = vi.fn(() => d.val);
    effect(spyE);
    tick();
    expect(spyE).toHaveBeenCalledTimes(1);
    a.val = 4;
    tick();
    expect(spyE).toHaveBeenCalledTimes(2);
  })
});
