import {
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import {
	computed,
	effect,
	type FlatCompute,
	FlatRoot,
	type FlatSignal,
	runWithRoot,
	signal,
} from "../index.js";

export function useSyncFlatReader<T>(
	signal: FlatSignal<T> | FlatCompute<T>,
	isEqual: (a: T, b: T) => boolean = Object.is,
): T {
	const lastValueRef = useRef<T>(signal.peek);

	return useSyncExternalStore(
		useCallback(
			(onStoreChange) =>
				runWithRoot(
					() =>
						effect(() => {
							const newValue = signal.get();
							if (!isEqual(lastValueRef.current, newValue)) {
								lastValueRef.current = newValue;
								onStoreChange();
							}
						}),
					signal.root,
				),
			[signal, isEqual],
		),
		() => signal.get(),
		() => signal.peek,
	);
}

export function useSyncFlatSelector<T, R>(
	signal: FlatSignal<T> | FlatCompute<T>,
	selector: (value: T) => R,
	isEqual: (a: R, b: R) => boolean = Object.is,
): R {
	const lastSelectedRef = useRef<R>(selector(signal.peek));

	return useSyncExternalStore(
		useCallback(
			(onStoreChange) =>
				runWithRoot(
					() =>
						effect(() => {
							const newSelected = selector(signal.get());
							if (!isEqual(lastSelectedRef.current, newSelected)) {
								lastSelectedRef.current = newSelected;
								onStoreChange();
							}
						}),
					signal.root,
				),
			[signal, selector, isEqual],
		),
		() => lastSelectedRef.current,
		() => lastSelectedRef.current,
	);
}

export function useSyncFlatWriter<T>(
	signal: FlatSignal<T>,
): (val: T | ((oldVal: T) => T)) => void {
	return useCallback(
		(val) => {
			if (typeof val === "function") {
				signal.set((val as (oldVal: T) => T)(signal.peek));
			} else {
				signal.set(val);
			}
		},
		[signal],
	);
}

export function useSyncFlatSignal<T>(signal: FlatSignal<T>) {
	const reader = useSyncFlatReader(signal);
	const writer = useSyncFlatWriter(signal);
	return [reader, writer] as const;
}

export function useFlatRoot(autoFlush?: boolean) {
	const [root] = useState(() => new FlatRoot(autoFlush));

	useEffect(() => {
		return () => root.dispose();
	}, [root]);

	return root;
}

export function useFlatEffect(
	fn: () => (() => void) | undefined,
	root: FlatRoot,
): void {
	const onEffect = useEffectEvent(fn);

	useEffect(() => {
		const stop = runWithRoot(() => effect(onEffect), root);
		return () => stop();
	}, [root]);
}

export function useFlatComputed<T>(
	fn: () => T,
	root: FlatRoot,
): FlatCompute<T> {
	const fnRef = useRef(fn);
	fnRef.current = fn;

	const [s] = useState(() =>
		runWithRoot(() => computed(() => fnRef.current()), root),
	);

	useEffect(() => {
		return () => s.dispose();
	}, [s]);

	return s;
}

export function useFlatSignal<T>(value: T, root: FlatRoot) {
	const [s] = useState(() => runWithRoot(() => signal(value), root));
	return s;
}
