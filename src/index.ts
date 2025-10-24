let ROOT: FlatRoot | null = null,
	COMPUTED: FlatCompute | null = null,
	BATCHING = false,
	ROOT_QUEUE: FlatRoot | null = null;

export class FlatRoot {
	/* @internal computeds */
	_c: Array<FlatCompute> = [];
	/* @internal disposed computeds */
	_x: Array<number> = [];
	/* @internal id generator */
	_i = 0;
	/* @internal batch mask */
	#batch: number = 0;

	dispose() {
		this._c = [];
		this._x = [];
		this._i = 0;
	}

	/* @internal Add source */
	_as() {
		return this._i++ % 32;
	}

	/* @internal Add computed */
	_ac(c: FlatCompute) {
		if (this._x.length) {
			const u = this._x.pop()!;
			this._c[u] = c;
			return u;
		} else {
			return this._c.push(c) - 1;
		}
	}

	/* @internal Destroy computed */
	_dc(idx: number) {
		this._x.push(idx);
	}

	/* @internal */
	_queue(mask: number) {
		if (!this.#batch) {
			ROOT_QUEUE ??= this;
		}
		this.#batch |= mask;
		if (!BATCHING) this._flush(true);
	}

	/* @internal */
	_flush(force: boolean = false) {
		if (!this.#batch || !force) return;
		for (const item of this._c) {
			if (!item._dirty && (item._sources & this.#batch) !== 0) {
				item._dirty = true;
				if (item._effect) item.val;
			}
		}
		this.#batch = 0;
	}
}

export class FlatSignal<T = any> {
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

	get val(): T {
		if (COMPUTED) {
			COMPUTED._sources |= this.#id;
		}
		return this.#val as T;
	}

	get peek() {
		return this.#val;
	}

	get root() {
		return this.#root;
	}

	set val(val: T) {
		if (this.equals(val, this.#val)) return;
		this.#val = val as T;
		this.#root._queue(this.#id);
	}
}

export class FlatCompute<T = unknown> {
	#root: FlatRoot;
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
		if (!ROOT) ROOT = new FlatRoot();
		this.#root = ROOT;
		this.#fn = compute;
		this.#val = val!;
		this.#id = this.#root._ac(this as FlatCompute<unknown>);
		if (effect) {
			this._effect = effect;
			this.val;
		}
	}

	get val(): T {
		this.#root._flush();
		const prevCurrent = COMPUTED;
		if (this._dirty) {
			COMPUTED = this as FlatCompute<unknown>;
			this._sources = 0;
			this.#val = this.#fn!();
			this._dirty = false;
			COMPUTED = prevCurrent;
		}
		if (prevCurrent) {
			prevCurrent._sources |= this._sources;
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
		this._sources = 0;
		this._dirty = false;
		this._d = true;
		this.#root._dc(this.#id);
	}
}

function defaultEquality(a: unknown, b: unknown) {
	return a === b;
}

export function batch(fn: () => void) {
	if (BATCHING) return fn();
	BATCHING = true;
	fn();
	ROOT_QUEUE?._flush(true);
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

export function effect<T = unknown>(fn: () => T) {
	const sig = new FlatCompute(fn, undefined, true);
	return sig.dispose.bind(sig);
}
