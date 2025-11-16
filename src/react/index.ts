import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  effect,
  type FlatCompute,
  type FlatRoot,
  type FlatSignal,
  scoped,
} from "../index.js";

export function useFlatReader<T>(
  signal: FlatSignal<T> | FlatCompute<T>,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const lastValueRef = useRef<T>(signal.peek);

  return useSyncExternalStore(
    useCallback(
      (onStoreChange) =>
        scoped(
          () =>
            effect(() => {
              const newValue = signal.val;
              if (!isEqual(lastValueRef.current, newValue)) {
                lastValueRef.current = newValue;
                onStoreChange();
              }
            }),
          signal.root
        ),
      [signal, isEqual]
    ),
    () => signal.val,
    () => signal.peek
  );
}

export function useFlatSelector<T, R>(
  signal: FlatSignal<T> | FlatCompute<T>,
  selector: (value: T) => R,
  isEqual: (a: R, b: R) => boolean = Object.is
): R {
  const lastSelectedRef = useRef<R>(selector(signal.peek));

  return useSyncExternalStore(
    useCallback(
      (onStoreChange) =>
        scoped(
          () =>
            effect(() => {
              const newSelected = selector(signal.val);
              if (!isEqual(lastSelectedRef.current, newSelected)) {
                lastSelectedRef.current = newSelected;
                onStoreChange();
              }
            }),
          signal.root
        ),
      [signal, selector, isEqual]
    ),
    () => selector(signal.val),
    () => selector(signal.peek)
  );
}

export function useFlatWriter<T>(
  signal: FlatSignal<T>
): (val: T | ((oldVal: T) => T)) => void {
  return useCallback(
    (val) => {
      if (typeof val === "function") {
        signal.val = (val as (oldVal: T) => T)(signal.peek);
      } else {
        signal.val = val;
      }
    },
    [signal]
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
