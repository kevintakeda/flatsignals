import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
	effect,
	type FlatCompute,
	type FlatRoot,
	type FlatSignal,
	scoped,
} from "../index.js";

export function useFlatReader<T>(signal: FlatSignal<T> | FlatCompute<T>): T {
	return useSyncExternalStore(
		useCallback(
			(onStoreChange) =>
				scoped(
					() =>
						effect(() => {
							signal.val; // track
							onStoreChange();
						}),
					signal.root,
				),
			[signal],
		),
		() => signal.val,
		() => signal.peek,
	);
}

export function useFlatWriter<T>(
	signal: FlatSignal<T>,
): (val: T | ((oldVal: T) => T)) => void {
	return useCallback(
		(val) => {
			if (typeof val === "function") {
				signal.val = (val as (oldVal: T) => T)(signal.peek);
			} else {
				signal.val = val;
			}
		},
		[signal],
	);
}

export function useFlatSignal<T>(signal: FlatSignal<T>) {
	const reader = useFlatReader(signal);
	const writer = useFlatWriter(signal);
	return [reader, writer] as const;
}

export function useFlatEffect(fn: () => undefined | (() => void)): void {
	useEffect(() => {
		let cleanup: undefined | (() => void);
		const stop = effect(() => {
			if (cleanup) cleanup();
			cleanup = fn();
		});

		return () => {
			if (cleanup) cleanup();
			stop();
		};
	}, [fn]);
}

export function useFlatScope<T>(callback: () => T, scope?: FlatRoot): T {
	return useMemo(() => scoped(callback, scope), [callback, scope]);
}
