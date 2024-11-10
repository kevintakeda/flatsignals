let ROOT: Root | null = null,
  COMPUTED: Computation | null = null,
  EFFECT_QUEUE: Array<Computation> = [],
  SPARK_QUEUE: Array<Spark> = [],
  QUEUED = false,
  SCHEDULER: (() => void) | undefined;

export interface StandaloneEffect<T> {
  (val: T): ((val: T) => void) | T
}

export interface DataSignal<T = unknown> {
  val: T,
  readonly peek: T | undefined,
  on: (fn: StandaloneEffect<T>) => (() => void)
};
export interface Computed<T = unknown> {
  readonly val: T,
  readonly peek: T | undefined,
  on: (fn: StandaloneEffect<T>) => (() => void)
};
export interface Channel<T = unknown> extends DataSignal<T> { };

interface Spark<T = unknown> {
  /* @internal */
  _ref: Computation,
  /* @internal */
  _fn: (val: T) => ((val: T) => void) | T,
  /* @internal cleanup */
  _cleanup: ((val: T) => void) | null,
  /* @internal executing */
  _executing: boolean,
};

export class Scope {
  /* @internal */
  #children: Array<Scope> = [];
  /* @internal */
  #disposals: Array<((...a: any[]) => void)> = [];
  /* @internal */
  #isDisposing: boolean = false;
  /* @internal */
  _add(scope: Scope): void {
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
  _tracking: Array<Computation> = [];
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
    if (this._i > 31) throw new Error()
    return 1 << this._i++
  }
}

export class Computation<T = unknown> extends Scope {
  #root: Root;
  #id: number;
  #sources: number = 0;
  #val: T;
  #fn: (() => T) | undefined;
  #tick: (() => void) | undefined = SCHEDULER;
  #isDirty = true;
  #isEffect: boolean = false;
  #sparks: Array<Spark> | undefined;
  equals = defaultEquality;

  constructor(compute?: () => T, val?: T, effect?: boolean) {
    super();
    if (!ROOT) ROOT = new Root()
    this.#root = ROOT;
    if (compute) {
      this.#fn = compute;
      this.#id = this.#root._computeds.push(this as Computation<unknown>) - 1;
      if (effect) {
        this.#isEffect = effect;
        EFFECT_QUEUE.push(this as Computation<unknown>);
      }
      this.#val = undefined as any;
      if (COMPUTED) COMPUTED._add(this)
    } else {
      this.#val = val as T;
      this.#id = this.#root._id();
    }
  }

  #update() {
    const root = this.#root, prevCurrent = COMPUTED;
    if (this.#isDirty) {
      super._dispose();
      COMPUTED = this as Computation<unknown>;
      root._tracking.push(this as Computation<unknown>);
      this.#sources = 0;
      this.#val = this.#fn!();
      this.#isDirty = false;
      COMPUTED = prevCurrent;
      root._tracking.pop();
    }
    if (prevCurrent) {
      prevCurrent.#sources |= this.#sources;
    }
  }

  get val(): T {
    if (this.#fn) {
      this.#update();
    } else for (const el of this.#root._tracking) {
      el.#sources |= this.#id
    }
    return this.#val as T
  }

  set val(val: T) {
    if (this.equals(val, this.#val)) return;
    this.#emit();
    for (const item of this.#root._computeds) {
      if (!item.#isDirty && (item.#sources & this.#id) !== 0) {
        item.#emit();
        item.#isDirty = true;
        if (item.#isEffect) {
          EFFECT_QUEUE.push(item);
          this.#tick?.();
        }
      }
    }
    this.#val = val as T;
    this.#emit();
  }

  get peek() {
    return this.#val
  }

  #emit() {
    if (this.#sparks) for (const spark of this.#sparks) {
      if (!spark._executing) {
        SPARK_QUEUE.push(spark)
        spark._executing = true;
      }
    }
  }

  on(_fn: StandaloneEffect<T>) {
    if (!this.#sparks) this.#sparks = [];
    const spark: Spark<T> = { _ref: this as Computation<unknown>, _fn, _executing: true, _cleanup: null };
    this.#sparks.push(spark as Spark<unknown>)
    SPARK_QUEUE.push(spark as Spark<unknown>)
    return () => this.#unsubscribe.bind(this)(spark as Spark<unknown>)
  }

  #unsubscribe(spark: Spark) {
    if (this.#sparks) {
      const idx = this.#sparks.indexOf(spark);
      if (idx !== -1) {
        this.#sparks[idx]._cleanup?.(this.val);
        this.#sparks.slice(idx, 1)
      }
    }
  }

  /* @internal */
  _dispose(detach = false) {
    super._dispose();
    if (detach && this.#fn) {
      const arr = this.#root._computeds, last = arr.length - 1;
      [arr[this.#id], arr[last]] = [arr[last], arr[this.#id]];
      arr[last].#id = this.#id;
      arr.pop();
    }
    this.#sparks = undefined;
    this.#fn = undefined;
    this.#sources = 0;
    this.#isDirty = false;
  }

  /* @internal */
  _getRoot() {
    return this.#root
  }
}

function defaultEquality(a: unknown, b: unknown) {
  return a === b
}

export function tick() {
  if (SPARK_QUEUE.length) {
    for (const el of SPARK_QUEUE) {
      el._cleanup?.(el._ref.val);
      const output = el._fn(el._ref.val);
      if (output) el._cleanup;
      el._executing = false;
    };
    SPARK_QUEUE = [];
  }
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

export function withScope(fn: () => void, scope: Scope) {
  if (scope instanceof Root) {
    root(fn, scope)
  } else if (scope) {
    const prevComputed = COMPUTED;
    COMPUTED = scope as Computation;
    fn();
    COMPUTED = prevComputed;
  }
}

export function autoTick(fn = queueTick) {
  SCHEDULER = fn;
}

export function channel<T>(outer: DataSignal<T> | Computed<T>): Channel<T> {
  if (!(outer instanceof Computation)) throw new Error();
  const inner = new Computation<T>(undefined, outer.peek);
  inner._addDisposal(outer.on((val) => inner.val = val));
  return Object.assign(inner, {
    set val(v: T) {
      outer.val = v;
    }
  });
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