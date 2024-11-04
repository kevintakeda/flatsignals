import { vi, expect, test } from "vitest";
import { computed, effect, root, signal, tick, untrack } from "../src/index.js";

test("untrack inside memos", () => {
  root(() => {
    const memoSpy = vi.fn();
    const x = signal("a");
    const a = computed(() => x.val + "!");
    const b = computed(() => {
      memoSpy();
      return untrack(() => a.val) + "!";
    });

    b.val;
    expect(memoSpy).toHaveBeenCalledTimes(1);
    expect(b.val).toBe("a!!");

    x.val = "x";
    expect(memoSpy).toHaveBeenCalledTimes(1);
  })
});

test("untrack inside effects", () => {
  root(() => {
    const a = signal("a");
    const b = signal("b");
    const c = computed(() => a.val + b.val);
    const spy = vi.fn(() => untrack(() => a.val + b.val + c.val));
    effect(spy);
    tick();
    expect(spy).toHaveBeenCalledTimes(1);

    a.val = "x";
    tick();
    expect(spy).toHaveBeenCalledTimes(1);

    b.val = "y";
    tick();
    expect(spy).toHaveBeenCalledTimes(1);
  })
});

// todo: maybe untrack should untrack everything
test("untrack inside untrack", () => {
  root(() => {
    const innerSpy = vi.fn();
    let updateInner!: () => void;

    const x = signal("x");

    untrack(() => {
      const a = signal("a");

      effect(() => {
        untrack(() => x.val);
        innerSpy(a.val);
      });

      updateInner = () => {
        a.val = "a!";
      };
    });

    updateInner();
    tick();
    expect(innerSpy).toHaveBeenCalledWith("a!");
    expect(innerSpy).toHaveBeenCalledTimes(1);
    tick();

    x.val = "x!"
    tick();
    expect(x.val).toBe("x!");
    expect(innerSpy).toHaveBeenCalledWith("a!");
    expect(innerSpy).toHaveBeenCalledTimes(1);
  });
});