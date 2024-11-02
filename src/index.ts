let PREV_OWNER: Array<FS> | null = null,
  OWNER: Array<FS> | null = null,
  A: number | null = null,
  I = 0,
  EFFECT_QUEUE: Array<FS> = [],
  QUEUED = false;

export function root<T>(fn: () => T) {
  PREV_OWNER = OWNER; I = 0;
  if (!OWNER) OWNER = []
  const result = fn();
  OWNER = PREV_OWNER;
  PREV_OWNER = null;
  return result
}
export class FS<T = unknown> {
  #r: Array<FS> = OWNER!;
  #id: number = 0;
  #sources: number = 0;
  #val: T | undefined
  #fn: (() => T) | null = null;
  #dirty = true;
  #effect: boolean = false;
  constructor(val: T | (() => T), effect?: boolean) {
    if (typeof val === "function") {
      this.#fn = val as () => T;
      this.#r.push(this)
      if (effect) {
        this.#effect = effect;
        EFFECT_QUEUE.push(this)
      }
    } else {
      this.#val = val;
      this.#id = I++;
      if (this.#id > 32) throw new Error()
    }
  }

  get val(): T {
    if (this.#fn && this.#dirty) {
      let started = false;
      if (A === null) {
        A = 0;
        started = true
      }
      this.#sources = 0;
      this.#val = this.#fn();
      this.#dirty = false;
      this.#sources |= A;
      if (started) A = null;
    } else if (A !== null) A |= 1 << this.#id
    return this.#val as T
  }

  set val(val: T | null) {
    if (val === this.#val) return;
    const mask = 1 << this.#id;
    this.#fn = null;
    for (const item of this.#r) {
      if ((item.#sources & mask) !== 0) {
        item.#dirty = true;
        if (item.#effect) EFFECT_QUEUE.push(item);
      }
    }
    this.#val = val as T;
  }
}

export function tick() {
  for (const el of EFFECT_QUEUE) el.val
  EFFECT_QUEUE = []
}

export function queueTick() {
  if (!QUEUED) {
    QUEUED = true;
    queueMicrotask(() => (tick(), QUEUED = false));
  }
}

export function signal<T = unknown>(val: T | (() => T), effect?: boolean) {
  return new FS(val, effect)
}