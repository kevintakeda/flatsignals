# FlatSignals

FlatSignals is an extremely fast reactivity library (~1kb).

- **No graph traversals!**
- Light (~1kb)
- Highly efficient auto un/tracking of dynamic dependencies
- Auto disposals
- Computations are lazy by default

## When to use this library

- Your app has isolated sections, each needing a few reactive values.
- Most of your reactive code runs when data changes anyway, making traditional reactive libraries' tracking algorithm overhead unnecessary.
- Your reactive code often changes which values it depends on.

## Limitations

1. Supports only 32 signals per root.
2. Not 100% fine-grained. A change in the data source marks all dependents as dirty, even if intermediary nodes have the same value.
