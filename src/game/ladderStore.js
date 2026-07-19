const KEY = 'db_ladder_records_v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function save(records) {
  try { localStorage.setItem(KEY, JSON.stringify(records)) } catch {}
}

export function getRecords() { return load().slice().sort((a, b) => a.timeMs - b.timeMs) }

export function bestForCharacter(charId) {
  const rs = load().filter(r => r.char === charId)
  if (!rs.length) return null
  return rs.reduce((a, b) => a.timeMs < b.timeMs ? a : b)
}

export function addRecord({ char, timeMs, date, name }) {
  const rs = load()
  rs.push({ char, timeMs, date: date || Date.now(), name: name || null })
  // Keep only top 20 to bound storage
  rs.sort((a, b) => a.timeMs - b.timeMs)
  save(rs.slice(0, 20))
}

export function clearRecords() { save([]) }

export function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}
