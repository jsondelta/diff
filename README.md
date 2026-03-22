<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="128" height="128">
    <rect width="256" height="256" rx="16" fill="#111"/>
    <!-- two overlapping documents -->
    <rect x="40" y="32" width="120" height="160" rx="8" fill="#1a1a1a" stroke="#555" stroke-width="2.5"/>
    <rect x="96" y="64" width="120" height="160" rx="8" fill="#1a1a1a" stroke="#555" stroke-width="2.5"/>
    <!-- left doc lines -->
    <rect x="56" y="52" width="60" height="6" rx="3" fill="#555"/>
    <rect x="56" y="66" width="45" height="6" rx="3" fill="#555"/>
    <rect x="56" y="80" width="72" height="6" rx="3" fill="#f72585"/>
    <rect x="56" y="94" width="50" height="6" rx="3" fill="#555"/>
    <rect x="56" y="108" width="65" height="6" rx="3" fill="#555"/>
    <!-- right doc lines -->
    <rect x="112" y="84" width="60" height="6" rx="3" fill="#555"/>
    <rect x="112" y="98" width="45" height="6" rx="3" fill="#555"/>
    <rect x="112" y="112" width="72" height="6" rx="3" fill="#4cc9f0"/>
    <rect x="112" y="126" width="50" height="6" rx="3" fill="#555"/>
    <rect x="112" y="140" width="65" height="6" rx="3" fill="#555"/>
    <!-- delta arrow -->
    <line x1="128" y1="196" x2="128" y2="236" stroke="#f4a261" stroke-width="3" stroke-linecap="round"/>
    <polyline points="118,228 128,240 138,228" fill="none" stroke="#f4a261" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</p>

<h1 align="center">@jsondelta/diff</h1>

<p align="center">
  Zig-powered structural JSON diffing. Native speed via WebAssembly, with a pure JS fallback.
</p>

<p align="center">
  <a href="https://github.com/jsondelta/diff/actions/workflows/test.yml"><img src="https://github.com/jsondelta/diff/actions/workflows/test.yml/badge.svg" alt="test"></a>
  <a href="https://www.npmjs.com/package/@jsondelta/diff"><img src="https://img.shields.io/npm/v/@jsondelta/diff" alt="npm"></a>
</p>

## Install

```
npm install @jsondelta/diff
```

## Usage

```js
import { diff } from '@jsondelta/diff'

const delta = diff(
  { name: 'alice', role: 'viewer', tags: ['staff'] },
  { name: 'alice', role: 'admin', tags: ['staff', 'elevated'] }
)
// [
//   { op: 'replace', path: ['role'], old: 'viewer', new: 'admin' },
//   { op: 'add', path: ['tags', 1], value: 'elevated' }
// ]
```

The default import automatically selects the fastest available backend: native addon, WebAssembly, or pure JS fallback. You can also import a specific backend directly:

```js
import { diff } from '@jsondelta/diff/fallback'
import { diff } from '@jsondelta/diff/wasm'
```

## Real-world examples

### Tracking document changes in a collaborative editor

```js
import { diff } from '@jsondelta/diff'

const before = {
  title: 'Q1 Report',
  sections: [
    { heading: 'Revenue', body: 'Revenue grew 12% YoY.' },
    { heading: 'Costs', body: 'Operating costs remained flat.' }
  ],
  status: 'draft'
}

const after = {
  title: 'Q1 Report',
  sections: [
    { heading: 'Revenue', body: 'Revenue grew 15% YoY, beating estimates.' },
    { heading: 'Costs', body: 'Operating costs remained flat.' }
  ],
  status: 'review'
}

const changes = diff(before, after)
// [
//   { op: 'replace', path: ['sections', 0, 'body'],
//     old: 'Revenue grew 12% YoY.',
//     new: 'Revenue grew 15% YoY, beating estimates.' },
//   { op: 'replace', path: ['status'], old: 'draft', new: 'review' }
// ]
```

### Detecting configuration drift

```js
import { diff } from '@jsondelta/diff'

const expected = JSON.parse(fs.readFileSync('config.expected.json', 'utf8'))
const actual = JSON.parse(fs.readFileSync('config.actual.json', 'utf8'))

const drift = diff(expected, actual)
if (drift.length > 0) {
  console.log(`${drift.length} config values have drifted:`)
  for (const op of drift) {
    console.log(`  ${op.path.join('.')}: ${JSON.stringify(op.old)} -> ${JSON.stringify(op.new)}`)
  }
}
```

## Delta format

`diff(a, b)` returns an array of operations:

| Operation | Fields | Description |
|-----------|--------|-------------|
| `add` | `op`, `path`, `value` | A value was added at `path` |
| `remove` | `op`, `path`, `value` | A value was removed from `path` |
| `replace` | `op`, `path`, `old`, `new` | The value at `path` changed |

Paths are arrays of keys (strings for object properties, numbers for array indices). The delta is reversible - `remove` and `replace` operations include the original values.

Identical inputs return an empty array `[]`.

## How it works

The diff engine is written in Zig and compiled to WebAssembly (68KB). When loaded, it parses both JSON values, walks the structure recursively, and emits a minimal set of operations describing the differences.

The pure JS fallback implements the same algorithm for environments where WebAssembly is not available.

**Architecture:**
1. **WebAssembly** - Zig compiled to wasm32-freestanding. Near-native speed, runs in Node.js and browsers
2. **Pure JS fallback** - Zero-dependency, always works. Same algorithm, same output

## License

MIT
