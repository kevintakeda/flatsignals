// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
	computed,
	type FlatCompute,
	FlatRoot,
	scoped,
	signal,
} from "../src/index.js";
import {
	useFlatComputed,
	useFlatEffect,
	useFlatRoot,
	useFlatScope,
	useFlatSignal,
	useSyncFlatReader,
	useSyncFlatSelector,
	useSyncFlatSignal,
	useSyncFlatWriter,
} from "../src/react/index.js";

describe("useSyncFlatReader", () => {
	test("reads initial signal value", () => {
		const s = signal(1);
		const { result } = renderHook(() => useSyncFlatReader(s));
		expect(result.current).toBe(1);
	});

	test("re-renders when signal value changes", () => {
		const s = signal(1);
		const { result } = renderHook(() => useSyncFlatReader(s));
		act(() => {
			s.set(2);
		});
		expect(result.current).toBe(2);
	});

	test("works with computed signals", () => {
		const s = signal(2);
		const c = computed(() => s.get() * 3);
		const { result } = renderHook(() => useSyncFlatReader(c));
		expect(result.current).toBe(6);
		act(() => {
			s.set(3);
		});
		expect(result.current).toBe(9);
	});

	test("custom isEqual prevents re-render when returning true", () => {
		const s = signal({ x: 1 });
		const { result } = renderHook(() => useSyncFlatReader(s, () => true));
		act(() => {
			s.set({ x: 2 });
		});
		expect(result.current).toEqual({ x: 1 });
	});

	test("custom isEqual allows re-render when returning false", () => {
		const s = signal(1);
		let renderCount = 0;
		renderHook(() => {
			renderCount++;
			return useSyncFlatReader(s, () => false);
		});
		const countBefore = renderCount;
		act(() => {
			s.set(2);
		});
		expect(renderCount).toBeGreaterThan(countBefore);
	});
});

describe("useSyncFlatSelector", () => {
	test("selects a derived value from a signal", () => {
		const s = signal({ a: 1, b: 2 });
		const { result } = renderHook(() => useSyncFlatSelector(s, (v) => v.a));
		expect(result.current).toBe(1);
	});

	test("re-renders when selected value changes", () => {
		const s = signal({ a: 1, b: 2 });
		const { result } = renderHook(() => useSyncFlatSelector(s, (v) => v.a));
		act(() => {
			s.set({ a: 3, b: 2 });
		});
		expect(result.current).toBe(3);
	});

	test("skips re-render when signal changes but selected value stays same", () => {
		const s = signal({ a: 1, b: 2 });
		const { result } = renderHook(() => useSyncFlatSelector(s, (v) => v.a));
		act(() => {
			s.set({ a: 1, b: 99 });
		});
		expect(result.current).toBe(1);
	});

	test("custom isEqual controls selector update", () => {
		const s = signal({ items: [1, 2] });
		const selectItems = (v: { items: number[] }) => v.items;
		const { result } = renderHook(() =>
			useSyncFlatSelector(s, selectItems, (a, b) => {
				if (a.length !== b.length) return false;
				return a.every((item, i) => item === b[i]);
			}),
		);
		const first = result.current;
		act(() => {
			s.set({ items: [1, 2] });
		});
		expect(result.current).toBe(first);
	});

	test("works with computed signals", () => {
		const s = signal(10);
		const c = computed(() => s.get() * 2);
		const { result } = renderHook(() => useSyncFlatSelector(c, (v) => v - 1));
		expect(result.current).toBe(19);
		act(() => {
			s.set(5);
		});
		expect(result.current).toBe(9);
	});
});

describe("useSyncFlatWriter", () => {
	test("returns a stable setter function across re-renders", () => {
		const s = signal(1);
		const { result, rerender } = renderHook(() => useSyncFlatWriter(s));
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});

	test("setter updates signal value", () => {
		const s = signal(1);
		const { result } = renderHook(() => useSyncFlatWriter(s));
		act(() => {
			result.current(2);
		});
		expect(s.get()).toBe(2);
	});

	test("setter supports functional update", () => {
		const s = signal(5);
		const { result } = renderHook(() => useSyncFlatWriter(s));
		act(() => {
			result.current((prev) => prev + 1);
		});
		expect(s.get()).toBe(6);
	});

	test("writer and reader see the same value", () => {
		const s = signal(0);
		const { result: reader } = renderHook(() => useSyncFlatReader(s));
		const { result: writer } = renderHook(() => useSyncFlatWriter(s));
		act(() => {
			writer.current((prev) => prev + 1);
		});
		expect(reader.current).toBe(1);
	});
});

