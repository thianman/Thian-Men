import React from 'react'

// Overlay touch controls for mobile players. Writes to a ref-backed state
// object; the parent's input sender merges these with keyboard state.
export function TouchControls({ touchRef }) {
  const btn = 'w-16 h-16 rounded-full bg-white/25 active:bg-white/45 border border-white/40 text-white text-xl font-bold flex items-center justify-center touch-none select-none shadow-lg'
  const setKey = (key, on) => { touchRef.current[key] = on }
  const oncePress = (key) => { touchRef.current[key + 'Once'] = true }

  const hold = (key) => ({
    onTouchStart: (e) => { e.preventDefault(); setKey(key, true) },
    onTouchEnd:   (e) => { e.preventDefault(); setKey(key, false) },
    onTouchCancel:(e) => { e.preventDefault(); setKey(key, false) },
    onMouseDown:  (e) => { e.preventDefault(); setKey(key, true) },
    onMouseUp:    (e) => { e.preventDefault(); setKey(key, false) },
    onMouseLeave: (e) => { setKey(key, false) },
  })
  const tap = (key) => ({
    onTouchStart: (e) => { e.preventDefault(); oncePress(key) },
    onMouseDown:  (e) => { e.preventDefault(); oncePress(key) },
  })

  return (
    <>
      {/* Left side: D-pad */}
      <div className="fixed bottom-4 left-4 z-30 pointer-events-auto">
        <div className="flex flex-col items-center gap-1">
          <button className={btn} {...hold('jump')}>▲</button>
          <div className="flex gap-1">
            <button className={btn} {...hold('left')}>◀</button>
            <button className={btn} {...hold('duck')}>▼</button>
            <button className={btn} {...hold('right')}>▶</button>
          </div>
        </div>
      </div>
      {/* Right side: action buttons */}
      <div className="fixed bottom-4 right-4 z-30 pointer-events-auto">
        <div className="flex flex-col items-center gap-2">
          <button className={btn + ' bg-red-500/40'} {...hold('throwHeld')}>THR</button>
          <button className={btn + ' bg-green-500/40'} {...tap('catchPressed')}>CATCH</button>
        </div>
      </div>
    </>
  )
}

export function isMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
}
