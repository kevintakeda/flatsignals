import { describe } from "vitest";
import {
	type FrameworkBenchmarkApi,
	type FrameworkComputed,
	type FrameworkSignal,
	runAll,
} from "./frameworks";
import { batchBench, denseBench, packedBench } from "./utils";

describe("diamond", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			//       source
			//      /      \
			//   left      right
			//      \      /
			//      bottom
			const source = api.signal(0);

			const left = api.computed(() => source.get() * 2);
			const right = api.computed(() => source.get() + 10);
			const bottom = api.computed(() => left.get() + right.get());

			let effectRuns = 0;
			api.effect(() => {
				bottom.get();
				effectRuns++;
			});

			return () => {
				api.runSync(() => source.set(1));
				effectRuns = 0;
				api.runSync(() => source.set(2));
				api.runSync(() => source.set(3));
				api.runSync(() => source.set(4));

				console.assert(
					effectRuns === 3,
					`${api.name} - expected 3, got ${effectRuns}`,
				);
			};
		});
	}

	runAll(op);
});

describe("high-frequency updates", () => {
	function op(api: FrameworkBenchmarkApi) {
		const COMPONENTS = 8;

		return api.root(() => {
			const mouseX = api.signal(0);
			const mouseY = api.signal(0);

			let totalEffectRuns = 0;

			for (let i = 0; i < COMPONENTS; i++) {
				if (i % 3 === 0) {
					api.effect(() => {
						mouseX.get();
						mouseY.get();
						totalEffectRuns++;
					});
				} else if (i % 3 === 1) {
					const distance = api.computed(() =>
						Math.sqrt(mouseX.get() ** 2 + mouseY.get() ** 2),
					);
					api.effect(() => {
						distance.get();
						totalEffectRuns++;
					});
				} else {
					api.effect(() => {
						mouseX.get();
						totalEffectRuns++;
					});
				}
			}

			return () => {
				api.runSync(() => {
					mouseX.set(10);
					mouseY.set(5);
				});
				totalEffectRuns = 0;

				api.runSync(() => {
					mouseX.set(20);
					mouseY.set(15);
				});
				api.runSync(() => {
					mouseX.set(30);
					mouseY.set(25);
				});
				api.runSync(() => {
					mouseX.set(40);
					mouseY.set(35);
				});
				api.runSync(() => {
					mouseX.set(50);
					mouseY.set(45);
				});
				api.runSync(() => {
					mouseX.set(60);
					mouseY.set(55);
				});

				console.assert(
					totalEffectRuns >= COMPONENTS * 5,
					`${api.name} - expected ${COMPONENTS * 5}, got ${totalEffectRuns}`,
				);
			};
		});
	}

	runAll(op);
});

describe("1-to-64 fanout", () => {
	function op(api: FrameworkBenchmarkApi) {
		const WIDTH = 64;

		return api.root(() => {
			const source = api.signal(0);
			const background = api.signal(1);

			let triggeredEffects = 0;

			for (let i = 0; i < WIDTH; i++) {
				if (i % 2 === 0) {
					api.effect(() => {
						source.get();
						triggeredEffects++;
					});
				} else {
					const derived = api.computed(() => source.get() * background.get());
					api.effect(() => {
						derived.get();
						triggeredEffects++;
					});
				}
			}

			return () => {
				api.runSync(() => source.set(1));
				triggeredEffects = 0;
				api.runSync(() => source.set(2));

				console.assert(
					triggeredEffects === WIDTH,
					`${api.name} - expected ${WIDTH}, got ${triggeredEffects}`,
				);
			};
		});
	}

	runAll(op);
});

describe("signal creation", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			return () => {
				api.signal(Math.random());
			};
		});
	}
	runAll(op);
});

describe("update computed", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			const signal = api.signal(0);
			api.computed(() => signal.get());
			let i = 0;
			return () => {
				api.runSync(() => {
					signal.set(i++);
				});
			};
		});
	}
	runAll(op);
});

describe("update effect", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			const signal = api.signal(0);
			api.effect(() => signal.get());
			let i = 0;

			return () => {
				api.runSync(() => {
					signal.set(i++);
				});
			};
		});
	}
	runAll(op);
});

describe("computed caching", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			const source = api.signal(0);
			const idleSource = api.signal(0);

			const expensive = api.computed(() => {
				let sum = 0;
				for (let i = 0; i < 5000; i++) {
					sum += idleSource.get() * i;
				}
				return sum;
			});

			let effectRuns = 0;
			api.effect(() => {
				if (source.get() >= 5) {
					expensive.get();
					expensive.get();
				}
				effectRuns++;
			});

			return () => {
				api.runSync(() => source.set(1));
				effectRuns = 0;
				api.runSync(() => source.set(2));
				api.runSync(() => source.set(3));
				api.runSync(() => source.set(4));

				api.runSync(() => source.set(5));
				api.runSync(() => source.set(6));
				api.runSync(() => source.set(7));

				api.runSync(() => source.set(10));
				api.runSync(() => source.set(10));
				api.runSync(() => source.set(10));

				console.assert(
					effectRuns === 7,
					`${api.name} - expected 7, got ${effectRuns}`,
				);
			};
		});
	}

	runAll(op);
});

