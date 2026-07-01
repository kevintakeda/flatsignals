import {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
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
	scoped,
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
				scoped(
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
				scoped(
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
		() => selector(signal.get()),
		() => selector(signal.peek),
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

export function useFlatScope<T>(callback: () => T, scope?: FlatRoot): T {
	return useMemo(() => scoped(callback, scope), [callback, scope]);
}

export function useFlatRoot(autoFlush?: boolean) {
	const [root] = useState(() => new FlatRoot(autoFlush));
	return root;
}

export function useFlatEffect(
	fn: () => (() => void) | undefined,
	root: FlatRoot,
): void {
	const onEffect = useEffectEvent(fn);

	useEffect(() => {
		let cleanup: (() => void) | undefined;
		const stop = scoped(
			() =>
				effect(() => {
					if (cleanup) cleanup();
					cleanup = onEffect();
				}),
			root,
		);

		return () => {
			if (cleanup) cleanup();
			stop();
		};
	}, [root]);
}

export function useFlatComputed<T>(
	fn: () => T,
	root: FlatRoot,
): FlatCompute<T> {
	const fnRef = useRef(fn);
	fnRef.current = fn;

	const [s] = useState(() =>
		scoped(() => computed(() => fnRef.current()), root),
	);

	useEffect(() => {
		return () => s.dispose();
	}, [s]);

	return s;
}

export function useFlatSignal<T>(value: T, root: FlatRoot) {
	const [s] = useState(() => scoped(() => signal(value), root));
	return s;
}
