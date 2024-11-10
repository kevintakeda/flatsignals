# FlatSignals

(WIP) FlatSignals is an extremely fast reactivity library (~1kb).

- **No graph traversals**
- Light (~1kb)
- Great for simple usecases
- Auto un/tracking of dynamic dependencies
- Auto disposals
- Computations are lazy by default
- Batteries included

## Limitations

1. Supports only 32 signals per root.
2. Not 100% fine-grained. A data source change marks all dependents as dirty.
