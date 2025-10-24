/** biome-ignore-all lint/suspicious/noAssignInExpressions: conciseness */

import { expect, test, vi } from "vitest";
import {
	computed,
	effect,
	type FlatCompute,
	FlatRoot,
	type FlatSignal,
	scoped,
	signal,
} from "../src/index.js";

test("untracked", () => {
	const spy = vi.fn();
	let S!: FlatSignal<number>;
	scoped(() => {
		S = signal(0);
		S.val;
		spy();
	});

	expect(spy).toBeCalledTimes(1);
	S.val = 1;
	expect(spy).toBeCalledTimes(1);
});

test("should dispose of inner computations", () => {
	let $x!: FlatSignal<number>;
	let $y!: FlatCompute<number>;

	const _memo = vi.fn(() => $x.val + 10);
	const _effect = vi.fn(() => $x.val + 10);

	const root = new FlatRoot();

	scoped(() => {
		$x = signal(10);
		$y = computed(_memo);
		effect(_effect);
		$y.val;
		root.dispose();
	}, root);

	// expect($y!.val).toBe(null);
	expect(_memo).toHaveBeenCalledTimes(1);
	expect(_effect).toHaveBeenCalledTimes(1);

	$x!.val = 50;

	// expect($y!.val).toBe(null);
	expect(_memo).toHaveBeenCalledTimes(1);
	expect(_effect).toHaveBeenCalledTimes(1);
});

test("scoped", () => {
	const spyEffectCalled = vi.fn();
	const spyBCalled = vi.fn();
	const spyACalled = vi.fn();
	const inner = vi.fn();

	scoped(() => {
		const a = signal("a");
		let updateInner!: () => void;
		effect(() => {
			spyEffectCalled();
			if (a.val === "b") {
				scoped(() => {
					spyBCalled();
					const $ = signal("$");
					effect(() => {
						$.val;
						inner();
					});
					updateInner = () => ($.val = $.val + $.val);
				});
			} else {
				scoped(() => {
					spyACalled();
				});
			}
		});

		expect(spyEffectCalled).toBeCalledTimes(1);
		expect(spyACalled).toBeCalledTimes(1);
		expect(spyBCalled).toBeCalledTimes(0);
		expect(inner).toBeCalledTimes(0);

		a.val = "b";

		expect(spyEffectCalled).toBeCalledTimes(2);
		expect(spyBCalled).toBeCalledTimes(1);
		expect(spyACalled).toBeCalledTimes(1);
		expect(inner).toBeCalledTimes(1);

		updateInner();

		expect(inner).toBeCalledTimes(2);

		a.val = "a";

		expect(spyEffectCalled).toBeCalledTimes(3);
		expect(inner).toBeCalledTimes(2);

		updateInner();

		expect(spyEffectCalled).toBeCalledTimes(3);
		expect(inner).toBeCalledTimes(3);
	});
});
