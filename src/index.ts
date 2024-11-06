let ROOT: Root | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  QUEUED = false,
  SCHEDULER: (() => void) | undefined,
  TRACKING = true;

export interface DataSignal<T = unknown> {
  val: T
};

export interface Channel<T = unknown> {
  val: T
};

export interface Computed<T = unknown> {
  readonly val: T
};

export class Root {
  /* @internal */
  _computeds: Array<Computation> = [];
  /* @internal */
  _disposals: Array<((...a: any[]) => void)> = [];
  /* @internal */
  _children: Array<Root> = [];
  /* @internal */
  _i = 0;

  /* @internal */
  _tracking: Array<Computation> = [];
  /* @internal */
  _current: Computation | null = null;
  /* @internal */
  _disposing: boolean = false;

  /* @internal */
  _dispose() {
    if (this._disposing) return;
    this._disposing = true;
    for (const el of this._disposals) el();
    for (const el of this._computeds) el._dispose();
    for (const el of this._children) el._dispose();
    this._children = [];
    this._computeds = [];
    this._disposals = [];
    this._i = 0;
  }
  /* @internal */
  _id() {
    if (this._i > 31) throw new Error()
    return 1 << this._i++
  }
}

export function root<T>(fn: (dispose: () => void) => T) {
  const prev = ROOT;
  ROOT = new Root();
  if (prev) prev._children.push(ROOT);
  const result = fn(ROOT._dispose.bind(ROOT));
  ROOT = prev;
  return result
}

export class Computation<T = unknown> {
  #root: Root;
  #id: number;
  #sources: number = 0;
  #val: T;
  #fn: (() => T) | undefined;
  #tick: (() => void) | undefined = SCHEDULER;
  #isDirty = true;
  #isEffect: boolean = false;
  #disposals: ((prevValue: T) => void)[] = [];
  equals = (a: unknown, b: unknown) => a === b;

  constructor(compute?: () => T, val?: T, effect?: boolean) {
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    if (compute !== undefined) {
      this.#fn = compute;
      this.#id = this.#root._computeds.push(this as Computation<unknown>) - 1;
      if (effect) {
        this.#isEffect = effect;
        EFFECT_QUEUE.push(this as Computation<unknown>);
      }
      this.#val = undefined as any;
    } else {
      this.#val = val as T;
      this.#id = this.#root._id();
    }
  }

  #cleanup() {
    for (const fn of this.#disposals) fn(this.#val);
    this.#disposals = [];
  }

  #update() {
    const root = this.#root, prevCurrent = root._current;
    if (this.#isDirty) {
      if (this.#disposals.length) this.#cleanup();
      if (TRACKING) {
        root._current = this as Computation<unknown>;
        root._tracking.push(this as Computation<unknown>);
        this.#sources = 0;
      }
      this.#val = this.#fn!();
      this.#isDirty = false;
      if (TRACKING) {
        root._current = prevCurrent;
        root._tracking.pop();
      }
    }
    if (prevCurrent && TRACKING) {
      prevCurrent.#sources |= this.#sources;
    }
  }

  get val(): T {
    if (this.#fn) {
      this.#update();
    } else if (TRACKING) for (const el of this.#root._tracking) {
      el.#sources |= this.#id
    }
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    for (const item of this.#root._computeds) {
      if (!item.#isDirty && (item.#sources & this.#id) !== 0) {
        item.#isDirty = true;
        if (item.#isEffect) {
          EFFECT_QUEUE.push(item);
          this.#tick?.();
        }
      }
    }
    this.#val = val as T;
  }

  /* @internal */
  _addDisposal(fn: (prevValue: T) => void) {
    this.#disposals.push(fn);
  }

  /* @internal */
  _dispose() {
    this.#cleanup();
    this.#fn = undefined;
    this.#sources = 0;
    this.#isDirty = true;
  }

  /* @internal */
  _getRoot() {
    return this.#root
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
  (ROOT?._current ?? ROOT)?._dispose();
}

export function onDispose<T = unknown>(fn: ((prevValue: T) => void)) {
  const current = ROOT?._current;
  if (current) {
    current._addDisposal(fn as ((prevValue: unknown) => void));
  } else if (fn) {
    ROOT?._disposals.push(fn);
  }
}

export function autoTick(fn = queueTick) {
  SCHEDULER = fn;
}

export function withRoot<T>(root: Root, fn: () => T) {
  const prev = ROOT;
  ROOT = root;
  const x = fn();
  ROOT = prev;
  return x;
}

export function channel<T>(outer: DataSignal<T> | Computed<T> | Computed): Channel {
  if (!(outer instanceof Computation)) throw new Error();
  let updating = false;
  const inner = new Computation<T>(undefined, outer.val);
  const outerEffect = withRoot(outer._getRoot(), () => effect(() => {
    if (!updating) inner.val = outer.val
    return outer.val;
  }));
  inner._addDisposal(outerEffect.bind(outerEffect));
  return {
    get val() {
      return inner.val;
    },
    set val(v) {
      updating = true
      outer.val = v;
    }
  };
}

export function signal<T = unknown>(val?: T): DataSignal<T> {
  return new Computation(undefined, val);
}

export function computed<T = unknown>(val: (() => T)): Computed<T> {
  return new Computation(val, undefined, false);
}

export function effect<T = unknown>(fn: (() => T)) {
  const sig = new Computation(fn, undefined, true);
  return sig._dispose.bind(sig);
}

export function untrack<T = unknown>(fn: (() => T)) {
  const prev = TRACKING;
  TRACKING = false;
  const x = fn();
  TRACKING = prev;
  return x;
}