/**
 * Compute a structural diff between two JSON-compatible values.
 * @param {*} a - Source value
 * @param {*} b - Target value
 * @returns {Array<Object>} Array of operations describing the differences
 */
function diff(a, b) {
  const ops = []
  diffRecursive(a, b, [], ops)
  return ops
}

function diffRecursive(a, b, path, ops) {
  if (a === b) return

  if (a === null || b === null || typeof a !== typeof b) {
    ops.push({ op: 'replace', path, old: a, new: b })
    return
  }

  if (typeof a !== 'object') {
    if (a !== b) ops.push({ op: 'replace', path, old: a, new: b })
    return
  }

  const aIsArray = Array.isArray(a)
  const bIsArray = Array.isArray(b)

  if (aIsArray !== bIsArray) {
    ops.push({ op: 'replace', path, old: a, new: b })
    return
  }

  if (aIsArray) {
    diffArrays(a, b, path, ops)
  } else {
    diffObjects(a, b, path, ops)
  }
}

function diffArrays(a, b, path, ops) {
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    const p = [...path, i]
    if (i >= a.length) {
      ops.push({ op: 'add', path: p, value: b[i] })
    } else if (i >= b.length) {
      ops.push({ op: 'remove', path: p, value: a[i] })
    } else {
      diffRecursive(a[i], b[i], p, ops)
    }
  }
}

function diffObjects(a, b, path, ops) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  const bKeySet = new Set(bKeys)
  const aKeySet = new Set(aKeys)

  for (const key of aKeys) {
    const p = [...path, key]
    if (!bKeySet.has(key)) {
      ops.push({ op: 'remove', path: p, value: a[key] })
    } else {
      diffRecursive(a[key], b[key], p, ops)
    }
  }

  for (const key of bKeys) {
    if (!aKeySet.has(key)) {
      ops.push({ op: 'add', path: [...path, key], value: b[key] })
    }
  }
}

export { diff }
