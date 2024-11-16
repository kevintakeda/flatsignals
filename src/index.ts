let ROOT_QUEUE: Array<Root> = [],
  ROOT: Root | null = null,
  COMPUTED: Computation | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  QUEUED = false;

export class Scope {
  /* @internal */
  _disposing = false;
  /* @internal */
  _disposals: ((() => void)[] | null) = null;

  constructor() {
    getScope()?._onDispose(this._dispose.bind(this));
  }

  /* @internal */
  _dispose() {
    if (this._disposing) return;
    this._disposing = true;
    this._disposals?.forEach(fn => fn())
    this._disposing = false;
  }

  /* @internal */
  _onDispose(fn: (() => void)) {
    if (!this._disposals) this._disposals = [];
    this._disposals.push(fn);
  }
}

export class Root extends Scope {
  /* @internal computeds */
  _c: Array<Computation> = [];
  /* @internal disposed computeds */
  _x: Array<number> = [];
  /* @internal */
  _i = 0;
  #batch1: number = 0;
  #batch2: number = 0;

  /* @internal */
  _dispose() {
    super._dispose();
    this._c = [];
    this._x = [];
    this._i = 0;
  }

  /* @internal Add source */
  _as() {
    if (this._i >= 64) throw new Error("root max: 64 signals")
    return this._i++
  }

  /* @internal Add computed */
  _ac(c: Computation) {
    if (this._x.length) {
      const u = this._x.pop()!;
      this._c[u] = c;
      return u
    } else {
      return this._c.push(c) - 1;
    }
  }

  /* @internal Destroy computed */
  _dc(idx: number) {
    this._x.push(idx)
  }

  /* @internal */
  _queue(mask1: number, mask2: number) {
    if (!this.#batch1 && !this.#batch2) ROOT_QUEUE.push(this);
    this.#batch1 |= mask1;
    this.#batch2 |= mask2;
  }

  /* @internal */
  _flush() {
    if (!this.#batch1 && !this.#batch2) return;
    for (const item of this._c) {
      if (!item._dirty && ((item._sources1 & this.#batch1) !== 0 || (item._sources2 & this.#batch2) !== 0)) {
        item._dirty = true;
        if (item._effect) {
          EFFECT_QUEUE.push(item);
          flushQueue();
        }
      }
    }
    this.#batch1 = 0;
    this.#batch2 = 0;
  }
}

export class DataSignal<T = any> {
  #root: Root;
  #val: T;
  #id1 = 0;
  #id2 = 0;
  equals = defaultEquality;

  constructor(val?: T) {
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    this.#val = val as T;
    const id = this.#root._as();
    if (id < 32) {
      this.#id1 |= (1 << id);
    } else {
      this.#id2 |= (1 << (id - 32));
    }
  }

  get val(): T {
    if (COMPUTED) {
      COMPUTED._sources2 |= this.#id2
      COMPUTED._sources1 |= this.#id1
    }
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    this.#val = val as T;
    this.#root._queue(this.#id1, this.#id2);
  }

  get peek() {
    return this.#val
  }

  update(fn: (prev: T) => T) {
    // peek.
    this.val = fn(this.#val)
  }
}

export class Computation<T = unknown> extends Scope {
  #root: Root;
  #id: number;
  #val: T;
  #fn: (() => T) | undefined;
  /* @internal */
  _effect: boolean = false;
  /* @internal */
  _sources1: number = 0;
  /* @internal */
  _sources2: number = 0;
  /* @internal */
  _dirty = true;
  /* @internal destroyed */
  _d = false;

  constructor(compute?: () => T, val?: T, effect?: boolean) {
    if (!ROOT) ROOT = new Root();
    super();
    this.#root = ROOT;
    this.#fn = compute;
    this.#val = val!;
    this.#id = this.#root._ac(this as Computation<unknown>);
    if (effect) {
      this._effect = effect;
      EFFECT_QUEUE.push(this as Computation<unknown>);
    }
  }

  get val(): T {
    this.#root._flush();
    const prevCurrent = COMPUTED;
    if (this._dirty) {
      super._dispose();
      COMPUTED = this as Computation<unknown>;
      this._sources1 = 0;
      this._sources2 = 0;
      this.#val = this.#fn!();
      this._dirty = false;
      COMPUTED = prevCurrent;
    }
    if (prevCurrent) {
      prevCurrent._sources1 |= this._sources1;
      prevCurrent._sources2 |= this._sources2;
    }
    return this.#val!
  }

  get peek() {
    return this.#val
  }

  getRoot() {
    return this.#root
  }

  /* @internal */
  _dispose() {
    if (this._d) return;
    super._dispose();
    this._sources1 = 0;
    this._sources2 = 0;
    this._dirty = false;
    this._d = true;
    this.#root._dc(this.#id);
  }
}

function defaultEquality(a: unknown, b: unknown) {
  return a === b
}

export function flushSync() {
  if (ROOT_QUEUE.length) {
    for (const el of ROOT_QUEUE) el._flush();
    ROOT_QUEUE = [];
  }
  if (EFFECT_QUEUE.length) {
    for (const el of EFFECT_QUEUE) el.val;
    EFFECT_QUEUE = [];
  }
}

export function flushQueue() {
  if (!QUEUED) {
    QUEUED = true;
    queueMicrotask(() => (flushSync(), QUEUED = false));
  }
}

export function getScope(): Scope | null {
  return COMPUTED || ROOT
}

export function withScope(scope: Scope, fn: () => void) {
  const prevComputed = COMPUTED, prevRoot = ROOT;
  if (scope instanceof Computation) COMPUTED = scope as Computation;
  ROOT = COMPUTED?.getRoot() ?? ROOT;
  const result = fn();
  COMPUTED = prevComputed;
  ROOT = prevRoot;
  return result
}

export function onDispose(fn: (() => void)) {
  getScope()?._onDispose(fn)
}

export function root<T>(fn: (dispose: () => void) => T, existingRoot?: Root) {
  const prevRoot = ROOT;
  const prevScope = getScope();
  ROOT = existingRoot ?? new Root();
  prevScope?._onDispose(ROOT._dispose.bind(ROOT));
  const result = fn(ROOT._dispose.bind(ROOT));
  ROOT = prevRoot;
  return result
}

export function signal<T>(value: T): DataSignal<T>;
export function signal<T = undefined>(): DataSignal<T | undefined>;
export function signal<T>(value?: T): DataSignal<T> {
  return new DataSignal(value);
}

export function computed<T>(val: (() => T)): Computation<T> {
  return new Computation(val);
}

export function effect<T = unknown>(fn: (() => T)) {
  const sig = new Computation(fn, undefined, true);
  return sig._dispose.bind(sig);
}