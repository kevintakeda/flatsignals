import { expect, test } from "vitest";
import { scoped, signal } from "../src/index.js";

test("store and return a value", () => {
	scoped(() => {
		const a = signal(1);
		expect(a.val).toBe(1);
	});
});

test("updates its value", () => {
	scoped(() => {
		const a = signal(1);
		a.val = 2;
		expect(a.val).toBe(2);
	});
});

test("always updates", () => {
	scoped(() => {
		const a = signal(1);
		a.val = 1;
		expect(a.val).toBe(1);
		a.val = 2;
		expect(a.val).toBe(2);
	});
});
