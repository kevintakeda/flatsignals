import { bench, describe } from 'vitest';
import { FlatSignalsFramework, FrameworkComputed, FrameworkSignal, MaverickSignalsFramework, PreactSignalsFramework, ReactivelyFramework, type FrameworkBenchmarkApi } from './frameworks';
import { mulberry32, sourcesInEffects } from './utils';

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

describe("wide propagation (64x)", () => {
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


describe("deep propagation (64x)", () => {
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

describe("dynamic dependencies (60 updates/batch)", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const rnd = mulberry32(0x9999);
      const trigger = api.signal(true);
      const signals = [
        api.signal("a"),
        api.signal("b"),
        api.signal("c"),
        api.signal("d"),
        api.signal("e"),
      ]
      const end = api.computed(() => {
        trigger.get();
        signals[Math.floor(rnd() % signals.length)].get();
        signals[Math.floor(rnd() % signals.length)].get();
      });
      let i = 0;
      return () => {
        api.runSync(() => {
          for (let index = 0; index < 60; index++) {
            trigger.set(i++ % 2 === 0);
            end.get();
          }
        })
      }
    });
  }
  runAll(op);
});

describe("1 source in 1 effect (32x, 60 updates/batch)", () => {
  const op = sourcesInEffects(1, 1, 32, 60)
  runAll(op);
});

describe("1 source in 32 effects (60 updates/batch)", () => {
  const op = sourcesInEffects(1, 32, 1, 60)
  runAll(op);
});

describe("6 sources in 32 effects (4x, 60 updates/batch)", () => {
  const op = sourcesInEffects(6, 32, 4, 60)
  runAll(op);
});

describe("6 sources in 64 effects (4x, 60 updates/batch)", () => {
  const op = sourcesInEffects(6, 64, 4, 60)
  runAll(op);
});

describe("6 sources in 512 effects (4x, 60 updates/batch)", () => {
  const op = sourcesInEffects(6, 128, 4, 60)
  runAll(op);
});