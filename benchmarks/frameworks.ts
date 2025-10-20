import { Reactive, stabilize } from "@reactively/core";
import {
  computed as alienComputed,
  effect as alienEffect,
  endBatch,
  signal as alienSignal,
  startBatch,
  effectScope,
} from "alien-signals/esm";
import { signal, effect, root, computed, batch } from "../src/index.js"
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
import { bench } from "vitest";

export interface FrameworkSignal<T = any> {
  get(): T;
  set(v: T): void;
  update(v: (p: T) => T): void;
}
export interface FrameworkComputed<T = any> {
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

export function runAll(op: (api: FrameworkBenchmarkApi) => (() => void)) {
  const x0 = op(FlatSignalsFramework);
  bench(FlatSignalsFramework.name, () => {
    x0()
  });

  const x1 = op(PreactSignalsFramework);
  bench(PreactSignalsFramework.name, () => {
    x1();
  });

  const x2 = op(ReactivelyFramework);
  bench(ReactivelyFramework.name, () => {
    x2();
  });

  const x3 = op(MaverickSignalsFramework);
  bench(MaverickSignalsFramework.name, () => {
    x3();
  });

  const x4 = op(AlienSignalsFramework);
  bench(AlienSignalsFramework.name, () => {
    x4();
  });
}

export const FlatSignalsFramework: FrameworkBenchmarkApi = {
  name: "flatsignals",
  signal: (val) => {
    const S = signal(val);
    return {
      set: (v) => S.val = v,
      get: () => S.val,
      update: (u) => S.val = u(S.val)
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
    batch(() => fn());
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
      update: (u) => S.set(u(S.get()))
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
      update: (fn) => S.value = fn(S.peek()),
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
      update: (fn) => S.set(fn),
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


let scope: (() => void) | null = null;
export const AlienSignalsFramework: FrameworkBenchmarkApi = {
  name: "alien-signals",
  signal: (val) => {
    const S = alienSignal(val);
    return {
      get: () => S(),
      set: (v) => S(v),
      update: (fn) => S(fn(S())),
    };
  },
  computed: (fn) => {
    const S = alienComputed(fn);
    return {
      get: () => S(),
    };
  },
  effect: (fn) => alienEffect(fn),
  runSync: (fn) => {
    startBatch();
    fn();
    endBatch();
  },
  root: <T>(fn: () => T) => {
    let out!: T;
    scope = effectScope(() => {
      out = fn();
    });
    return out;
  },
};