
import { vi, expect, test } from "vitest";
import { computed, effect, root, signal, flushSync } from "../src/index.js";

test("effects", () => {
  root(() => {
    const a = signal(1);
    const b = signal(2);
    const cSpy = vi.fn(() => a.val + b.val);
    effect(cSpy);

    expect(cSpy).toHaveBeenCalledTimes(0);

    a.val = 10;
    flushSync();
    expect(cSpy).toHaveBeenCalledTimes(1);
    flushSync();
    expect(cSpy).toHaveBeenCalledTimes(1);

    b.val = 20;
    b.val = 30;
    flushSync();
    flushSync();
    expect(cSpy).toHaveBeenCalledTimes(2);
    flushSync();
    expect(cSpy).toHaveBeenCalledTimes(2);
  })
});

test("unsubscribe invisible dependencies", () => {
  root(() => {
    const a = signal(true);
    const b = signal("b");
    const c = signal("c");
    const fSpy = vi.fn(() => a.val ? b.val : c.val);
    effect(fSpy);

    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(1);
    a.val = false;
    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(2);
    a.val = true;
    c.val = "c!";
    c.val = "c!!";
    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(3);
    a.val = false;
    b.val = "b!";
    b.val = "b!!"
    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(4);
    a.val = false;
    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(4);
    b.val = "b!!!";
    flushSync();
    expect(fSpy).toHaveBeenCalledTimes(4);
  })
});

test("nested effects run once", () => {
  root(() => {
    const a = signal(2);
    const spyX = vi.fn(() => a.val);
    const spyY = vi.fn(() => a.val);
    const spyZ = vi.fn(() => a.val);
    effect(() => {
      spyX();
      effect(() => {
        spyY();
        effect(() => {
          spyZ();
        });
      });
    });

    expect(spyX).toHaveBeenCalledTimes(0);
    expect(spyY).toHaveBeenCalledTimes(0);
    expect(spyZ).toHaveBeenCalledTimes(0);

    flushSync();
    expect(spyX).toHaveBeenCalledTimes(1);
    expect(spyY).toHaveBeenCalledTimes(1);
    expect(spyZ).toHaveBeenCalledTimes(1);

    a.val = 4;
    a.val = 8;
    expect(spyX).toHaveBeenCalledTimes(1);
    expect(spyY).toHaveBeenCalledTimes(1);
    expect(spyZ).toHaveBeenCalledTimes(1);

    flushSync();
    expect(spyX).toHaveBeenCalledTimes(2);
    expect(spyY).toHaveBeenCalledTimes(2);
    expect(spyZ).toHaveBeenCalledTimes(2);
    expect(a.val).toBe(8);
  })
});

test("dispose effects", () => {
  root(() => {
    const a = signal("a");
    const bSpy = vi.fn(() => a.val);
    const dispose = effect(bSpy);
    expect(bSpy).toHaveBeenCalledTimes(0);

    // set a
    a.val = "a!";
    flushSync();
    expect(bSpy).toHaveBeenCalledTimes(1);
    a.val = "a!!";
    flushSync();
    expect(bSpy).toHaveBeenCalledTimes(2);
    dispose();
    bSpy.mockReset();

    a.val = "a!!!";
    flushSync();
    expect(bSpy).toHaveBeenCalledTimes(0);
    a.val = "a!!!!";
    flushSync();
    expect(bSpy).toHaveBeenCalledTimes(0);
    expect(bSpy).toHaveBeenCalledTimes(0);
  })
});

test("effect with conditional dependencies", () => {
  root(() => {
    const s1 = signal(true);
    const s2 = signal("a");
    const s3 = signal("b");
    const s4 = computed(() => s2.val);
    const s5 = computed(() => s3.val);
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
    flushSync();
    expect(result.val).toBe(0);
    s1.val = true;
    flushSync();
    expect(result.val).toBe(1);
  })
});

test("effect with deep dependencies", () => {
  root(() => {
    const a = signal(2);
    const spyB = vi.fn(() => a.val + 1);
    const b = computed(spyB);
    const spyC = vi.fn(() => b.val);
    const c = computed(spyC);
    const spyD = vi.fn(() => c.val);
    const d = computed(spyD);
    const spyE = vi.fn(() => d.val);
    effect(spyE);
    flushSync();
    expect(spyE).toHaveBeenCalledTimes(1);
    a.val = 4;
    flushSync();
    expect(spyE).toHaveBeenCalledTimes(2);
  })
});

test("effects using sources from top to bottom", () => {
  let count = vi.fn();
  return root(() => {
    const x = signal("x");
    const a = computed(() => x.val);
    const b = computed(() => a.val);
    effect(() => { x.val; count(); });
    effect(() => { a.val; count(); });
    effect(() => { b.val; count(); });

    flushSync();
    expect(count).toBeCalledTimes(3)

    count.mockClear();
    x.val = "x!";
    flushSync();
    expect(count).toBeCalledTimes(3)

    count.mockClear();
    x.val = "x!!";
    flushSync();
    expect(count).toBeCalledTimes(3)
  });
});