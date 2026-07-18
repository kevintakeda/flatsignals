/** biome-ignore-all lint/style/noNonNullAssertion: guaranteed */

let BATCHING = false,
	UNTRACK = false,
	ROOT: FlatRoot | null = null,
	COMPUTED: FlatCompute | null = null,
	ROOT_QUEUE: Array<FlatRoot> | null = null,
	SCOPE: Array<FlatRoot> | null = null;

export class FlatRoot {
	/** @internal computeds */
	_c: Array<FlatCompute> = [];
	/** @internal id generator */
	_i = 0;
	/** @internal batch mask */
	#batch: number = 0;

	constructor(public autoFlush = true) {
		SCOPE?.push(this);
	}

	dispose() {
		const items = this._c;
		this._c = [];
		items.forEach((el) => {
			el.dispose(false);
		});
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
		const last = this._c.pop();
		if (!last) return;
		this._c[idx] = last;
		last._i = idx;
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

		for (const item of this._c) {
			if (item._s & currentBatch) {
				item._x = true;
				if (item._e) item.get();
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
		if (effect) {
			this._e = effect;
			this.get();
		}
	}

	get(): T {
		const prevCurrent = COMPUTED;
		if (this._x) {
			if (this._e) (this.#val as (() => void) | undefined)?.();
			COMPUTED = this as FlatCompute<unknown>;
			this._s = 0;
			this.#val = runWithRoot(() => this.#fn!(), this.#root);
			this._x = false;
			COMPUTED = prevCurrent;
		}
		if (prevCurrent && !UNTRACK) {
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

	dispose(detach: boolean = true) {
		if (this._d) return;
		if (this._e) (this.#val as (() => void) | undefined)?.();
		this._s = 0;
		this._x = false;
		this._d = true;
		if (detach) this.#root._d(this._i);
	}
}

export function batch(fn: () => void) {
	if (BATCHING) return fn();
	ROOT_QUEUE = [];
	BATCHING = true;
	fn();
	ROOT_QUEUE.forEach((R) => {
		if (R.autoFlush) R.flush();
	});
	ROOT_QUEUE = null;
	BATCHING = false;
}

export function runWithRoot<T>(fn: () => T, root: FlatRoot): T {
	const prevRoot = ROOT;
	ROOT = root;
	const result = fn();
	ROOT = prevRoot;
	return result;
}

export function scoped<T>(fn: () => T, scope: Array<FlatRoot>): T {
	const prev = SCOPE;
	SCOPE = scope;
	const result = fn();
	SCOPE = prev;
	return result;
}

export function untrack<T>(fn: () => T): T {
	const prev = UNTRACK;
	UNTRACK = true;
	const result = fn();
	UNTRACK = prev;
	return result;
}

export function link<T>(reader: FlatCompute<T> | FlatSignal<T>) {
	const s = signal(reader.peek);
	runWithRoot(() => {
		effect(() => {
			s.set(reader.get());
		});
	}, reader.root);
	return s;
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
	return sig.dispose.bind(sig, true);
}
