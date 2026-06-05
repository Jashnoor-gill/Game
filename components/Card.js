import React from 'react'

export default function Card({ card, onPlay, disabled }){
  const handleKey = (e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') onPlay && onPlay(card)
  }

  const suit = card ? card.slice(-1) : ''
  const rank = card ? card.slice(0, card.length-1) : ''

  return (
    <button
      role="button"
      aria-label={card ? `Play ${card}` : 'Empty card'}
      tabIndex={0}
      onClick={()=>!disabled && onPlay && onPlay(card)}
      onKeyDown={handleKey}
      className={`card-face w-20 h-28 flex flex-col items-center justify-center rounded-lg shadow-md select-none focus:outline-none focus:ring-2 focus:ring-orange-400 ${disabled? 'opacity-60 pointer-events-none':''}`}
    >
      <div className="text-sm text-slate-500">{rank}</div>
      <div className="text-2xl">{suit}</div>
    </button>
  )
}
