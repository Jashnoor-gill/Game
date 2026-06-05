import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../../lib/socket'
import Card from '../../components/Card'

export default function Room() {
  const router = useRouter()
  const { id } = router.query
  const [players, setPlayers] = useState([])
  const [hand, setHand] = useState([])
  const [played, setPlayed] = useState([])
  const [name, setName] = useState('Player')
  const [status, setStatus] = useState('connecting')
  const [current, setCurrent] = useState(null)
  const [winner, setWinner] = useState(null)
  const [finished, setFinished] = useState([])
  const [bhabi, setBhabi] = useState(null)
  const [invalid, setInvalid] = useState(null)

  useEffect(() => {
    if (!id) return
    const s = getSocket()
    const params = new URLSearchParams(window.location.search)
    const playerName = params.get('name') || 'Player'
    setName(playerName)
    s.emit('joinRoom', { roomId: id, name: playerName })

    s.on('room:update', (room)=>{
      setPlayers(room.players || [])
      setHand(room.hands?.[playerName]||[])
      setPlayed(room.trick?.plays||[])
      setStatus(room.started ? 'playing' : 'waiting')
      setCurrent(room.players?.[room.current]?.name)
      setFinished(room.finishedOrder || [])
      setBhabi(room.bhabi || null)
      setWinner(room.winner || room.bhabi || null)
    })

    s.on('invalidPlay', ({ reason })=>{
      setInvalid(reason)
      setTimeout(()=>setInvalid(null), 2500)
    })

    s.on('joined', ()=>setStatus('joined'))

    return ()=>{
      s.off('room:update')
      s.off('joined')
    }
  }, [id])

  const playCard = (card) => {
    if (current !== name) return
    const s = getSocket()
    s.emit('playCard', { roomId: id, name, card })
  }

  const startGame = () => {
    const s = getSocket()
    s.emit('startGame', { roomId: id })
  }

  return (
    <div className="min-h-screen p-6">
      {invalid && (
        <div className="fixed top-6 right-6 bg-red-600 text-white px-3 py-2 rounded shadow">{invalid}</div>
      )}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl">Room {id}</h2>
          <div>{status} — {players.length} players</div>
        </div>

        <div className="card mb-4">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Table</div>
            <div>{winner ? `Winner: ${winner}` : `Turn: ${current || '—'}`}</div>
          </div>
          <div className="mt-2 flex gap-4 items-center">
            {played.map((p,i)=>(<div key={i} className="p-2 bg-slate-100 text-slate-900 rounded">{p.name}: {p.card}</div>))}
          </div>
        </div>

        <div className="card mb-4">
          <div className="font-semibold">Players</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {players.map((p,idx)=>(
              <div key={p.id} className="p-2 bg-slate-800 rounded">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-slate-400">Cards: {p.count}</div>
              </div>
            ))}
          </div>
          {finished.length>0 && (
            <div className="mt-3 text-sm text-slate-400">Finished: {finished.join(', ')}</div>
          )}
          {bhabi && (
            <div className="mt-2 text-orange-400 font-semibold">Bhabi: {bhabi}</div>
          )}
        </div>

        <div className="card">
          <div className="font-semibold mb-2">Your Hand</div>
          <div className="flex gap-2 flex-wrap">
            {hand.length===0 && <div className="text-slate-400">No cards yet</div>}
            {hand.map((c,i)=>(
              <Card key={i} card={c} onPlay={playCard} disabled={current!==name} />
            ))}
          </div>
          <div className="mt-4">
            <button onClick={startGame} className="px-3 py-2 bg-green-600 rounded text-white">Start Game</button>
          </div>
        </div>
      </div>
    </div>
  )
}
