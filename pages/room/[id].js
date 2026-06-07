import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../../lib/socket'
import Card from '../../components/Card'

const suitOrder = ['♣', '♦', '♥', '♠']
const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function sortHand(cards){
  return [...cards].sort((left, right) => {
    const leftSuit = suitOrder.indexOf(left.slice(-1))
    const rightSuit = suitOrder.indexOf(right.slice(-1))
    if (leftSuit !== rightSuit) return leftSuit - rightSuit

    const leftRank = rankOrder.indexOf(left.slice(0, left.length - 1))
    const rightRank = rankOrder.indexOf(right.slice(0, right.length - 1))
    return leftRank - rightRank
  })
}

export default function Room() {
  const router = useRouter()
  const { id } = router.query
  const [players, setPlayers] = useState([])
  const [hand, setHand] = useState([])
  const [played, setPlayed] = useState([])
  const [name, setName] = useState('Player')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState('connecting')
  const [current, setCurrent] = useState(null)
  const [winner, setWinner] = useState(null)
  const [finished, setFinished] = useState([])
  const [bhabi, setBhabi] = useState(null)
  const [invalid, setInvalid] = useState(null)
  const [mode, setMode] = useState('casual')
  const [tournamentName, setTournamentName] = useState(null)
  const [maxPlayers, setMaxPlayers] = useState(null)
  const [standings, setStandings] = useState([])

  useEffect(() => {
    if (!id) return
    const s = getSocket()
    const params = new URLSearchParams(window.location.search)
    const playerName = params.get('name') || 'Player'
    const playerToken = params.get('token') || window.localStorage.getItem('taash_token') || ''
    setName(playerName)
    setToken(playerToken)
    s.emit('joinRoom', { roomId: id, name: playerName, token: playerToken })

    s.on('room:update', (room)=>{
      setPlayers(room.players || [])
      setHand(room.hands?.[playerName]||[])
      setPlayed(room.trick?.plays||[])
      setStatus(room.started ? 'playing' : 'waiting')
      setCurrent(room.players?.[room.current]?.name)
      setFinished(room.finishedOrder || [])
      setBhabi(room.bhabi || null)
      setWinner(room.winner || room.bhabi || null)
      setMode(room.mode || 'casual')
      setTournamentName(room.tournamentName || null)
      setMaxPlayers(room.maxPlayers || null)
      setStandings(room.standings || [])
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
          <div>
            <h2 className="text-2xl">{mode === 'tournament' ? tournamentName || 'Tournament' : 'Room'} {id}</h2>
            <div className="text-sm text-slate-400">{status} — {players.length}{maxPlayers ? `/${maxPlayers}` : ''} players</div>
          </div>
          <div>{token ? 'Signed in' : 'Guest'}</div>
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

        {mode === 'tournament' && (
          <div className="card mb-4">
            <div className="font-semibold">Tournament Ranking</div>
            <div className="mt-2 space-y-2">
              {standings.length === 0 && <div className="text-slate-400">No rankings yet</div>}
              {standings.map((entry, index) => (
                <div key={entry.username} className="flex justify-between rounded-lg bg-slate-950/60 p-3 border border-white/10">
                  <div>
                    <div className="font-semibold">#{index + 1} {entry.username}</div>
                    <div className="text-xs text-slate-400">Games: {entry.gamesPlayed}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-orange-300">Wins {entry.wins}</div>
                    <div className="text-slate-400 text-xs">Points {entry.tournamentPoints}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="font-semibold mb-2">Your Hand</div>
          <div className="flex gap-2 flex-wrap">
            {hand.length===0 && <div className="text-slate-400">No cards yet</div>}
            {sortHand(hand).map((c,i)=>(
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
