# FlatSignals

FlatSignals is an extremely fast reactivity library (~0.8kb).

- Lightning-fast batch updates.
- No graph traversals.
- Dynamic dependencies managed in O(1) time.
- Automatic disposals.
- Computations are lazy by default.

## Benchmarks

You can execute the [benchmarks](https://github.com/kevintakeda/flatsignals/tree/main/benchmarks) by running `pnpm bench`.

```console
  flatsignals - benchmarks/signals.bench.ts > dynamic
    1.96x faster than @reactively/core
    2.20x faster than @preact/signals
    2.55x faster than @maverick-js/signals

  flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (2x layers)
    1.55x faster than @preact/signals
    1.59x faster than @reactively/core
    2.25x faster than @maverick-js/signals

  flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (4x layers)
    1.85x faster than @reactively/core
    2.00x faster than @preact/signals
    2.97x faster than @maverick-js/signals

  flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (6x layers)
    2.02x faster than @reactively/core
    2.32x faster than @preact/signals
    3.30x faster than @maverick-js/signals

  flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (8x layers)
    2.81x faster than @reactively/core
    3.15x faster than @preact/signals
    4.51x faster than @maverick-js/signals

  flatsignals - benchmarks/signals.bench.ts > dense batch ~1/3 (10x layers)
    3.46x faster than @reactively/core
    3.72x faster than @preact/signals
    5.34x faster than @maverick-js/signals
```

## Tradeoffs

1. Supports only 64 signals per root.
2. Set operations have 𝑂(𝑁) complexity, where 𝑁 is the number of computations. However, multiple updates are automatically batched into a single operation. It performs well on dense graphs but struggles with sparse ones.
3. When data sources change, all dependent nodes are marked dirty, even if intermediate values stay the same.