describe("wide propagation (32x)", () => {
	function op(api: FrameworkBenchmarkApi) {
		const width = 32;
		return api.root(() => {
			const head = api.signal(0);
			let last = head as FrameworkComputed<number>;
			let countEff = 0,
				countComp = 0;
			for (let i = 0; i < width; i++) {
				const c = api.computed(() => {
					countComp++;
					return head.get() + i;
				});
				api.effect(() => {
					c.get();
					countEff++;
				});
				last = c;
			}

			return () => {
				api.runSync(() => head.set(1));
				countEff = 0;
				countComp = 0;
				api.runSync(() => head.set(2));
				console.assert(countEff === width, api.name);
				console.assert(countComp === width);
				console.assert(last.get() === width + 1);
			};
		});
	}
	runAll(op);
});

describe("deep propagation (32x)", () => {
	function op(api: FrameworkBenchmarkApi) {
		const height = 32;
		return api.root(() => {
			const head = api.signal(0);
			let current = head as FrameworkComputed<number>;
			let countEff = 0,
				countComp = 0;
			for (let i = 0; i < height; i++) {
				const prev = current;
				current = api.computed(() => {
					countComp++;
					return prev.get() + 1;
				});
			}
			api.effect(() => {
				current.get();
				countEff++;
			});

			return () => {
				api.runSync(() => head.set(1));
				countComp = 0;
				countEff = 0;
				api.runSync(() => head.set(2));
				console.assert(countComp === height);
				console.assert(countEff === 1);
				console.assert(current.get() === height + 2);
			};
		});
	}
	runAll(op);
});

describe("dynamic", () => {
	function op(api: FrameworkBenchmarkApi) {
		return api.root(() => {
			const head = api.signal(0);
			for (let j = 0; j < 10; j++) {
				const trigger = api.computed(() => (head.get() + j) % 2 === 0);
				const signals: FrameworkSignal<number>[] = [];
				for (let i = 0; i < 3; i++) {
					signals.push(api.signal(i));
				}
				const between1 = api.computed(() => {
					let sum = 0;
					for (let i = 0; i < signals.length; i++) {
						sum += signals[i].get();
					}
					return sum;
				});
				const between2 = api.computed(() => {
					let sum = 0;
					for (let i = signals.length - 1; i > 0; i--) {
						sum -= signals[i].get();
					}
					return sum;
				});
				const end = api.computed(() => {
					return trigger.get() ? between1.get() : between2.get();
				});
				api.effect(() => end.get());
			}
			return () => {
				api.runSync(() => {
					head.update((el) => el + 1);
				});
			};
		});
	}
	runAll(op);
});

describe("batch 25%", () => {
	const op = batchBench(16, 2, 4);
	runAll(op);
});

describe("batch 50%", () => {
	const op = batchBench(16, 2, 8);
	runAll(op);
});

describe("batch 75%", () => {
	const op = batchBench(16, 2, 12);
	runAll(op);
});

describe("batch 100%", () => {
	const op = batchBench(16, 2, 16);
	runAll(op);
});

describe("packed 30%", () => {
	const op = packedBench(16, 16, 0.3);
	runAll(op);
});

describe("packed 60%", () => {
	const op = packedBench(16, 16, 0.6);
	runAll(op);
});

describe("packed 80%", () => {
	const op = packedBench(16, 16, 0.8);
	runAll(op);
});

describe("dense batch ~1/3 (2x layers)", () => {
	const op = denseBench(16, 2, 2, 16 / 3);
	runAll(op);
});

describe("dense batch ~1/3 (4x layers)", () => {
	const op = denseBench(16, 4, 2, 16 / 3);
	runAll(op);
});

describe("dense batch ~1/3 (6x layers)", () => {
	const op = denseBench(16, 6, 2, 16 / 3);
	runAll(op);
});

describe("dense batch ~1/3 (8x layers)", () => {
	const op = denseBench(16, 8, 2, 16 / 3);
	runAll(op);
});

describe("dense batch ~1/3 (10x layers)", () => {
	const op = denseBench(16, 10, 2, 16 / 3);
	runAll(op);
});

describe("one to one to one (32x)", () => {
	function op(api: FrameworkBenchmarkApi) {
		const width = 32;
		return api.root(() => {
			const ones: FrameworkSignal<number>[] = [];

			for (let i = 0; i < width; i++) {
				const a = api.signal(1);
				const b = api.computed(() => a.get());
				ones.push(a);
				api.effect(() => {
					b.get();
				});
			}

			return () => {
				for (let i = 0; i < ones.length; i++) {
					api.runSync(() => ones[i].set(2));
				}
			};
		});
	}
	runAll(op);
});
