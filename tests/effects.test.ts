import { expect, test, vi } from "vitest";
import { batch, computed, effect, scoped, signal } from "../src/index.js";

test("effects", () => {
	scoped(() => {
		const a = signal(1);
		const b = signal(2);
		const cSpy = vi.fn(() => a.val + b.val);
		effect(cSpy);

		expect(cSpy).toHaveBeenCalledTimes(1);

		a.val = 10;
		expect(cSpy).toHaveBeenCalledTimes(2);
		expect(cSpy).toHaveBeenCalledTimes(2);

		batch(() => {
			b.val = 20;
			b.val = 30;
		});

		expect(cSpy).toHaveBeenCalledTimes(3);
		expect(cSpy).toHaveBeenCalledTimes(3);
	});
});

test("unsubscribe invisible dependencies", () => {
	scoped(() => {
		const a = signal(true);
		const b = signal("b");
		const c = signal("c");
		const fSpy = vi.fn(() => (a.val ? b.val : c.val));
		effect(fSpy);

		expect(fSpy).toHaveBeenCalledTimes(1);
		a.val = false;

		expect(fSpy).toHaveBeenCalledTimes(2);
		a.val = true;
		c.val = "c!";
		c.val = "c!!";

		expect(fSpy).toHaveBeenCalledTimes(3);
		a.val = false;
		b.val = "b!";
		b.val = "b!!";

		expect(fSpy).toHaveBeenCalledTimes(4);
		a.val = false;

		expect(fSpy).toHaveBeenCalledTimes(4);
		b.val = "b!!!";

		expect(fSpy).toHaveBeenCalledTimes(4);
	});
});

// TODO: unsopported for now
// test("nested effects run once", () => {
// 	scoped(() => {
// 		const a = signal(2);
// 		const spyX = vi.fn(() => a.val);
// 		const spyY = vi.fn(() => a.val);
// 		const spyZ = vi.fn(() => a.val);

// 		effect(() => {
// 			spyX();
// 			effect(() => {
// 				spyY();
// 				effect(() => {
// 					spyZ();
// 				});
// 			});
// 		});

// 		expect(spyX).toHaveBeenCalledTimes(1);
// 		expect(spyY).toHaveBeenCalledTimes(1);
// 		expect(spyZ).toHaveBeenCalledTimes(1);

// 		a.val = 4;

// 		expect(spyX).toHaveBeenCalledTimes(2);
// 		expect(spyY).toHaveBeenCalledTimes(2);
// 		expect(spyZ).toHaveBeenCalledTimes(2);

// 		expect(a.val).toBe(8);
// 	});
// });

test("dispose effects", () => {
	scoped(() => {
		const a = signal("a");
		const bSpy = vi.fn(() => a.val);
		const dispose = effect(bSpy);
		expect(bSpy).toHaveBeenCalledTimes(1);

		// set a
		a.val = "a!";
		expect(bSpy).toHaveBeenCalledTimes(2);
		a.val = "a!!";
		expect(bSpy).toHaveBeenCalledTimes(3);
		dispose();
		bSpy.mockReset();

		a.val = "a!!!";
		expect(bSpy).toHaveBeenCalledTimes(0);
		a.val = "a!!!!";
		expect(bSpy).toHaveBeenCalledTimes(0);
		expect(bSpy).toHaveBeenCalledTimes(0);
	});
});

test("effect with conditional dependencies", () => {
	scoped(() => {
		const s1 = signal(true);
		const s2 = signal("a");
		const s3 = signal("b");
		const s4 = computed(() => s2.val);
		const s5 = computed(() => s3.val);
		const result = { val: 0 };
		effect(() => {
			if (s1.val) {
				s4.val;
				result.val = 1;
			} else {
				s5.val;
				result.val = 0;
			}
		});
		s1.val = false;

		expect(result.val).toBe(0);
		s1.val = true;

		expect(result.val).toBe(1);
	});
});

test("effect with deep dependencies", () => {
	scoped(() => {
		const a = signal(2);
		const spyB = vi.fn(() => a.val + 1);
		const b = computed(spyB);
		const spyC = vi.fn(() => b.val);
		const c = computed(spyC);
		const spyD = vi.fn(() => c.val);
		const d = computed(spyD);
		const spyE = vi.fn(() => d.val);
		effect(spyE);

		expect(spyE).toHaveBeenCalledTimes(1);
		a.val = 4;

		expect(spyE).toHaveBeenCalledTimes(2);
	});
});

test("effects using sources from top to bottom", () => {
	const count = vi.fn();
	return scoped(() => {
		const x = signal("x");
		const a = computed(() => x.val);
		const b = computed(() => a.val);
		effect(() => {
			x.val;
			count();
		});
		effect(() => {
			a.val;
			count();
		});
		effect(() => {
			b.val;
			count();
		});

		expect(count).toBeCalledTimes(3);

		count.mockClear();
		x.val = "x!";

		expect(count).toBeCalledTimes(3);

		count.mockClear();
		x.val = "x!!";

		expect(count).toBeCalledTimes(3);
	});
});
