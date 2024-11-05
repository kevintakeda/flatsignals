import { Reactive, stabilize } from "@reactively/core";
import { signal, effect, root, tick, computed } from "../src/index.js"
import {
  signal as psignal,
  effect as peffect,
  computed as pcomputed,
  batch as pbatch,
} from "@preact/signals-core";
import {
  root as mroot,
  signal as msignal,
  computed as mcomputed,
  effect as meffect,
  tick as mtick,
} from "@maverick-js/signals";

export interface FrameworkSignal<T = unknown> {
  get(): T;
  set(v: T): void;
}
export interface FrameworkComputed<T = unknown> {
  get(): T;
}
export interface FrameworkBenchmarkApi {
  name: string;
  signal<T>(val: T): FrameworkSignal<T>;
  computed<T>(fn: () => T): FrameworkComputed<T>;
  effect(fn: () => void): void;
  runSync<T>(fn: () => T): void;
  root<T>(fn: () => T): T;
}

export const FlatSignalsFramework: FrameworkBenchmarkApi = {
  name: "flatsignals",
  signal: (val) => {
    const S = signal(val);
    return {
      set: (v) => S.val = v,
      get: () => S.val,
    };
  },
  computed: (fn) => {
    const S = computed(fn);
    return {
      get: () => S.val,
    };
  },
  effect: (fn) => effect(fn),
  runSync: (fn) => {
    fn();
    tick();
  },
  root: (fn) => root(fn),
};

export const ReactivelyFramework: FrameworkBenchmarkApi = {
  name: "@reactively/core",
  signal: (val) => {
    const S = new Reactive(val);
    return {
      set: (v) => S.set(v),
      get: () => S.get(),
    };
  },
  computed: (fn) => {
    const S = new Reactive(fn);
    return {
      get: () => S.get(),
    };
  },
  effect: (fn) => new Reactive(fn, true),
  runSync: (fn) => {
    fn();
    stabilize();
  },
  root: (fn) => fn(),
};

export const PreactSignalsFramework: FrameworkBenchmarkApi = {
  name: "@preact/signals",
  signal: (val) => {
    const S = psignal(val);
    return {
      set: (v) => (S.value = v),
      get: () => S.value,
    };
  },
  computed: (fn) => {
    const S = pcomputed(fn);
    return {
      get: () => S.value,
    };
  },
  effect: (fn) => peffect(fn),
  runSync: (fn) => pbatch(fn),
  root: (fn) => fn(),
};

export const MaverickSignalsFramework: FrameworkBenchmarkApi = {
  name: "@maverick-js/signals",
  signal: (val) => {
    const S = msignal(val);
    return {
      set: (v) => S.set(v),
      get: () => S(),
    };
  },
  computed: (fn) => {
    const S = mcomputed(fn);
    return {
      get: () => S(),
    };
  },
  effect: (fn) => meffect(fn),
  runSync: (fn) => {
    fn();
    mtick();
  },
  root: (fn) => mroot(fn),
};