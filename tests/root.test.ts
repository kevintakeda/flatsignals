import { vi, expect, test } from "vitest";
import { FlatSignal, root, signal, tick, onDispose, effect, dispose, link } from "../src/index.js";

test("untracked", () => {
  const spy = vi.fn();
  let S: FlatSignal;
  root(() => {
    S = signal(0);
    S.val;
    spy();
  });

  expect(spy).toBeCalledTimes(1);
  // @ts-ignore
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
  let $x: FlatSignal<number>;
  let $y: FlatSignal<number>;

  const _memo = vi.fn(() => $x.val + 10);
  const _effect = vi.fn(() => $x.val + 10);

  root(dispose => {
    $x = signal(10);
    $y = signal(_memo);
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


test("link", () => {
  const spyInner = vi.fn();
  const spyOuter = vi.fn();

  root(() => {
    const global = signal(10);
    effect(() => {
      spyOuter(global.val);
    })

    root(() => {
      const inner = link(global)
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

    dispose();
  });
});