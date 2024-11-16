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

export function packedBench(sources: number, effects: number, densityFactor: number = 0.3) {
  return function op(api: FrameworkBenchmarkApi) {
    const packing = Math.min(Math.ceil(densityFactor * sources), sources);
    return api.root(() => {
      let countEff = 0;
      let head: (FrameworkSignal<number>)[] = [];
      for (let i = 0; i < sources; i++) {
        const x = api.signal(i);
        head.push(x);
      }

      for (let j = 0; j < effects; j++) {
        const using: FrameworkSignal[] = [];
        for (let k = 0; k < packing; k++) {
          using.push(head[(j + k) % head.length])
        }
        api.effect(() => {
          for (let i = 0; i < using.length; i++) {
            using[i].get();
          }
          countEff++;
        });
      }
      api.runSync(() => void 0);
      const rnd = mulberry32(123456);
      let j = 0;
      const atleast = Math.ceil(effects * densityFactor)
      return () => {
        countEff = 0;
        api.runSync(() => {
          const el = head[Math.floor(rnd() * head.length)];
          el.update(el => el + 1);
        });
        console.assert(countEff === atleast, api.name, countEff);
      }
    });
  }
}

export function denseBench(heads: number, layers: number, spread = 2, batchSize = 1) {
  function op(api: FrameworkBenchmarkApi) {
    return api.root(() => {
      const rnd1 = mulberry32(0x1111);
      const rnd2 = mulberry32(0x2222);
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
      return () => {
        api.runSync(() => {
          for (let j = 0; j < batchSize; j++) {
            const idx = Math.floor(rnd1() * allHeads.length)
            allHeads[idx].update(el => el + 1);
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
            count++;
            c.get();
          });
        }
      }

      const uniqueSets = new Set<FrameworkSignal<any>>();
      return () => {
        count = 0;
        uniqueSets.clear();
        api.runSync(() => {
          const start = Math.floor(rnd() * xs.length);
          for (let i = 0; i < batchSize; i++) {
            const pos = xs[(i + start) % xs.length]
            uniqueSets.add(pos);
            pos.update(el => el + 1);
          }
        })
        console.assert(count === uniqueSets.size * width, count, api.name);
      }
    });
  }
}