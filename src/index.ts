let PREV_ROOT: Root | null = null,
  ROOT: Root | null = null,
  EFFECT_QUEUE: Array<FlatSignal> = [],
  QUEUED = false,
  SCHEDULER: (() => void) | undefined;

class Root {
  computeds: Array<FlatSignal> = [];
  disposals: Array<() => void> = [];
  children: Array<Root> = [];
  i = 0;

  tracking: Array<FlatSignal> = [];
  current: FlatSignal | null = null;

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

export class FlatSignal<T = unknown> {
  #root: Root = ROOT ?? new Root();
  #id: number = 1;
  #sources: number = 0;
  #val: T | undefined | null;
  #fn: (() => T) | null = null;
  #tick: (() => void) | undefined = SCHEDULER;
  #isDirty = true;
  #isEffect: boolean = false;
  onDispose: (() => void) | null = null;
  equals = (a: unknown, b: unknown) => a === b;

  constructor(val?: T | (() => T), effect?: boolean) {
    if (typeof val === "function") {
      this.#fn = val as () => T;
      this.#root.computeds.push(this);
      if (effect) {
        this.#isEffect = effect;
        EFFECT_QUEUE.push(this)
      }
    } else {
      this.#val = val;
      this.#id = 1 << this.#root.i++;
    }
  }

  get val(): T {
    if (this.#fn) {
      const prevCurrent = this.#root.current;
      if (this.#isDirty) {
        this.#root.current = this;
        this.#root.tracking.push(this);

        this.#sources = 0;
        this.#val = this.#fn();
        this.#isDirty = false;

        this.#root.current = prevCurrent;
        this.#root.tracking.pop();
      } else if (prevCurrent)
        prevCurrent.#sources |= this.#id
    } else {
      for (const el of this.#root.tracking) {
        el.#sources |= this.#id
      }
    }
    return this.#val as T
  }

  set val(val: T | null) {
    if (this.#fn) return;
    if (this.equals(val, this.#val)) return;
    for (const item of this.#root.computeds) {
      if ((item.#sources & this.#id) !== 0 && !item.#isDirty) {
        item.#isDirty = true;
        if (item.#isEffect) {
          EFFECT_QUEUE.push(item);
          this.#tick?.();
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

  dispose(removeFromRoot = true) {
    this.onDispose?.();
    if (removeFromRoot && this.#fn) {
      this.#disconnect();
    }
    this.onDispose = null;
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
  const current = ROOT?.current;
  if (current && !current.onDispose) {
    current.onDispose = fn;
  } else {
    ROOT?.disposals.push(fn);
  }
}

export function autoTick(fn = queueTick) {
  SCHEDULER = fn;
}

export function signal<T = unknown>(val?: T | (() => T)) {
  return new FlatSignal(val)
}

export function effect<T = unknown>(fn: (() => T)) {
  return new FlatSignal(fn, true)
}