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
      const head = api.signal(0);
      for (let j = 0; j < 10; j++) {
        const trigger = api.computed(() => (head.get() + j) % 2 === 0);
        const signals: FrameworkSignal<number>[] = []
        for (let i = 0; i < 4; i++) {
          signals.push(api.signal(i))
        }
        const between1 = api.computed(() => {
          let sum = 0;
          for (let i = 0; i < signals.length; i++) {
            sum += signals[i].get();
          }
          return sum
        });
        const between2 = api.computed(() => {
          let sum = 0;
          for (let i = signals.length - 1; i > 0; i--) {
            sum -= signals[i].get();
          }
          return sum
        });
        const end = api.computed(() => {
          return trigger.get() ? between1.get() : between2.get();
        })
        api.effect(() => end.get());
      }
      return () => {
        api.runSync(() => {
          head.update(el => el + 1);
        })
      }
    });
  }
  runAll(op);
});

describe("batch 25%", () => {
  const op = batchBench(16, 2, 4)
  runAll(op);
});

describe("batch 50%", () => {
  const op = batchBench(16, 2, 8)
  runAll(op);
});

describe("batch 75%", () => {
  const op = batchBench(16, 2, 12)
  runAll(op);
});

describe("batch 100%", () => {
  const op = batchBench(16, 2, 16)
  runAll(op);
});

describe("packed 30%", () => {
  const op = packedBench(16, 16, 0.3)
  runAll(op);
});

describe("packed 60%", () => {
  const op = packedBench(16, 16, 0.6)
  runAll(op);
});

describe("packed 80%", () => {
  const op = packedBench(16, 16, 0.8)
  runAll(op);
});

describe("dense batch ~1/3 (2x layers)", () => {
  const op = denseBench(16, 2, 2, 16 / 3)
  runAll(op);
});

describe("dense batch ~1/3 (4x layers)", () => {
  const op = denseBench(16, 4, 2, 16 / 3)
  runAll(op);
});

describe("dense batch ~1/3 (6x layers)", () => {
  const op = denseBench(16, 6, 2, 16 / 3)
  runAll(op);
});

describe("dense batch ~1/3 (8x layers)", () => {
  const op = denseBench(16, 8, 2, 16 / 3)
  runAll(op);
});

describe("dense batch ~1/3 (10x layers)", () => {
  const op = denseBench(16, 10, 2, 16 / 3)
  runAll(op);
});