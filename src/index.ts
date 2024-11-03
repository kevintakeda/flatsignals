let PREV_ROOT: Root | null = null,
  ROOT: Root | null = null,
  EFFECT_QUEUE: Array<FlatSignal> = [],
  QUEUED = false,
  SCHEDULE: (() => void) | undefined;

class Root {
  computeds: Array<FlatSignal> = [];
  disposals: Array<() => void> = [];
  children: Array<Root> = [];
  accessed: number | null = null;
  i = 0;
  #disposing: boolean = false;
  dispose() {
    if (this.#disposing) return;
    this.#disposing = true;
    for (const el of this.disposals) el();
    for (const el of this.computeds) el.dispose(false);
    for (const el of this.children) el.dispose();
    this.disposals = [];
    this.computeds = [];
    this.children = [];
    this.i = 0;
  }
}

export function root<T>(fn: (dispose: () => void) => T) {
  PREV_ROOT = ROOT;
  ROOT = new Root();
  if (PREV_ROOT) PREV_ROOT.children.push(ROOT);
  const result = fn(ROOT.dispose.bind(ROOT));
  ROOT = PREV_ROOT; PREV_ROOT = null;
  return result
}

const IS_DIRTY = 1 << 31;
const IS_EFFECT = 1 << 30;

export class FlatSignal<T = unknown> {
  #root: Root = ROOT ?? new Root();
  #id: number = 1;
  #sources: number = IS_DIRTY;
  #val: T | undefined | null;
  #fn: (() => T) | null = null;
  equals = (a: unknown, b: unknown) => a === b;
  constructor(val?: T | (() => T), effect?: boolean) {
    if (typeof val === "function") {
      this.#fn = val as () => T;
      this.#root.computeds.push(this) - 1;
      if (effect) {
        this.#sources |= IS_EFFECT;
        EFFECT_QUEUE.push(this)
      }
    } else {
      this.#val = val;
      if (this.#root.i >= 30) throw new Error();
      if (this.#root) this.#id <<= this.#root.i++;
    }
  }

  get val(): T {
    if (this.#fn && (this.#sources & IS_DIRTY) !== 0) {
      let started = false;
      if (this.#root.accessed === null) {
        this.#root.accessed = 0;
        started = true
      }
      this.#val = this.#fn();
      this.#sources = this.#root.accessed | (this.#sources & IS_EFFECT & ~IS_DIRTY);
      if (started && this.#root) {
        this.#root.accessed = null;
      }
    } else if (this.#root.accessed !== null) this.#root.accessed |= this.#id
    return this.#val as T
  }

  set val(val: T | null) {
    if (this.equals(val, this.#val)) return;
    for (const item of this.#root.computeds) {
      if ((item.#sources & this.#id) !== 0 && (item.#sources & IS_DIRTY) === 0) {
        item.#sources |= IS_DIRTY;
        if ((item.#sources & IS_EFFECT) !== 0) {
          EFFECT_QUEUE.push(item);
          SCHEDULE?.();
        }
      }
    }
    this.#val = val as T;
  }

  #disconnect() {
    const last = this.#root.computeds.length;
    [this.#root.computeds[this.#id], this.#root.computeds[last]] = [this.#root.computeds[last], this.#root.computeds[this.#id]];
    this.#root.computeds.pop();
  }

  move() {
    this.#disconnect();
    if (ROOT) this.#root = ROOT;
  }

  dispose(removeFromRoot = true) {
    if (removeFromRoot && this.#fn) {
      this.#disconnect();
    }
    this.#fn = null;
    this.val = null;
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

export function dispose() {
  ROOT?.dispose();
}

export function onDispose(fn: () => void) {
  ROOT?.disposals.push(fn);
}

export function signal<T = unknown>(val?: T | (() => T)) {
  return new FlatSignal(val)
}

export function effect<T = unknown>(val?: T | (() => T)) {
  return new FlatSignal(val, true)
}