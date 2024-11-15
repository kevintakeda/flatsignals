# FlatSignals

FlatSignals is an extremely fast reactivity library (~0.8kb).

- **No graph traversals!**
- Light (~0.8kb)
- Highly efficient auto un/tracking of dynamic dependencies
- Auto disposals
- Computations are lazy by default

## Benchmarks

You can execute the [benchmarks](https://github.com/kevintakeda/flatsignals/tree/main/benchmarks) by running `pnpm bench`.

```bash
  flatsignals - benchmarks/signals.bench.ts > dense (4x layers)
    1.81x faster than @reactively/core
    1.93x faster than @preact/signals
    2.88x faster than @maverick-js/signals
    5.74x faster than @solidjs/signals (new)

  flatsignals - benchmarks/signals.bench.ts > dense (8x layers)
    2.65x faster than @reactively/core
    3.45x faster than @preact/signals
    4.57x faster than @maverick-js/signals
    10.30x faster than @solidjs/signals (new)

  flatsignals - benchmarks/signals.bench.ts > dense (12x layers)
    3.18x faster than @reactively/core
    3.65x faster than @preact/signals
    5.49x faster than @maverick-js/signals
    10.37x faster than @solidjs/signals (new)
```

## When to use this library

- You have less than 32 data sources per isolated reactive part.
- Your dependency graph is very dense, making precise dependency tracking too costly.

## Limitations

1. Supports only 32 signals per root.
2. Not 100% fine-grained. A change in the data source marks all dependents as dirty, even if intermediary nodes have the same value.
