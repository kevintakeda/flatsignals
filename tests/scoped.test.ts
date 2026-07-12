import { expect, test } from "vitest";
import { FlatRoot, scoped } from "../src/index.js";

test("returns the function result with a scope array", () => {
	const scope: FlatRoot[] = [];
	const result = scoped(() => "hello", scope);
	expect(result).toBe("hello");
});

test("collects FlatRoots created inside into the scope array", () => {
	const scope: FlatRoot[] = [];
	scoped(() => {
		new FlatRoot();
		new FlatRoot();
	}, scope);
	expect(scope).toHaveLength(2);
	expect(scope[0]).toBeInstanceOf(FlatRoot);
	expect(scope[1]).toBeInstanceOf(FlatRoot);
});

test("collects roots with autoFlush=true by default", () => {
	const scope: FlatRoot[] = [];
	scoped(() => {
		const r = new FlatRoot();
		expect(r.autoFlush).toBe(true);
	}, scope);
	expect(scope).toHaveLength(1);
});

test("collects roots with autoFlush=false", () => {
	const scope: FlatRoot[] = [];
	scoped(() => {
		new FlatRoot(false);
	}, scope);
	expect(scope).toHaveLength(1);
	expect(scope[0].autoFlush).toBe(false);
});

test("restores previous SCOPE after execution", () => {
	const outerScope: FlatRoot[] = [];
	const innerScope: FlatRoot[] = [];
	scoped(() => {
		new FlatRoot();
		scoped(() => {
			new FlatRoot();
		}, innerScope);
		new FlatRoot();
	}, outerScope);
	expect(outerScope).toHaveLength(2);
	expect(innerScope).toHaveLength(1);
});

test("nested scoped collects roots into correct scope arrays", () => {
	const scope1: FlatRoot[] = [];
	const scope2: FlatRoot[] = [];
	scoped(() => {
		new FlatRoot(); // scope1[0]
		scoped(() => {
			new FlatRoot(); // scope2[0]
		}, scope2);
	}, scope1);
	expect(scope1.length + scope2.length).toBe(2);
});

test("scope array is empty when no FlatRoot is created", () => {
	const scope: FlatRoot[] = [];
	scoped(() => {
		const x = 1 + 1;
	}, scope);
	expect(scope).toHaveLength(0);
});

test("supports roots with custom settings", () => {
	const scope: FlatRoot[] = [];
	scoped(() => {
		new FlatRoot(false);
		new FlatRoot(true);
	}, scope);
	expect(scope).toHaveLength(2);
	expect(scope[0].autoFlush).toBe(false);
	expect(scope[1].autoFlush).toBe(true);
});
