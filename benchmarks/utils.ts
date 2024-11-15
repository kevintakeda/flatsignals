import { FrameworkBenchmarkApi, FrameworkComputed, FrameworkSignal } from "./frameworks";

// taken from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function packedBench(sources: number, effects: number, densityFactor: number = 0.3, updatesPerBatch: number = 1) {
  return function op(api: FrameworkBenchmarkApi) {
    const packing = densityFactor * sources;
    return api.root(() => {
      let head: (FrameworkSignal<number>)[] = [];
      for (let i = 0; i < sources; i++) {
        const x = api.signal(i);
        head.push(x);
      }

      for (let j = 0; j < effects; j++) {
        api.effect(() => {
          for (let k = 0; k < packing; k++) {
            head[(j + k) % head.length].get();
          }
        });
      }
      api.runSync(() => void 0);
      const rnd = mulberry32(123456);
      let i = 0, j = 0;
      return () => {
        i = 0;
        api.runSync(() => {
          while (i < updatesPerBatch) {
            const el = head[Math.floor(rnd() * head.length)];
            el.set(j++);
            i++;
          }
        });
      }
    });
  }
}

export function denseBench(heads: number, layers: number, spread = 2, batchSize = 1) {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const rnd2 = mulberry32(0x2222);
      const rnd = mulberry32(0x1111);
      const allHeads: FrameworkSignal<number>[] = []
      for (let h = 0; h < heads; h++) {
        const head = api.signal(1);
        allHeads.push(head);
        let lastLayer: FrameworkComputed<number>[] = [head]
        for (let j = 0; j < layers; j++) {
          const currentLayer: FrameworkComputed<number>[] = []
          for (const node of lastLayer) {
            for (let s = 0; s < spread; s++) {
              const rndLast1 = lastLayer[Math.floor(rnd2() * lastLayer.length)]
              const rndLast2 = lastLayer[Math.floor(rnd2() * lastLayer.length)]
              const x = api.computed(() => {
                return node.get() + rndLast1.get() + rndLast2.get()
              });
              currentLayer.push(x);
              const rndLast3 = lastLayer[Math.floor(rnd2() * lastLayer.length)]
              const rndLast4 = lastLayer[Math.floor(rnd2() * lastLayer.length)]
              api.effect(() => x.get() + rndLast3.get() + rndLast4.get())
            }
          }
          lastLayer = currentLayer;
        }
      }
      api.runSync(() => void 0);
      let i = 0;
      return () => {
        api.runSync(() => {
          for (let j = 0; j < batchSize; j++) {
            const idx = Math.floor(rnd() * allHeads.length)
            allHeads[idx].set(i++);
          }
        })
      }
    });
  }
  return op
}

export function batchBench(sources: number, width: number, batchSize: number = 4) {
  return function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const rnd = mulberry32(123456);
      let count = 0;
      const xs: FrameworkSignal[] = []
      for (let j = 0; j < sources; j++) {
        const x = api.signal(1);
        xs.push(x);
        for (let i = 0; i < width; i++) {
          const c = api.computed(() => {
            return x.get() + i;
          });
          api.effect(() => {
            c.get();
          });
        }
      }

      return () => {
        count = 0;
        api.runSync(() => {
          const start = Math.floor(rnd() * xs.length);
          for (let i = 0; i < batchSize; i++) {
            const pos = xs[(i + start) % xs.length]
            pos.set(pos.get() + 1)
          }
        })
        // console.assert(count === batchSize * effects, api.name);
      }
    });
  }
}