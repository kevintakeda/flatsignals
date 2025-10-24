# FlatSignals

**FlatSignals** is an ultra-fast reactivity library (~0.5 KB) optimized for **high-frequency, few-to-many updates**.

## 🚀 Why it’s fast:

- No graph traversals
- O(1) dynamic dependency management
- Lazy computations by default

## Benchmarks

> **Note:** Benchmarks were run in a controlled environment. Results may vary based on hardware and JavaScript engine. You can reproduce these benchmarks by cloning the repo and running `pnpm bench`.

### 1-to-64 fanout

| Library              | Operations/sec ⚡ | vs flatsignals |
| -------------------- | ----------------- | -------------- |
| **flatsignals** 🏆   | **449,848**       | **baseline**   |
| alien-signals        | 261,082           | 1.72x slower   |
| @preact/signals      | 230,899           | 1.95x slower   |
| @reactively/core     | 182,403           | 2.47x slower   |
| @vue/reactivity      | 152,709           | 2.95x slower   |
| @maverick-js/signals | 137,712           | 3.27x slower   |
| Angular Signals      | 98,597            | 4.56x slower   |
| @solidjs/signals     | 78,849            | 5.71x slower   |

### High-frequency updates

| Library              | Operations/sec ⚡ | vs flatsignals |
| -------------------- | ----------------- | -------------- |
| **flatsignals** 🏆   | **976,139**       | **baseline**   |
| alien-signals        | 502,513           | 1.94x slower   |
| @preact/signals      | 492,543           | 1.98x slower   |
| @reactively/core     | 438,882           | 2.22x slower   |
| @maverick-js/signals | 343,368           | 2.84x slower   |
| Angular Signals      | 241,189           | 4.05x slower   |
| @vue/reactivity      | 221,537           | 4.41x slower   |
| @solidjs/signals     | 202,492           | 4.82x slower   |

### Diamond

| Library              | Operations/sec ⚡ | vs flatsignals |
| -------------------- | ----------------- | -------------- |
| **flatsignals** 🏆   | **4,556,987**     | **baseline**   |
| alien-signals        | 3,028,320         | 1.50x slower   |
| @preact/signals      | 2,531,788         | 1.80x slower   |
| @reactively/core     | 1,688,053         | 2.70x slower   |
| Angular Signals      | 1,614,432         | 2.82x slower   |
| @vue/reactivity      | 1,563,865         | 2.91x slower   |
| @maverick-js/signals | 1,407,975         | 3.24x slower   |
| @solidjs/signals     | 870,080           | 5.24x slower   |

## Installation

```bash
# npm
npm install flatsignals

# pnpm
pnpm add flatsignals

# yarn
yarn add flatsignals
```

## Usage

```ts
import { signal, computed, effect } from "flatsignals";

const counter = signal(0);
const double = computed(() => counter.val * 2);
const log = effect(() => console.log(double.val));
```

## With React

```tsx
import { useFlatSignal, useFlatReader } from "flatsignals/react";
import { counter, double } from "./signals";

function MyCounter() {
  const [val, setVal] = useFlatSignal(counter);
  return <button onClick={() => setVal(val + 1)}>Count: {val}</button>;
}

function ReadDouble() {
  const val = useFlatReader(double);
  return <div>{val}</div>;
}
```

## Use Case

> **Best suited for:** Scenarios with a small number of reactive signals driving many dependent computations.

**Limitations:**

- **Signal limit**: Maximum of 32 signals per root. Beyond this limit, effects may trigger even when their tracked signals haven't changed.
- **Set complexity**: O(N) time proportional to dependent computations (amortized through batching)
- **Eager propagation**: All downstream nodes marked dirty immediately, even when intermediate values unchanged
