import { bench, describe } from 'vitest';
import { FlatSignalsFramework, FrameworkComputed, FrameworkSignal, MaverickSignalsFramework, PreactSignalsFramework, ReactivelyFramework, type FrameworkBenchmarkApi } from './frameworks';

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

describe("dynamic dependencies", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const s1 = api.signal(true);
      const s2 = api.signal("a");
      const s3 = api.signal("b");
      const s4 = api.computed(() => s1.get() ? s2.get() : s3.get());
      let i = 0;
      return () => {
        api.runSync(() => {
          s1.set(i++ % 2 === 0);
          s4.get();
        })
      }
    });
  }
  runAll(op);
});

function testNtoN(sources: number, effects: number, times: number) {
  return function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      let count = 0, all: any[] = [];
      for (let i = 0; i < times; i++) {
        const local: any[] = []
        for (let i = 0; i < sources; i++) {
          const s = api.signal(i);
          all.push(s)
          local.push(s)
        }
        for (let i = 0; i < effects; i++) {
          api.effect(() => { local.forEach(el => el.get()); count++; });
        }
      }
      return () => {
        count = 0;
        api.runSync(() => {
          all.forEach(el => el.set(el.get() + 1));
        });
        console.assert(count === times * effects, api.name, count);
      }
    });
  }
}

describe("1 source to 32 effects", () => {
  const op = testNtoN(1, 32, 1)
  runAll(op);
});

describe("32 sources to 1 effect", () => {
  const op = testNtoN(32, 1, 1)
  runAll(op);
});

describe("1 source to 1 effect (8x)", () => {
  const op = testNtoN(1, 1, 8)
  runAll(op);
});

describe("1 source to 2 effects (8x)", () => {
  const op = testNtoN(1, 2, 8)
  runAll(op);
});

describe("2 sources to 1 effect (8x)", () => {
  const op = testNtoN(2, 1, 8)
  runAll(op);
});