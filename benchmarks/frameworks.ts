/** biome-ignore-all lint/suspicious/noAssignInExpressions: for conciseness */

import {
	computed as angularComputed,
	effect as angularEffect,
	signal as angularSignal,
	untracked as angularUntracked,
	Injector,
	ɵChangeDetectionScheduler,
	ɵEffectScheduler,
} from "@angular/core";
import {
	computed as mcomputed,
	effect as meffect,
	root as mroot,
	signal as msignal,
	tick as mtick,
} from "@maverick-js/signals";
import {
	batch as pbatch,
	computed as pcomputed,
	effect as peffect,
	signal as psignal,
} from "@preact/signals-core";
import { Reactive, stabilize } from "@reactively/core";
import {
	createEffect,
	createMemo,
	createRoot,
	flush as solidFlush,
	createSignal as solidSignal,
} from "@solidjs/signals";
import {
	type ReactiveEffect,
	shallowRef,
	computed as vComputed,
	effect as vEffect,
	effectScope as vEffectScope,
} from "@vue/reactivity";
import {
	computed as alienComputed,
	effect as alienEffect,
	effectScope as alienEffectScope,
	signal as alienSignal,
	endBatch,
	startBatch,
} from "alien-signals/esm";
import { afterEach, bench } from "vitest";
import {
	batch as flatBatch,
	computed as flatComputed,
	effect as flatEffect,
	scoped as flatScoped,
	signal as flatSignal,
} from "../src/index.js";

export interface FrameworkSignal<T = any> {
	get(): T;
	set(v: T): void;
	update(v: (p: T) => T): void;
}
export interface FrameworkComputed<T = any> {
	get(): T;
}
export interface FrameworkBenchmarkApi {
	name: string;
	signal<T>(val: T): FrameworkSignal<T>;
	computed<T>(fn: () => T): FrameworkComputed<T>;
	effect(fn: () => void): void;
	runSync<T>(fn: () => T): void;
	root<T>(fn: () => T): T;
	cleanup?(): void;
}

afterEach(() => {
	cleanupAll();
});

export function runAll(op: (api: FrameworkBenchmarkApi) => () => void) {
	const x0 = op(FlatSignalsFramework);
	bench(FlatSignalsFramework.name, () => {
		x0();
	});

	const x1 = op(PreactSignalsFramework);
	bench(PreactSignalsFramework.name, () => {
		x1();
	});

	const x2 = op(ReactivelyFramework);
	bench(ReactivelyFramework.name, () => {
		x2();
	});

	const x3 = op(MaverickSignalsFramework);
	bench(MaverickSignalsFramework.name, () => {
		x3();
	});

	const x4 = op(AlienSignalsFramework);
	bench(AlienSignalsFramework.name, () => {
		x4();
	});

	const x5 = op(VueReactivityFramework);
	bench(VueReactivityFramework.name, () => {
		x5();
	});

	const x6 = op(angularFramework);
	bench(angularFramework.name, () => {
		x6();
	});

	const x7 = op(SolidjsSignals);
	bench(SolidjsSignals.name, () => {
		x7();
	});
}

export function cleanupAll() {
	AlienSignalsFramework.cleanup?.();
	VueReactivityFramework.cleanup?.();
	angularFramework.cleanup?.();
}

export const FlatSignalsFramework: FrameworkBenchmarkApi = {
	name: "flatsignals",
	signal: (val) => {
		const S = flatSignal(val);
		return {
			set: (v) => (S.val = v),
			get: () => S.val,
			update: (u) => (S.val = u(S.peek)),
		};
	},
	computed: (fn) => {
		const S = flatComputed(fn);
		return {
			get: () => S.val,
		};
	},
	effect: (fn) => flatEffect(fn),
	runSync: (fn) => {
		flatBatch(() => fn());
	},
	root: (fn) => flatScoped(fn),
};

export const ReactivelyFramework: FrameworkBenchmarkApi = {
	name: "@reactively/core",
	signal: (val) => {
		const S = new Reactive(val);
		return {
			set: (v) => S.set(v),
			get: () => S.get(),
			update: (u) => S.set(u(S.get())),
		};
	},
	computed: (fn) => {
		const S = new Reactive(fn);
		return {
			get: () => S.get(),
		};
	},
	effect: (fn) => new Reactive(fn, true),
	runSync: (fn) => {
		fn();
		stabilize();
	},
	root: (fn) => fn(),
};

export const PreactSignalsFramework: FrameworkBenchmarkApi = {
	name: "@preact/signals",
	signal: (val) => {
		const S = psignal(val);
		return {
			set: (v) => (S.value = v),
			get: () => S.value,
			update: (fn) => (S.value = fn(S.peek())),
		};
	},
	computed: (fn) => {
		const S = pcomputed(fn);
		return {
			get: () => S.value,
		};
	},
	effect: (fn) => peffect(fn),
	runSync: (fn) => pbatch(fn),
	root: (fn) => fn(),
};

