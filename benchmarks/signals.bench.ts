import { bench, describe } from 'vitest';
import { FlatSignalsFramework, FrameworkComputed, FrameworkSignal, MaverickSignalsFramework, PreactSignalsFramework, ReactivelyFramework, type FrameworkBenchmarkApi } from './frameworks';
import { denseBench, mulberry32, packedBench } from './utils';

function runAll(op: (api: FrameworkBenchmarkApi) => (() => void)) {

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
}

describe("wide propagation (32x)", () => {
  function op(api: FrameworkBenchmarkApi) {
    const width = 32;
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

describe("deep propagation (32x)", () => {
  function op(api: FrameworkBenchmarkApi) {
    const height = 32;
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

describe("highly dynamic", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const rnd = mulberry32(0x9999);
      const trigger = api.signal(true);
      const signals: FrameworkSignal<number>[] = []
      for (let i = 0; i < 10; i++) {
        signals.push(api.signal(i))
      }
      const between1 = api.computed(() => {
        const x = signals[Math.floor(rnd() % signals.length)].get();
        const y = signals[Math.floor(rnd() % signals.length)].get();
        const z = signals[Math.floor(rnd() % signals.length)].get();
        return x + y + z;
      });
      const between2 = api.computed(() => {
        const x = signals[Math.floor(rnd() % signals.length)].get();
        const y = signals[Math.floor(rnd() % signals.length)].get();
        const z = signals[Math.floor(rnd() % signals.length)].get();
        return x + y + z;
      });
      const end = api.computed(() => {
        return trigger.get() ? between1.get() : between2.get();
      })
      api.effect(() => end.get());
      let i = 0;
      return () => {
        api.runSync(() => {
          trigger.set(i++ % 2 === 0);
          end.get();
        })
      }
    });
  }
  runAll(op);
});

describe("packed (8x sources)", () => {
  const op = packedBench(8, 1, 0.3)
  runAll(op);
});

describe("packed (24x sources)", () => {
  const op = packedBench(24, 24, 0.3)
  runAll(op);
});

describe("packed (32x sources)", () => {
  const op = packedBench(32, 32, 0.3)
  runAll(op);
});

describe("dense (2x layers)", () => {
  const op = denseBench(4, 2, 2)
  runAll(op);
});

describe("dense (4x layers)", () => {
  const op = denseBench(4, 4, 2)
  runAll(op);
});

describe("dense (8x layers)", () => {
  const op = denseBench(4, 8, 2)
  runAll(op);
});

describe("dense (12x layers)", () => {
  const op = denseBench(4, 12, 2)
  runAll(op);
});