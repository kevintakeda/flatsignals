import { bench, describe } from 'vitest'
import { FlatSignalsFramework, MaverickSignalsFramework, PreactSignalsFramework, ReactivelyFramework, type FrameworkBenchmarkApi } from './frameworks';

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

describe("5 sources, 100 memos, 25% read, 100% write", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const s1 = api.signal(1);
      const s2 = api.signal(1);
      const s3 = api.signal(1);
      const s4 = api.signal(1);
      const s5 = api.signal(1);

      const computations: Array<{ get(): number }> = [];
      for (let i = 0; i < 100; i++) {
        computations.push(
          api.computed(
            () =>
              s1.get() +
              s2.get() +
              s3.get() +
              s4.get() +
              s5.get()
          ))
      }
      return () => {
        s5.set(s5.get() + 1);
        for (let i = 0; i < computations.length; i++) {
          if (i % 4 === 0) {
            computations[i].get();
          }
        }
      }
    });
  }
  runAll(op);
});



describe("5 sources, 100 memos, 100% read, 25% write", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const s1 = api.signal(1);
      const s2 = api.signal(1);
      const s3 = api.signal(1);
      const s4 = api.signal(1);
      const s5 = api.signal(1);

      const computations: Array<{ get(): number }> = [];
      for (let i = 0; i < 100; i++) {
        computations.push(
          api.computed(
            () =>
              s1.get() +
              s2.get() +
              s3.get() +
              s4.get() +
              s5.get()
          ))
      }
      let j = 0;
      return () => {
        if (j % 4 === 0) {
          s5.set(s5.get() + 1);
        }
        for (let i = 0; i < computations.length; i++) {
          computations[i].get();
        }
        j++;
      }
    });
  }
  runAll(op);
});



describe("5 sources, 100 effects", () => {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const s1 = api.signal(1);
      const s2 = api.signal(1);
      const s3 = api.signal(1);
      const s4 = api.signal(1);
      const s5 = api.signal(1);
      api.runSync(() => {
        for (let i = 0; i < 100; i++) {
          if (i % 2 === 0) {
            api.effect(() => s1.get());
          } else {
            api.effect(() => s1.get() + s2.get() + s3.get() + s4.get() + s5.get());
          }
        }
      });
      let j = 0
      return () => {
        api.runSync(() => {
          s5.set(s5.get() + 1);
          s4.set(s4.get() + 1);
          s3.set(s3.get() + 1);
          s2.set(s2.get() + 1);
          s1.set(s1.get() + 1);
        });
        j++;
      }
    });
  }
  runAll(op);
});