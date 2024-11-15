let ROOT: Root | null = null,
  COMPUTED: Computation | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  QUEUED = false,
  BATCH: number | null = null,
  BATCH_ROOT: Root | null = null;

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
  /* @internal */
  _computeds: Array<Computation> = [];
  /* @internal */
  _i = 0;

  /* @internal */
  _dispose() {
    super._dispose();
    for (const el of this._computeds) el._dispose();
    this._computeds = [];
    this._i = 0;
  }
  /* @internal */
  _id() {
    if (this._i > 31) throw new Error("root max: 32 signals")
    return 1 << this._i++
  }

  /* @internal */
  _batch(signature: number) {
    for (const item of this._computeds) {
      if (!item._dirty && (item._sources & signature) !== 0) {
        item._dirty = true;
        if (item._effect) {
          EFFECT_QUEUE.push(item);
          flushQueue();
        }
      }
    }
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
    this.#id = this.#root._id();
  }

  get val(): T {
    if (COMPUTED) COMPUTED._sources |= this.#id
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    this.#val = val as T;
    if (BATCH === null) {
      this.#root._batch(this.#id)
    } else {
      BATCH_ROOT = this.#root;
      BATCH |= this.#id;
    }
  }
  get peek() {
    return this.#val
  }
}

export class Computation<T = unknown> extends Scope {
  #root: Root;
  #val: T;
  #fn: (() => T) | undefined;
  /* @internal */
  _effect: boolean = false;
  /* @internal */
  _sources: number = 0;
  /* @internal */
  _dirty = true;

  constructor(compute?: () => T, val?: T, effect?: boolean) {
    super();
    if (!ROOT) ROOT = new Root();
    this.#root = ROOT;
    this.#fn = compute;
    this.#val = val!;
    this.#root._computeds.push(this as Computation<unknown>);
    if (effect) {
      this._effect = effect;
      EFFECT_QUEUE.push(this as Computation<unknown>);
    }
    if (COMPUTED) {
      COMPUTED._onDispose(this._dispose.bind(this))
    }
  }

  get val(): T {
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
    super._dispose();
    this._sources = 0;
    this._dirty = false;
  }
}

function defaultEquality(a: unknown, b: unknown) {
  return a === b
}

export function flushSync() {
  if (EFFECT_QUEUE.length) {
    for (const el of EFFECT_QUEUE) el.val
    EFFECT_QUEUE = []
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

export function batch(fn: () => void) {
  BATCH = 0;
  fn();
  BATCH_ROOT?._batch(BATCH);
  BATCH_ROOT = null;
  BATCH = null;
}