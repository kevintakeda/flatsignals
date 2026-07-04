/** biome-ignore-all lint/style/noNonNullAssertion: guaranteed */

let ROOT: FlatRoot | null = null,
	COMPUTED: FlatCompute | null = null,
	BATCHING = false,
	ROOT_QUEUE: FlatRoot | null = null;

export class FlatRoot {
	/** @internal computeds */
	_c: Array<FlatCompute> = [];
	/** @internal id generator */
	_i = 0;
	/** @internal batch mask */
	#batch: number = 0;

	constructor(public autoFlush = true) {}

	dispose() {
		this._c = [];
		this._i = 0;
	}

	/** @internal Add source */
	_as() {
		return this._i++ % 32;
	}

	/** @internal Add computed */
	_ac(c: FlatCompute) {
		return this._c.push(c) - 1;
	}

	/** @internal Destroy computed */
	_dc(idx: number) {
		const last = this._c.pop()!;
		if (idx !== this._c.length) {
			this._c[idx] = last;
			last._i = idx;
		}
	}

	/** @internal queue */
	_q(mask: number) {
		if (!this.#batch) {
			ROOT_QUEUE ??= this;
		}
		this.#batch |= mask;
		if (this.autoFlush && !BATCHING) this.flush();
	}

	flush() {
		if (!this.#batch) return;
		for (const item of this._c) {
			if (item._s & this.#batch) {
				item._x = true;
				if (item._e) item.get();
			}
		}
		this.#batch = 0;
	}
}

export class FlatSignal<T = undefined> {
	#root: FlatRoot;
	#val: T;
	#id = 0;
	equals = defaultEquality;

	constructor(val?: T) {
		if (!ROOT) ROOT = new FlatRoot();
		this.#root = ROOT;
		this.#val = val as T;
		this.#id |= 1 << this.#root._as();
	}

	get(): T {
		if (COMPUTED) {
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
		if (this.equals(val, this.#val)) return;
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
		this._i = this.#root._ac(this as FlatCompute<unknown>);
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
			this.#val = this.#fn!();
			this._x = false;
			COMPUTED = prevCurrent;
		}
		if (prevCurrent) {
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
		if (this._e) (this.#val as (() => void) | undefined)?.();
		this._s = 0;
		this._x = false;
		this._d = true;
		this.#root._dc(this._i);
	}
}

function defaultEquality(a: unknown, b: unknown) {
	return a === b;
}

export function batch(fn: () => void) {
	if (BATCHING) return fn();
	BATCHING = true;
	fn();
	if (ROOT_QUEUE?.autoFlush) ROOT_QUEUE?.flush();
	ROOT_QUEUE = null;
	BATCHING = false;
}

export function scoped<T>(fn: () => T, scope?: FlatRoot): T {
	const prevRoot = ROOT;
	ROOT = scope ?? new FlatRoot();
	const result = fn();
	ROOT = prevRoot;
	return result;
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
export function effect(fn: () => void | (() => void)) {
	const sig = new FlatCompute(fn, undefined, true);
	return sig.dispose.bind(sig);
}
