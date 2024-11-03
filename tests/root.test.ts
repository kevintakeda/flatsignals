import { vi, expect, test } from "vitest";
import { FlatSignal, root, signal, tick, onDispose, effect, dispose } from "../src/index.js";

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
  let $z: FlatSignal<number>;

  const _memo = vi.fn(() => $x.val + 10);
  const _effect = vi.fn(() => $x.val + 10);

  root(dispose => {
    $x = signal(10);
    $y = signal(_memo);
    $z = effect(_effect);
    $y.val;
    dispose();
  });

  expect($y!.val).toBe(null);
  expect(_memo).toHaveBeenCalledTimes(1);
  expect(_effect).toHaveBeenCalledTimes(0);

  tick();
  $x!.val = 50;
  tick();

  expect($y!.val).toBe(null);
  expect(_memo).toHaveBeenCalledTimes(1);
  expect(_effect).toHaveBeenCalledTimes(0);
});