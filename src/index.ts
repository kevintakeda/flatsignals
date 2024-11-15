let ROOT_QUEUE: Array<Root> = [],
  ROOT: Root | null = null,
  COMPUTED: Computation | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  QUEUED = false;

export class Scope {
  /* @internal */
  _active = false;
  /* @internal */
  _disposals: ((() => void)[] | null) = null;
  /* @internal */
  _dispose() {
    if (this._active) return;
    this._active = true;
    this._disposals?.forEach(fn => fn())
    this._active = false;
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
  /* @internal */
  #batch: number = 0;

  /* @internal */
  _dispose() {
    super._dispose();
    for (const el of this._c) el._dispose();
    this._c = [];
    this._x = [];
    this._i = 0;
  }
  /* @internal Add source */
  _as() {
    if (this._i > 31) throw new Error("root max: 32 signals")
    return 1 << this._i++
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
  _queue(mask: number) {
    if (!this.#batch) ROOT_QUEUE.push(this);
    this.#batch |= mask;
  }

  /* @internal */
  _flush() {
    if (!this.#batch) return;
    for (const item of this._c) {
      if (!item._dirty && (item._sources & this.#batch) !== 0) {
        item._dirty = true;
        if (item._effect) {
          EFFECT_QUEUE.push(item);
          flushQueue();
        }
      }
    }
    this.#batch = 0;
  }
}

export class DataSignal<T = any> {
  #root: Root;
  #val: T;
  #id;
  equals = defaultEquality;

  constructor(val?: T) {
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    this.#val = val as T;
    this.#id = this.#root._as();
  }

  get val(): T {
    if (COMPUTED) COMPUTED._sources |= this.#id
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    this.#val = val as T;
    this.#root._queue(this.#id);
  }
  get peek() {
    return this.#val
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
  _sources: number = 0;
  /* @internal */
  _dirty = true;
  /* @internal destroyed */
  _d = false;

  constructor(compute?: () => T, val?: T, effect?: boolean) {
    super();
    if (!ROOT) ROOT = new Root();
    this.#root = ROOT;
    this.#fn = compute;
    this.#val = val!;
    this.#id = this.#root._ac(this as Computation<unknown>);
    if (effect) {
      this._effect = effect;
      EFFECT_QUEUE.push(this as Computation<unknown>);
    }
    if (COMPUTED) COMPUTED._onDispose(this._dispose.bind(this));
  }

  get val(): T {
    this.#root._flush();
    const prevCurrent = COMPUTED;
    if (this._dirty) {
      super._dispose();
      COMPUTED = this as Computation<unknown>;
      this._sources = 0;
      this.#val = this.#fn!();
      this._dirty = false;
      COMPUTED = prevCurrent;
    }
    if (prevCurrent) prevCurrent._sources |= this._sources;
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
    this._sources = 0;
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

export function signal<T = unknown>(val?: T): DataSignal<T> {
  return new DataSignal(val);
}

export function computed<T = unknown>(val: (() => T)): Computation<T> {
  return new Computation(val);
}

export function effect<T = unknown>(fn: (() => T)) {
  const sig = new Computation(fn, undefined, true);
  return sig._dispose.bind(sig);
}