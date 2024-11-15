import { describe } from 'vitest';
import { FrameworkComputed, FrameworkSignal, runAll, type FrameworkBenchmarkApi } from './frameworks';
import { batchBench, denseBench, mulberry32, packedBench } from './utils';

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
        console.assert(countEff === width, api.name)
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

describe("dynamic", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const trigger = api.signal(true);
      const signals: FrameworkSignal<number>[] = []
      for (let i = 0; i < 16; i++) {
        signals.push(api.signal(i))
      }
      const between1 = api.computed(() => {
        let sum = 0;
        for (let i = 0; i < signals.length; i++) {
          sum += signals[i].get();
        }
        return sum
      });
      api.effect(() => between1.get());
      const between2 = api.computed(() => {
        let sum = 0;
        for (let i = signals.length - 1; i > 0; i--) {
          sum -= signals[i].get();
        }
        return sum
      });
      api.effect(() => between2.get());
      const end = api.computed(() => {
        return trigger.get() ? between1.get() : between2.get();
      })
      api.effect(() => end.get());
      let i = 0;
      return () => {
        api.runSync(() => {
          trigger.set(i++ % 2 === 0);
        })
      }
    });
  }
  runAll(op);
});

describe("batch 2 (4 sources)", () => {
  const op = batchBench(4, 16, 2)
  runAll(op);
});

describe("batch 8 (16 sources)", () => {
  const op = batchBench(16, 16, 8)
  runAll(op);
});

describe("batch 16 (32 sources)", () => {
  const op = batchBench(16, 16, 16)
  runAll(op);
});

describe("packed (30%)", () => {
  const op = packedBench(16, 16, 0.3)
  runAll(op);
});

describe("packed (60%)", () => {
  const op = packedBench(16, 16, 0.6)
  runAll(op);
});

describe("packed (80%)", () => {
  const op = packedBench(16, 16, 0.8)
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