describe("useSyncFlatSignal", () => {
	test("returns [value, setter] tuple", () => {
		const s = signal("hello");
		const { result } = renderHook(() => useSyncFlatSignal(s));
		const [value, setter] = result.current;
		expect(value).toBe("hello");
		expect(typeof setter).toBe("function");
	});

	test("setter updates the read value", () => {
		const s = signal("hello");
		const { result } = renderHook(() => useSyncFlatSignal(s));
		act(() => {
			result.current[1]("world");
		});
		expect(result.current[0]).toBe("world");
	});

	test("setter supports functional update", () => {
		const s = signal(0);
		const { result } = renderHook(() => useSyncFlatSignal(s));
		act(() => {
			result.current[1]((prev) => prev + 5);
		});
		expect(result.current[0]).toBe(5);
	});
});

describe("useFlatScope", () => {
	test("runs callback and returns result", () => {
		const { result } = renderHook(() => useFlatScope(() => 42));
		expect(result.current).toBe(42);
	});

	test("evaluates callback in scoped context", () => {
		const fn = vi.fn(() => signal(1));
		renderHook(() => useFlatScope(fn));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("uses provided scope", () => {
		const root = new FlatRoot();
		let capturedRoot: FlatRoot | undefined;
		renderHook(() =>
			useFlatScope(() => {
				capturedRoot = signal(1).root;
			}, root),
		);
		expect(capturedRoot).toBe(root);
	});

	test("result is memoized when callback reference is stable", () => {
		const fn = () => 42;
		const { result, rerender } = renderHook(
			(cb: () => number) => useFlatScope(cb),
			{ initialProps: fn },
		);
		const first = result.current;
		rerender(fn);
		expect(result.current).toBe(first);
	});

	test("re-evaluates when callback changes", () => {
		const { result, rerender } = renderHook(
			({ cb }: { cb: () => number }) => useFlatScope(cb),
			{ initialProps: { cb: () => 1 } },
		);
		expect(result.current).toBe(1);
		rerender({ cb: () => 2 });
		expect(result.current).toBe(2);
	});

	test("re-evaluates when scope changes", () => {
		const rootA = new FlatRoot();
		const rootB = new FlatRoot();
		const { result, rerender } = renderHook(
			({ r }: { r: FlatRoot }) => useFlatScope(() => r, r),
			{ initialProps: { r: rootA } },
		);
		expect(result.current).toBe(rootA);
		rerender({ r: rootB });
		expect(result.current).toBe(rootB);
	});
});

describe("useFlatRoot", () => {
	test("returns a FlatRoot instance", () => {
		const { result } = renderHook(() => useFlatRoot());
		expect(result.current).toBeInstanceOf(FlatRoot);
	});

	test("returns stable instance across re-renders", () => {
		const { result, rerender } = renderHook(() => useFlatRoot());
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});

	test("passes autoFlush parameter", () => {
		const { result } = renderHook(() => useFlatRoot(false));
		expect(result.current.autoFlush).toBe(false);
	});

	test("default autoFlush is true", () => {
		const { result } = renderHook(() => useFlatRoot());
		expect(result.current.autoFlush).toBe(true);
	});
});

describe("Bypass React rendering pattern (README example)", () => {
	test("useFlatRoot(false) + useFlatSignal + useFlatComputed + useFlatEffect with manual flush", () => {
		const root = new FlatRoot(false);

		const { result: counter } = renderHook(() => useFlatSignal(1, root));
		const { result: double } = renderHook(() =>
			useFlatComputed(() => counter.current.get() * 2, root),
		);

		expect(double.current.get()).toBe(2);

		const spy = vi.fn((): (() => void) | undefined => {
			double.current.get();
			return undefined;
		});
		renderHook(() => useFlatEffect(spy, root));

		expect(spy).toHaveBeenCalledTimes(1);

		counter.current.set(5);

		expect(spy).toHaveBeenCalledTimes(1);

		root.flush();

		expect(spy).toHaveBeenCalledTimes(2);
		expect(double.current.get()).toBe(10);
	});
});

describe("useFlatEffect", () => {
	test("runs effect on mount", () => {
		const fn: () => (() => void) | undefined = vi.fn(
			(): (() => void) | undefined => undefined,
		);
		const root = new FlatRoot();
		renderHook(() => useFlatEffect(fn, root));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("cleanup runs on unmount", () => {
		const cleanup: () => void = vi.fn();
		const fn = vi.fn((): (() => void) | undefined => {
			return cleanup;
		});
		const root = new FlatRoot();
		const { unmount } = renderHook(() => useFlatEffect(fn, root));
		expect(cleanup).not.toHaveBeenCalled();
		act(() => {
			unmount();
		});
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	test("re-runs when tracked signal in same root changes", () => {
		const root = new FlatRoot();
		const s = scoped(() => signal(1), root);
		const fn = vi.fn((): (() => void) | undefined => {
			s.get();
			return undefined;
		});
		renderHook(() => useFlatEffect(fn, root));
		expect(fn).toHaveBeenCalledTimes(1);
		act(() => {
			s.set(2);
		});
		expect(fn).toHaveBeenCalledTimes(2);
	});

	test("cleanup runs before re-run on dependency change", () => {
		const root = new FlatRoot();
		const s = scoped(() => signal(1), root);
		const cleanup: () => void = vi.fn();
		const fn = vi.fn((): (() => void) | undefined => {
			s.get();
			return cleanup;
		});
		renderHook(() => useFlatEffect(fn, root));
		expect(cleanup).not.toHaveBeenCalled();
		act(() => {
			s.set(2);
		});
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	test("does not re-run on unrelated signal changes", () => {
		const root = new FlatRoot();
		const a = scoped(() => signal(1), root);
		const b = scoped(() => signal("unrelated"), root);
		const fn = vi.fn((): (() => void) | undefined => {
			a.get();
			return undefined;
		});
		renderHook(() => useFlatEffect(fn, root));
		expect(fn).toHaveBeenCalledTimes(1);
		act(() => {
			b.set("still unrelated");
		});
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("stops effect on unmount", () => {
		const root = new FlatRoot();
		const s = scoped(() => signal(1), root);
		const fn = vi.fn((): (() => void) | undefined => {
			s.get();
			return undefined;
		});
		const { unmount } = renderHook(() => useFlatEffect(fn, root));
		expect(fn).toHaveBeenCalledTimes(1);
		act(() => {
			unmount();
		});
		act(() => {
			s.set(2);
		});
		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe("useFlatComputed", () => {
	test("creates a computed with the initial value", () => {
		const root = new FlatRoot();
		const { result } = renderHook(() => useFlatComputed(() => 42, root));
		expect(result.current.get()).toBe(42);
	});

	test("computed updates when signal dependency in same root changes", () => {
		const root = new FlatRoot();
		const s = scoped(() => signal(1), root);
		const { result } = renderHook(() =>
			useFlatComputed(() => s.get() * 2, root),
		);
		expect(result.current.get()).toBe(2);
		act(() => {
			s.set(5);
		});
		expect(result.current.get()).toBe(10);
	});

	test("computed instance is stable across re-renders", () => {
		const root = new FlatRoot();
		const { result, rerender } = renderHook(
			({ v }: { v: number }) => useFlatComputed(() => v, root),
			{ initialProps: { v: 1 } },
		);
		const first = result.current;
		rerender({ v: 2 });
		expect(result.current).toBe(first);
	});

	test("computed re-evaluates with latest callback when signal deps change", () => {
		const root = new FlatRoot();
		const s = scoped(() => signal(1), root);
		const { result, rerender } = renderHook(
			({ mult }: { mult: number }) =>
				useFlatComputed(() => s.get() * mult, root),
			{ initialProps: { mult: 2 } },
		);
		expect(result.current.get()).toBe(2);
		rerender({ mult: 10 });
		expect(result.current.get()).toBe(2);
		act(() => {
			s.set(2);
		});
		expect(result.current.get()).toBe(20);
	});

	test("disposes computed on unmount", () => {
		const root = new FlatRoot();
		const { result, unmount } = renderHook(() =>
			useFlatComputed(() => 42, root),
		);
		const c = result.current as FlatCompute<number> & { _d: boolean };
		expect(c._d).toBe(false);
		act(() => {
			unmount();
		});
		expect(c._d).toBe(true);
	});
});

describe("useFlatSignal", () => {
	test("creates a signal with the initial value", () => {
		const root = new FlatRoot();
		const { result } = renderHook(() => useFlatSignal(42, root));
		expect(result.current.get()).toBe(42);
	});

	test("signal instance is stable across re-renders", () => {
		const root = new FlatRoot();
		const { result, rerender } = renderHook(
			({ v }: { v: number }) => useFlatSignal(v, root),
			{ initialProps: { v: 1 } },
		);
		const first = result.current;
		rerender({ v: 2 });
		expect(result.current).toBe(first);
	});

	test("signal is scoped to the provided root", () => {
		const root = new FlatRoot();
		const { result } = renderHook(() => useFlatSignal(1, root));
		expect(result.current.root).toBe(root);
	});

	test("created signal can be read and written", () => {
		const root = new FlatRoot();
		const { result } = renderHook(() => useFlatSignal("hello", root));
		act(() => {
			result.current.set("world");
		});
		expect(result.current.get()).toBe("world");
	});

	test("signal value changes are reactive within the same root", () => {
		const root = new FlatRoot();
		const { result: signalResult } = renderHook(() => useFlatSignal(0, root));
		const { result: readerResult } = renderHook(() =>
			useSyncFlatReader(signalResult.current),
		);
		act(() => {
			signalResult.current.set(42);
		});
		expect(readerResult.current).toBe(42);
	});
});
