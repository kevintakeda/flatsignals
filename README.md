# FlatSignals

FlatSignals is an extremely fast reactivity library (~1kb).

- **No graph traversals!**
- Light (~1kb)
- Highly efficient auto un/tracking of dynamic dependencies
- Auto disposals
- Computations are lazy by default

## When to use this library

- The dependencies in effects/computeds changes very frequently.
- The dependency graph is very dense.
- Most effects/computeds need to be executed frequently anyway.
- A source change triggers most of your effects/computeds to rerun.

## Limitations

1. Supports only 32 signals per root.
2. Not 100% fine-grained. A change in the data source marks all dependents as dirty, even if intermediary nodes have the same value.
