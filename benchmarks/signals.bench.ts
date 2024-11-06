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

describe("divergent effects", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const x = api.signal(1);
      let count = 0;
      for (let index = 0; index < 10; index++) {
        const a = api.computed(() => x.get());
        const b = api.computed(() => a.get());
        const c = api.computed(() => b.get());
        const d = api.computed(() => c.get());

        api.effect(() => { x.get(); count++; });
        api.effect(() => { a.get(); count++; });
        api.effect(() => { b.get(); count++; });
        api.effect(() => { c.get(); count++; });
        api.effect(() => { d.get(); count++; });
      }
      return () => {
        count = 0;
        api.runSync(() => {
          x.set(x.get() + 1);
        });
        console.assert(count === 10 * 5, count);
      }
    });
  }
  runAll(op);
});