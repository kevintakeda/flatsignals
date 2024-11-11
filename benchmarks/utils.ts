import { FrameworkBenchmarkApi } from "./frameworks";

// taken from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function sourcesInEffects(sources: number, effects: number, times: number, updatesPerBatch: number = 1, chanceOfUpdating = 0.2) {
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
      const rnd = mulberry32(0x7FFFD4);
      const hit = () => rnd() > (chanceOfUpdating / updatesPerBatch);
      return () => {
        count = 0;
        api.runSync(() => {
          for (let i = 0; i < updatesPerBatch; i++) {
            all.forEach(el => hit() && el.set(el.get() + 1 + i));
          }
        });
      }
    });
  }
}