# FlatSignals

FlatSignals is an extremely fast reactivity library (~0.7kb).

- Lightning-fast batch updates.
- No graph traversals.
- Dynamic dependencies managed in O(1) time.
- Automatic disposals.
- Computeds are lazy by default.

## Benchmarks

You can execute the [benchmarks](https://github.com/kevintakeda/flatsignals/tree/main/benchmarks) by running `pnpm bench`.

```console
flatsignals - benchmarks/signals.bench.ts > one to many sparse (32x)
  1.60x faster than @preact/signals
  1.70x faster than @reactively/core
  1.95x faster than alien-signals
  2.27x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > wide propagation (32x)
  1.72x faster than @preact/signals
  1.74x faster than alien-signals
  2.22x faster than @reactively/core
  2.94x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > deep propagation (32x)
  1.02x faster than alien-signals
  1.29x faster than @preact/signals
  1.55x faster than @reactively/core
  1.97x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > dynamic
  2.82x faster than @preact/signals
  2.98x faster than @reactively/core
  3.54x faster than @maverick-js/signals
  4.56x faster than alien-signals

flatsignals - benchmarks/signals.bench.ts > batch 25%
  1.26x faster than @preact/signals
  1.56x faster than alien-signals
  1.66x faster than @reactively/core
  1.97x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > batch 50%
  1.48x faster than @preact/signals
  1.62x faster than alien-signals
  1.72x faster than @reactively/core
  2.09x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > packed 30%
  1.49x faster than @reactively/core
  1.77x faster than alien-signals
  1.77x faster than @preact/signals
  1.99x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (2x layers)
  1.72x faster than @preact/signals
  2.17x faster than @reactively/core
  2.25x faster than alien-signals
  2.86x faster than @maverick-js/signals

flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (4x layers)
  1.98x faster than @preact/signals
  2.11x faster than @reactively/core
  2.75x faster than alien-signals
  3.05x faster than @maverick-js/signals

alien-signals - benchmarks/signals.bench.ts > one to one to one (32x)
  1.00x faster than @preact/signals
  1.05x faster than flatsignals
  1.16x faster than @maverick-js/signals
  1.94x faster than @reactively/core
```

## Tradeoffs

1. Supports only 32 signals per root.
2. Set operations have 𝑂(𝑁) complexity, where 𝑁 is the number of computations. However, multiple updates can be batched into a single operation.
3. When data sources change, all dependent nodes are marked dirty, even if intermediate values stay the same.
