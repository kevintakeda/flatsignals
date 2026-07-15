/** biome-ignore-all lint/suspicious/noAssignInExpressions: conciseness */

import { expect, test, vi } from "vitest";
import {
	computed,
	effect,
	type FlatCompute,
	FlatRoot,
	type FlatSignal,
	runWithRoot,
	signal,
} from "../src/index.js";

test("untracked", () => {
	const spy = vi.fn();
	let S!: FlatSignal<number>;
	runWithRoot(() => {
		S = signal(0);
		S.get();
		spy();
	}, new FlatRoot());

	expect(spy).toHaveBeenCalledTimes(1);
	S.set(1);
	expect(spy).toHaveBeenCalledTimes(1);
});

test("should dispose of inner computations", () => {
	let $x!: FlatSignal<number>;
	let $y!: FlatCompute<number>;

	const _memo = vi.fn(() => $x.get() + 10);
	const _effect = vi.fn(() => {
		$x.get() + 10;
	});

	const root = new FlatRoot();

	runWithRoot(() => {
		$x = signal(10);
		$y = computed(_memo);
		effect(_effect);
		$y.get();
		root.dispose();
	}, root);

	// expect($y!.get()).toBe(null);
	expect(_memo).toHaveBeenCalledTimes(1);
	expect(_effect).toHaveBeenCalledTimes(1);

	$x!.set(50);

	// expect($y!.get()).toBe(null);
	expect(_memo).toHaveBeenCalledTimes(1);
	expect(_effect).toHaveBeenCalledTimes(1);
});

test("flush on empty root is no-op", () => {
	const root = new FlatRoot();
	expect(() => root.flush()).not.toThrow();
});

test("runWithRoot", () => {
	const spyEffectCalled = vi.fn();
	const spyBCalled = vi.fn();
	const spyACalled = vi.fn();
	const inner = vi.fn();

	runWithRoot(() => {
		const a = signal("a");
		let updateInner!: () => void;
		effect(() => {
			spyEffectCalled();
			if (a.get() === "b") {
				runWithRoot(() => {
					spyBCalled();
					const $ = signal("$");
					effect(() => {
						$.get();
						inner();
					});
					updateInner = () => $.set($.get() + $.get());
				}, new FlatRoot());
			} else {
				runWithRoot(() => {
					spyACalled();
				}, new FlatRoot());
			}
		});

		expect(spyEffectCalled).toHaveBeenCalledTimes(1);
		expect(spyACalled).toHaveBeenCalledTimes(1);
		expect(spyBCalled).toHaveBeenCalledTimes(0);
		expect(inner).toHaveBeenCalledTimes(0);

		a.set("b");

		expect(spyEffectCalled).toHaveBeenCalledTimes(2);
		expect(spyBCalled).toHaveBeenCalledTimes(1);
		expect(spyACalled).toHaveBeenCalledTimes(1);
		expect(inner).toHaveBeenCalledTimes(1);

		updateInner();

		expect(inner).toHaveBeenCalledTimes(2);

		a.set("a");

		expect(spyEffectCalled).toHaveBeenCalledTimes(3);
		expect(inner).toHaveBeenCalledTimes(2);

		updateInner();

		expect(spyEffectCalled).toHaveBeenCalledTimes(3);
		expect(inner).toHaveBeenCalledTimes(3);
	}, new FlatRoot());
});