export const MaverickSignalsFramework: FrameworkBenchmarkApi = {
	name: "@maverick-js/signals",
	signal: (val) => {
		const S = msignal(val);
		return {
			set: (v) => S.set(v),
			get: () => S(),
			update: (fn) => S.set(fn),
		};
	},
	computed: (fn) => {
		const S = mcomputed(fn);
		return {
			get: () => S(),
		};
	},
	effect: (fn) => meffect(fn),
	runSync: (fn) => {
		fn();
		mtick();
	},
	root: (fn) => mroot(fn),
};

let alienScope: (() => void) | null = null;
export const AlienSignalsFramework: FrameworkBenchmarkApi = {
	name: "alien-signals",
	signal: (val) => {
		const S = alienSignal(val);
		return {
			get: () => S(),
			set: (v) => S(v),
			update: (fn) => S(fn(S())),
		};
	},
	computed: (fn) => {
		const S = alienComputed(fn);
		return {
			get: () => S(),
		};
	},
	effect: (fn) => alienEffect(fn),
	runSync: (fn) => {
		startBatch();
		fn();
		endBatch();
	},
	root: <T>(fn: () => T) => {
		let out!: T;
		alienScope = alienEffectScope(() => {
			out = fn();
		});
		return out;
	},
	cleanup: () => {
		alienScope!();
		alienScope = null;
	},
};

const vueScheduled = [] as ReactiveEffect[];
function vueFlushEffects() {
	while (vueScheduled.length) {
		vueScheduled.pop()!.run();
	}
}
let vueScope: any = null;
export const VueReactivityFramework: FrameworkBenchmarkApi = {
	name: "@vue/reactivity",
	signal: (val) => {
		const S = shallowRef(val);
		return {
			get: () => S.value,
			set: (v) => (S.value = v),
			update: (fn) => (S.value = fn(S.value)),
		};
	},
	computed: (fn) => {
		const c = vComputed(fn);
		return {
			get: () => c.value,
		};
	},
	effect: (fn) => {
		const t = vEffect(fn, {
			scheduler: () => {
				vueScheduled.push(t.effect);
			},
		});
	},
	runSync: (fn) => {
		fn();
		vueFlushEffects();
	},
	root: (fn) => {
		vueScope = vEffectScope();
		return vueScope.run(fn)!;
	},
	cleanup: () => {
		vueScope!.stop();
		vueScope = null;
	},
};

interface SchedulableEffect {
	run(): void;
}
export class ArrayEffectScheduler implements ɵEffectScheduler {
	private queue = new Set<SchedulableEffect>();

	schedule(handle: SchedulableEffect): void {
		this.queue.add(handle);
	}

	add(e: SchedulableEffect): void {
		this.queue.add(e);
	}

	remove(handle: SchedulableEffect): void {
		if (!this.queue.has(handle)) {
			return;
		}

		this.queue.delete(handle);
	}

	flush(): void {
		for (const handle of this.queue) {
			handle.run();
		}
		this.queue.clear();
	}
}

const scheduler = new ArrayEffectScheduler();

const createInjector = () => ({
	injector: Injector.create({
		providers: [
			{ provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
			{ provide: ɵEffectScheduler, useValue: scheduler },
		],
	}),
});

let injectorObj = createInjector();

export const angularFramework: FrameworkBenchmarkApi = {
	name: "Angular Signals",
	signal: (initialValue) => {
		const s = angularSignal(initialValue);
		return {
			set: (v) => s.set(v),
			get: () => s(),
			update: (fn) => s.set(fn(s())),
		};
	},
	computed: (fn) => {
		const c = angularComputed(fn);
		return {
			get: () => c(),
		};
	},
	effect: (fn) => {
		angularEffect(fn, injectorObj);
	},
	runSync: (fn) => {
		fn();
		scheduler.flush();
	},
	root: <T>(fn: () => T) => {
		let res: T;
		angularEffect(() => {
			res = angularUntracked(fn);
		}, injectorObj);
		scheduler.flush();
		return res!;
	},
	cleanup: () => {
		injectorObj.injector.destroy();
		injectorObj = createInjector();
	},
};

export const SolidjsSignals: FrameworkBenchmarkApi = {
	name: "@solidjs/signals",
	signal: (val) => {
		const [read, write] = solidSignal(val as any);
		return {
			set: (v) => write(v as any),
			get: () => read(),
			update: (u) => write(u),
		};
	},
	computed: (fn) => {
		const S = createMemo(fn);
		return {
			get: () => S(),
		};
	},
	effect: (fn) => createEffect(fn, () => {}),
	runSync: (fn) => {
		fn();
		solidFlush();
	},
	root: (fn) =>
		createRoot((dispose) => {
			SolidjsSignals.cleanup = dispose;
			return fn();
		}),
};
