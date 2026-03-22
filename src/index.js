import { diff as fallbackDiff } from './fallback.js'

let diff = fallbackDiff
let backend = 'fallback'

try {
  const native = await import('./native.js')
  diff = native.diff
  backend = 'native'
} catch {
  try {
    const wasm = await import('./wasm.js')
    diff = wasm.diff
    backend = 'wasm'
  } catch {
    // using fallback
  }
}

export { diff, backend }
