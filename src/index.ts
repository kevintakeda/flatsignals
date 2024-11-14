let ROOT: Root | null = null,
  COMPUTED: Computation | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  QUEUED = false,
  SCHEDULER: (() => void) | undefined;

interface Disposable {
  _dispose(): void;
}

export class Scope implements Disposable {
  /* @internal */
  #children: Array<Disposable> = [];
  /* @internal */
  #disposals: Array<((...a: any[]) => void)> = [];
  /* @internal */
  #isDisposing: boolean = false;

  /* @internal */
  _add(scope: Disposable): void {
    this.#children.push(scope);
  };

  /* @internal */
  _addDisposal(disposal: ((...a: any[]) => void)): void {
    this.#disposals.push(disposal);
  };

  /* @internal */
  _dispose(): void {
    if (this.#isDisposing) return;
    this.#isDisposing = true;
    if (this.#disposals.length) {
      for (const el of this.#disposals) el();
      this.#disposals = [];
    }
    if (this.#children.length) {
      for (const el of this.#children) el._dispose();
      this.#children = [];
    }
    this.#isDisposing = false;
  }
}

export class Root extends Scope {
  /* @internal */
  _computeds: Array<Computation> = [];
  /* @internal */
  _i = 0;
  /* @internal */
  _spy = -1;

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
}

export class DataSignal<T = any> implements Disposable {
  #root: Root;
  #val: T;
  #id;
  equals = defaultEquality;

  constructor(val?: T) {
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    this.#val = val as T;
    this.#id = this.#root._id();
    if (COMPUTED) COMPUTED._add(this)
  }

  get val(): T {
    if (COMPUTED) COMPUTED._sources |= this.#id
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    this.#val = val as T;
    if ((this.#root._spy & this.#id) !== 0) {
      for (const item of this.#root._computeds) {
        if (!item._dirty && (item._sources & this.#id) !== 0) {
          item._dirty = true;
          if (item._effect) {
            EFFECT_QUEUE.push(item);
            SCHEDULER?.();
          }
        }
      }
      this.#root._spy &= ~this.#id;
    }
  }

  /* @internal */
  _dispose() {
    this.#id = -1;
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
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    this.#fn = compute;
    this.#val = val!;
    this.#root._computeds.push(this as Computation<unknown>);
    if (effect) {
      this._effect = effect;
      EFFECT_QUEUE.push(this as Computation<unknown>);
    }
    this.#val = undefined as any;
    if (COMPUTED) COMPUTED._add(this)
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
    if (prevCurrent) {
      prevCurrent._sources |= this._sources;
    }
    this.#root._spy |= this._sources
    return this.#val!
  }

  get peek() {
    return this.#val
  }

  /* @internal */
  _dispose() {
    super._dispose();
    this.#fn = undefined;
    this._sources = 0;
    this._dirty = false;
  }
}

function defaultEquality(a: unknown, b: unknown) {
  return a === b
}

export function tick() {
  if (EFFECT_QUEUE.length) {
    for (const el of EFFECT_QUEUE) el.val
    EFFECT_QUEUE = []
  }
}

export function queueTick() {
  if (!QUEUED) {
    QUEUED = true;
    queueMicrotask(() => (tick(), QUEUED = false));
  }
}

export function getScope(): Scope | null {
  return COMPUTED ?? ROOT
}

export function onDispose<T = unknown>(fn: ((prevValue: T) => void)) {
  getScope()?._addDisposal(fn);
}

export function root<T>(fn: (dispose: () => void) => T, root?: Root) {
  const prevRoot = ROOT;
  const prevScope = getScope();
  ROOT = root ?? new Root();
  prevScope?._add(ROOT);
  const result = fn(ROOT._dispose.bind(ROOT));
  ROOT = prevRoot;
  return result
}

export function autoTick(fn = queueTick) {
  SCHEDULER = fn;
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