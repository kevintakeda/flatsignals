import { expect, test, vi } from "vitest";
import { Computation, computed, DataSignal, effect, onDispose, root, signal, flushSync } from "../src/index.js";

test("untracked", () => {
  const spy = vi.fn();
  let S!: DataSignal<number>;
  root(() => {
    S = signal(0);
    S.val;
    spy();
  });

  expect(spy).toBeCalledTimes(1);
  S.val = 1;
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
  let $y!: Computation<number>;

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

  flushSync();
  $x!.val = 50;
  flushSync();

  // expect($y!.val).toBe(null);
  expect(_memo).toHaveBeenCalledTimes(1);
  expect(_effect).toHaveBeenCalledTimes(0);
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

    flushSync();
    expect(spyEffectCalled).toBeCalledTimes(1);
    expect(spyACalled).toBeCalledTimes(1);
    expect(spyBCalled).toBeCalledTimes(0);
    expect(inner).toBeCalledTimes(0);

    a.val = "b";
    flushSync();
    expect(spyEffectCalled).toBeCalledTimes(2);
    expect(spyBCalled).toBeCalledTimes(1);
    expect(spyACalled).toBeCalledTimes(1);
    expect(inner).toBeCalledTimes(1);

    updateInner();
    flushSync();
    expect(inner).toBeCalledTimes(2);

    a.val = "a";
    flushSync();
    expect(spyEffectCalled).toBeCalledTimes(3);
    expect(inner).toBeCalledTimes(2);

    updateInner();
    flushSync();
    expect(spyEffectCalled).toBeCalledTimes(3);
    expect(inner).toBeCalledTimes(2);
  })
});