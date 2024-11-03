import { bench, describe } from 'vitest';
import { FlatSignalsFramework, FrameworkComputed, MaverickSignalsFramework, PreactSignalsFramework, ReactivelyFramework, type FrameworkBenchmarkApi } from './frameworks';

function runAll(op: (api: FrameworkBenchmarkApi) => (() => void)) {
  const x0 = op(FlatSignalsFramework);
  bench("flatsignals", () => {
    x0()
  });

  const x1 = op(PreactSignalsFramework);
  bench("preact", () => {
    x1();
  });

  const x2 = op(ReactivelyFramework);
  bench("reactively", () => {
    x2();
  });

  const x3 = op(MaverickSignalsFramework);
  bench("@maverick-js/signals", () => {
    x3();
  });

}

describe("wide propagation", () => {
  function op(api: FrameworkBenchmarkApi) {
    const width = 20;
    return api.root(() => {
      let head = api.signal(0);
      let last = head as FrameworkComputed<number>;
      let countEff = 0, countComp = 0;
      for (let i = 0; i < width; i++) {
        let c = api.computed(() => {
          countComp++;
          return head.get() + i;
        });
        api.effect(() => {
          c.get();
          countEff++;
        });
        last = c;
      }

      return () => {
        api.runSync(() => head.set(1));
        countEff = 0;
        countComp = 0;
        api.runSync(() => head.set(2));
        console.assert(countEff === width)
        console.assert(countComp === width)
        console.assert(last.get() === width + 1)
      }
    })
  }
  runAll(op);
});


describe("deep propagation", () => {
  function op(api: FrameworkBenchmarkApi) {
    const height = 20;
    return api.root(() => {
      let head = api.signal(0);
      let current = head as FrameworkComputed<number>;
      let countEff = 0, countComp = 0;
      for (let i = 0; i < height; i++) {
        let prev = current;
        current = api.computed(() => {
          countComp++;
          return prev.get() + 1;
        });
      }
      api.effect(() => {
        current.get();
        countEff++;
      });

      return () => {
        api.runSync(() => head.set(1));
        countComp = 0; countEff = 0;
        api.runSync(() => head.set(2));
        console.assert(countComp === height);
        console.assert(countEff === 1);
        console.assert(current.get() === height + 2)
      };
    })
  }
  runAll(op);
});