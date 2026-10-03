/** biome-ignore-all lint/style/noNonNullAssertion: guaranteed */

let BATCHING = false,
	UNTRACK = false,
	PASS = 0,
	ROOT: FlatRoot | null = null,
	COMPUTED: FlatCompute | null = null,
	ROOT_QUEUE: Array<FlatRoot> | null = null;

export class FlatRoot {
	/** @internal computeds */
	_c: Array<FlatCompute> = [];
	/** @internal id generator */
	_i = 0;
	/** @internal batch mask */
	#batch: number = 0;

	constructor(public autoFlush = true) {
		const owner = COMPUTED;
		if (owner) {
			owner._k ??= [];
			owner._k.push(this);
		}
	}

	dispose() {
		while (this._c.length) this._c[0].dispose();
	}

	/** @internal Add source */
	_s() {
		return this._i++ % 32;
	}

	/** @internal Add computed */
	_a(c: FlatCompute) {
		return this._c.push(c) - 1;
	}

	/** @internal Destroy computed */
	_d(idx: number) {
		const items = this._c;
		const last = items.pop();
		if (!last) return;
		if (idx < items.length) {
			items[idx] = last;
			last._i = idx;
		}
	}

	/** @internal queue */
	_q(mask: number) {
		if (BATCHING && !this.#batch) {
			ROOT_QUEUE?.push(this);
		}
		this.#batch |= mask;

		if (this.autoFlush && !BATCHING) this.flush();
	}

	flush() {
		if (!this.#batch) return;
		const currentBatch = this.#batch;
		this.#batch = 0;
		PASS++;

		for (const item of this._c) {
			if (item._s & currentBatch) {
				item._x = true;
				if (item._e && item._p < PASS) item.get();
			}
		}
	}
}

export class FlatSignal<T = undefined> {
	#root: FlatRoot;
	#val: T;
	#id = 0;

	constructor(val?: T) {
		if (!ROOT) ROOT = new FlatRoot();
		this.#root = ROOT;
		this.#val = val as T;
		this.#id |= 1 << this.#root._s();
	}

	get(): T {
		if (COMPUTED && COMPUTED.root === this.#root && !UNTRACK) {
			COMPUTED._s |= this.#id;
		}
		return this.#val as T;
	}

	get peek() {
		return this.#val;
	}

	get root() {
		return this.#root;
	}

	set(val: T) {
		if (this.#val === val) return;
		this.#val = val as T;
		this.#root._q(this.#id);
	}
}

export class FlatCompute<T = unknown> {
	#root: FlatRoot;
	#val: T;
	#fn: (() => T) | undefined;
	/** @internal effect */
	_e = false;
	/** @internal sources */
	_s = 0;
	/** @internal dirty */
	_x = true;
	/** @internal disposed */
	_d = false;
	/** @internal index */
	_i!: number;
	/** @internal owned computes and roots */
	_k: Array<FlatCompute | FlatRoot> | null = null;
	/** @internal last run pass */
	_p = 0;

	constructor(
		// biome-ignore lint/suspicious/noConfusingVoidType: void is necessary here
		compute?: () => (() => void) | void,
		val?: undefined,
		effect?: true,
	);
	constructor(compute?: () => T);
	constructor(compute?: () => T, val?: T);
	constructor(compute?: () => T, val?: T, effect?: boolean) {
		if (!ROOT) ROOT = new FlatRoot();
		this.#root = ROOT;
		this.#fn = compute;
		this.#val = val!;
		this._i = this.#root._a(this as FlatCompute<unknown>);
		const owner = COMPUTED;
		if (owner) {
			owner._k ??= [];
			owner._k.push(this as FlatCompute<unknown>);
		}
		if (effect) {
			this._e = effect;
			this._p = PASS;
			this.get();
		}
	}

	get(): T {
		const prevCurrent = COMPUTED;
		if (this._x) {
			// disposes whatever the previous run of this node owned
			this.#d();
			if (this._e) (this.#val as (() => void) | undefined)?.();
			COMPUTED = this as FlatCompute<unknown>;
			this._s = 0;
			this.#val = runWithRoot(() => this.#fn!(), this.#root);
			this._x = false;
			COMPUTED = prevCurrent;
		}
		if (prevCurrent && !UNTRACK && !this._e) {
			prevCurrent._s |= this._s;
		}
		return this.#val!;
	}

	get peek() {
		return this.#val;
	}

	get root() {
		return this.#root;
	}

	dispose() {
		if (this._d) return;
		this.#d();
		if (this._e) (this.#val as (() => void) | undefined)?.();
		this._s = 0;
		this._x = false;
		this._d = true;
		this.#root._d(this._i);
	}

	/** @internal dispose owned */
	#d() {
		const owned = this._k;
		if (owned) {
			this._k = null;
			owned.forEach((el) => {
				el.dispose();
			});
		}
	}
}

export function batch(fn: () => void) {
	if (BATCHING) return fn();
	ROOT_QUEUE = [];
	BATCHING = true;
	fn();
	BATCHING = false;
	ROOT_QUEUE.forEach((R) => {
		if (R.autoFlush) R.flush();
	});
	ROOT_QUEUE = null;
}

export function runWithRoot<T>(fn: () => T, root: FlatRoot): T {
	const prevRoot = ROOT;
	ROOT = root;
	const result = fn();
	ROOT = prevRoot;
	return result;
}

export function untrack<T>(fn: () => T): T {
	const prev = UNTRACK;
	UNTRACK = true;
	const result = fn();
	UNTRACK = prev;
	return result;
}

export function getRoot() {
	return ROOT;
}

export function signal<T>(value: T): FlatSignal<T>;
export function signal<T = undefined>(): FlatSignal<T | undefined>;
export function signal<T>(value?: T): FlatSignal<T> {
	return new FlatSignal(value);
}

export function computed<T>(val: () => T): FlatCompute<T> {
	return new FlatCompute(val);
}

// biome-ignore lint/suspicious/noConfusingVoidType: void is necessary here
export function effect(fn: () => void | (() => void)): () => void {
	const sig = new FlatCompute(fn, undefined, true);
	return sig.dispose.bind(sig);
}
