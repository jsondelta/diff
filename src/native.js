import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let binding
try {
  binding = require('../native/diff.node')
} catch {
  throw new Error('native addon not available')
}

/**
 * Compute a structural diff between two JSON-compatible values using the native Zig addon.
 * @param {*} a - Source value
 * @param {*} b - Target value
 * @returns {Array<Object>} Array of operations describing the differences
 */
function diff(a, b) {
  return JSON.parse(binding.diff(JSON.stringify(a), JSON.stringify(b)))
}

export { diff }
