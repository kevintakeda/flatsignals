import { vi, expect, test } from "vitest";
import { root, signal, tick, onDispose, effect, channel, computed, Computed, DataSignal } from "../src/index.js";

test("untracked", () => {
  const spy = vi.fn();
  let S!: DataSignal;
  root(() => {
    S = signal(0);
    S.val;
    spy();
  });

  expect(spy).toBeCalledTimes(1);
  S.val = true;
  expect(spy).toBeCalledTimes(1);
});

test("should not throw if dispose called during active disposal process", () => {
  root(dispose => {
    onDispose(() => dispose());
    dispose();
  });
});

test("should dispose of inner computations", () => {
  let $x!: DataSignal<number>;
  let $y!: Computed<number>;

  const _memo = vi.fn(() => $x.val + 10);
  const _effect = vi.fn(() => $x.val + 10);

  root(dispose => {
    $x = signal(10);
    $y = computed(_memo);
    effect(_effect);
    $y.val;
    dispose();
  });

  // expect($y!.val).toBe(null);
  expect(_memo).toHaveBeenCalledTimes(1);
  expect(_effect).toHaveBeenCalledTimes(0);

  tick();
  $x!.val = 50;
  tick();

  // expect($y!.val).toBe(null);
  expect(_memo).toHaveBeenCalledTimes(1);
  expect(_effect).toHaveBeenCalledTimes(0);
});


test("channel", () => {
  const spyInner = vi.fn();
  const spyOuter = vi.fn();

  root(() => {
    const global = signal(10);
    effect(() => {
      spyOuter(global.val);
    })

    root(() => {
      const inner = channel(global)
      effect(() => {
        spyInner(inner.val);
      });
    })

    global.val = 5;
    tick();
    expect(spyInner).toBeCalledTimes(1);
    expect(spyInner).toBeCalledWith(5);

    expect(spyOuter).toBeCalledTimes(1);
    expect(spyOuter).toBeCalledWith(5);

    global.val = 20;
    tick();
    expect(spyInner).toBeCalledTimes(2);
    expect(spyInner).toBeCalledWith(20);

    expect(spyOuter).toBeCalledTimes(2);
    expect(spyOuter).toBeCalledWith(20);
  });
});


test("scoped", () => {
  const spyEffectCalled = vi.fn();
  const spyBCalled = vi.fn();
  const spyACalled = vi.fn();
  const inner = vi.fn();

  root(() => {
    const a = signal("a");
    let updateInner!: () => void;
    effect(() => {
      spyEffectCalled();
      if (a.val === "b") {
        root(() => {
          spyBCalled();
          const $ = signal("$");
          effect(() => {
            $.val;
            inner();
          })
          updateInner = () => $.val = $.val + $.val
        });
      } else {
        root(() => {
          spyACalled();
        });
      }
    })

    tick();
    expect(spyEffectCalled).toBeCalledTimes(1);
    expect(spyACalled).toBeCalledTimes(1);
    expect(spyBCalled).toBeCalledTimes(0);
    expect(inner).toBeCalledTimes(0);

    a.val = "b";
    tick();
    expect(spyEffectCalled).toBeCalledTimes(2);
    expect(spyBCalled).toBeCalledTimes(1);
    expect(spyACalled).toBeCalledTimes(1);
    expect(inner).toBeCalledTimes(1);

    updateInner();
    tick();
    expect(inner).toBeCalledTimes(2);

    a.val = "a";
    tick();
    expect(spyEffectCalled).toBeCalledTimes(3);
    expect(inner).toBeCalledTimes(2);

    updateInner();
    tick();
    expect(spyEffectCalled).toBeCalledTimes(3);
    expect(inner).toBeCalledTimes(2);
  })
});