import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert'
import { diff as diffFallback } from '../src/fallback.js'

let diffWasm
try { ({ diff: diffWasm } = await import('../src/wasm.js')) } catch {}

let diffNative
try { ({ diff: diffNative } = await import('../src/native.js')) } catch {}

const backends = [
  ['fallback', diffFallback],
  ...(diffWasm ? [['wasm', diffWasm]] : []),
  ...(diffNative ? [['native', diffNative]] : []),
]

for (const [name, diff] of backends) {
  describe(`diff (${name})`, () => {

    describe('identical values', () => {
      it('identical primitives', () => {
        deepStrictEqual(diff(1, 1), [])
        deepStrictEqual(diff('hello', 'hello'), [])
        deepStrictEqual(diff(true, true), [])
        deepStrictEqual(diff(null, null), [])
      })

      it('identical objects', () => {
        deepStrictEqual(diff({ a: 1, b: 2 }, { a: 1, b: 2 }), [])
      })

      it('identical arrays', () => {
        deepStrictEqual(diff([1, 2, 3], [1, 2, 3]), [])
      })

      it('identical nested structures', () => {
        const val = { a: [1, { b: true }], c: null }
        deepStrictEqual(diff(val, JSON.parse(JSON.stringify(val))), [])
      })

      it('empty objects', () => {
        deepStrictEqual(diff({}, {}), [])
      })

      it('empty arrays', () => {
        deepStrictEqual(diff([], []), [])
      })
    })

    describe('primitive changes', () => {
      it('number to different number', () => {
        deepStrictEqual(diff(1, 2), [
          { op: 'replace', path: [], old: 1, new: 2 }
        ])
      })

      it('string to different string', () => {
        deepStrictEqual(diff('a', 'b'), [
          { op: 'replace', path: [], old: 'a', new: 'b' }
        ])
      })

      it('boolean change', () => {
        deepStrictEqual(diff(true, false), [
          { op: 'replace', path: [], old: true, new: false }
        ])
      })
    })

    describe('type changes', () => {
      it('number to string', () => {
        deepStrictEqual(diff(1, 'one'), [
          { op: 'replace', path: [], old: 1, new: 'one' }
        ])
      })

      it('null to object', () => {
        deepStrictEqual(diff(null, { a: 1 }), [
          { op: 'replace', path: [], old: null, new: { a: 1 } }
        ])
      })

      it('array to object', () => {
        deepStrictEqual(diff([1, 2], { a: 1 }), [
          { op: 'replace', path: [], old: [1, 2], new: { a: 1 } }
        ])
      })

      it('object to array', () => {
        deepStrictEqual(diff({ a: 1 }, [1, 2]), [
          { op: 'replace', path: [], old: { a: 1 }, new: [1, 2] }
        ])
      })

      it('object to null', () => {
        deepStrictEqual(diff({ a: 1 }, null), [
          { op: 'replace', path: [], old: { a: 1 }, new: null }
        ])
      })
    })

    describe('object diffs', () => {
      it('added key', () => {
        deepStrictEqual(diff({ a: 1 }, { a: 1, b: 2 }), [
          { op: 'add', path: ['b'], value: 2 }
        ])
      })

      it('removed key', () => {
        deepStrictEqual(diff({ a: 1, b: 2 }, { a: 1 }), [
          { op: 'remove', path: ['b'], value: 2 }
        ])
      })

      it('changed value', () => {
        deepStrictEqual(diff({ a: 1 }, { a: 2 }), [
          { op: 'replace', path: ['a'], old: 1, new: 2 }
        ])
      })

      it('multiple changes', () => {
        const result = diff(
          { a: 1, b: 2, c: 3 },
          { a: 1, b: 99, d: 4 }
        )
        const ops = new Map(result.map(op => [op.path.join('.'), op]))
        deepStrictEqual(ops.get('b'), { op: 'replace', path: ['b'], old: 2, new: 99 })
        deepStrictEqual(ops.get('c'), { op: 'remove', path: ['c'], value: 3 })
        deepStrictEqual(ops.get('d'), { op: 'add', path: ['d'], value: 4 })
      })

      it('nested object change', () => {
        deepStrictEqual(
          diff({ a: { b: 1 } }, { a: { b: 2 } }),
          [{ op: 'replace', path: ['a', 'b'], old: 1, new: 2 }]
        )
      })

      it('deeply nested change', () => {
        deepStrictEqual(
          diff({ a: { b: { c: { d: 1 } } } }, { a: { b: { c: { d: 2 } } } }),
          [{ op: 'replace', path: ['a', 'b', 'c', 'd'], old: 1, new: 2 }]
        )
      })
    })

    describe('array diffs', () => {
      it('appended element', () => {
        deepStrictEqual(diff([1, 2], [1, 2, 3]), [
          { op: 'add', path: [2], value: 3 }
        ])
      })

      it('removed last element', () => {
        deepStrictEqual(diff([1, 2, 3], [1, 2]), [
          { op: 'remove', path: [2], value: 3 }
        ])
      })

      it('changed element', () => {
        deepStrictEqual(diff([1, 2, 3], [1, 99, 3]), [
          { op: 'replace', path: [1], old: 2, new: 99 }
        ])
      })

      it('nested array change', () => {
        deepStrictEqual(
          diff([[1, 2], [3, 4]], [[1, 2], [3, 99]]),
          [{ op: 'replace', path: [1, 1], old: 4, new: 99 }]
        )
      })

      it('array of objects', () => {
        deepStrictEqual(
          diff([{ a: 1 }], [{ a: 2 }]),
          [{ op: 'replace', path: [0, 'a'], old: 1, new: 2 }]
        )
      })
    })

    describe('mixed structures', () => {
      it('object containing arrays', () => {
        deepStrictEqual(
          diff({ items: [1, 2] }, { items: [1, 2, 3] }),
          [{ op: 'add', path: ['items', 2], value: 3 }]
        )
      })

      it('array containing objects with changes', () => {
        const a = [{ name: 'alice', age: 30 }, { name: 'bob', age: 25 }]
        const b = [{ name: 'alice', age: 31 }, { name: 'bob', age: 25 }]
        deepStrictEqual(diff(a, b), [
          { op: 'replace', path: [0, 'age'], old: 30, new: 31 }
        ])
      })

      it('complex nested diff', () => {
        const a = {
          users: [
            { id: 1, name: 'alice', tags: ['admin'] },
            { id: 2, name: 'bob', tags: ['user'] }
          ],
          meta: { version: 1 }
        }
        const b = {
          users: [
            { id: 1, name: 'alice', tags: ['admin', 'super'] },
            { id: 2, name: 'robert', tags: ['user'] }
          ],
          meta: { version: 2 }
        }
        const result = diff(a, b)
        const ops = new Map(result.map(op => [op.path.join('.'), op]))

        deepStrictEqual(ops.get('users.0.tags.1'), { op: 'add', path: ['users', 0, 'tags', 1], value: 'super' })
        deepStrictEqual(ops.get('users.1.name'), { op: 'replace', path: ['users', 1, 'name'], old: 'bob', new: 'robert' })
        deepStrictEqual(ops.get('meta.version'), { op: 'replace', path: ['meta', 'version'], old: 1, new: 2 })
      })
    })

    describe('edge cases', () => {
      it('empty string', () => {
        deepStrictEqual(diff('', 'a'), [
          { op: 'replace', path: [], old: '', new: 'a' }
        ])
      })

      it('zero', () => {
        deepStrictEqual(diff(0, 1), [
          { op: 'replace', path: [], old: 0, new: 1 }
        ])
      })

      it('added complex value', () => {
        deepStrictEqual(diff({}, { a: { b: [1, 2] } }), [
          { op: 'add', path: ['a'], value: { b: [1, 2] } }
        ])
      })

      it('removed complex value', () => {
        deepStrictEqual(diff({ a: { b: [1, 2] } }, {}), [
          { op: 'remove', path: ['a'], value: { b: [1, 2] } }
        ])
      })
    })
  })
}
