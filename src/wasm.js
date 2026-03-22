import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, '..', 'wasm', 'diff.wasm')
const wasmBuffer = readFileSync(wasmPath)
const wasmModule = new WebAssembly.Module(wasmBuffer)
const wasmInstance = new WebAssembly.Instance(wasmModule)
const wasm = wasmInstance.exports

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Compute a structural diff between two JSON-compatible values using the Zig WASM engine.
 * @param {*} a - Source value
 * @param {*} b - Target value
 * @returns {Array<Object>} Array of operations describing the differences
 */
function diff(a, b) {
  const aJson = encoder.encode(JSON.stringify(a))
  const bJson = encoder.encode(JSON.stringify(b))

  const aPtr = wasm.alloc(aJson.length)
  const bPtr = wasm.alloc(bJson.length)

  if (!aPtr || !bPtr) throw new Error('wasm allocation failed')

  const mem = new Uint8Array(wasm.memory.buffer)
  mem.set(aJson, aPtr)
  mem.set(bJson, bPtr)

  const resultLen = wasm.diff(aPtr, aJson.length, bPtr, bJson.length)

  wasm.dealloc(aPtr, aJson.length)
  wasm.dealloc(bPtr, bJson.length)

  if (resultLen < 0) throw new Error('wasm diff failed')

  const resultPtr = wasm.getResultPtr()
  const resultBytes = new Uint8Array(wasm.memory.buffer.slice(resultPtr, resultPtr + resultLen))
  const result = JSON.parse(decoder.decode(resultBytes))

  wasm.freeResult()

  return result
}

export { diff }
