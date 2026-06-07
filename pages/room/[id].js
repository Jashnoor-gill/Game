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

  const leaveRoom = () => {
    const s = getSocket()
    s.emit('leaveRoom', { roomId: id })
    router.push('/')
  }

  const declareLoser = () => {
    const s = getSocket()
    s.emit('declareLoser', { roomId: id })
  }

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      {invalid && (
        <div className="fixed top-6 right-6 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 z-50">{invalid}</div>
      )}
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="card-hero p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="seat-chip">{mode === 'tournament' ? 'Tournament table' : 'Casual table'}</span>
                <span className="seat-chip">{token ? 'Signed in' : 'Guest'}</span>
                <span className="seat-chip">{status === 'playing' ? 'Live hand' : 'Waiting room'}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {mode === 'tournament' ? tournamentName || 'Tournament' : 'Room'} {id}
              </h2>
              <p className="mt-3 text-slate-300 max-w-2xl leading-7">
                The table is centered, the current turn is highlighted, and the hand is sorted so play feels like a proper card room.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
              <div className="stat-tile">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Players</div>
                <div className="mt-2 text-2xl font-bold text-white">{players.length}{maxPlayers ? `/${maxPlayers}` : ''}</div>
              </div>
              <div className="stat-tile">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Turn</div>
                <div className="mt-2 text-lg font-semibold text-orange-300 truncate">{winner ? `Winner: ${winner}` : current || '—'}</div>
              </div>
              <div className="stat-tile col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Mode</div>
                <div className="mt-2 text-lg font-semibold text-emerald-300 capitalize">{mode}</div>
              </div>
              <div className="stat-tile col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={leaveRoom} className="px-3 py-2 rounded-2xl bg-slate-800 text-white font-semibold">Exit Room</button>
                  <button onClick={declareLoser} className="px-3 py-2 rounded-2xl bg-red-500 text-white font-semibold">Declare Loser</button>
                  <button onClick={startGame} className="px-3 py-2 rounded-2xl bg-emerald-500 text-white font-semibold">Start New Game</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr] items-start">
          <div className="space-y-5">
            <section className="table-scene rounded-[2rem] p-5 md:p-6 relative overflow-hidden min-h-[420px]">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="font-semibold text-white">Table</div>
                <div className="text-sm text-slate-300">{winner ? `Winner: ${winner}` : `Turn: ${current || '—'}`}</div>
              </div>

              <div className="relative mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.1fr_0.95fr] items-stretch">
                <div className="space-y-3">
                  <div className="seat-chip w-fit">Left seat</div>
                  {players[0] && (
                    <div className="panel p-4 min-h-[92px] flex flex-col justify-between">
                      <div className="font-semibold text-white">{players[0].name}</div>
                      <div className="text-sm text-slate-400">Cards: {players[0].count}</div>
                    </div>
                  )}
                  {players[1] && (
                    <div className="panel p-4 min-h-[92px] flex flex-col justify-between">
                      <div className="font-semibold text-white">{players[1].name}</div>
                      <div className="text-sm text-slate-400">Cards: {players[1].count}</div>
                    </div>
                  )}
                </div>

                <div className="panel p-4 md:p-5 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Played cards</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {played.length === 0 && <div className="text-slate-400">No cards on the table yet</div>}
                      {played.map((p,i)=>(
                        <div key={i} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-lg">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{p.name}</div>
                          <div className="mt-1 text-lg font-semibold text-white">{p.card}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-sm text-slate-400">Current flow</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {current ? `${current} to play` : 'Waiting for the next hand'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="seat-chip w-fit ml-auto">Right seat</div>
                  {players[2] && (
                    <div className="panel p-4 min-h-[92px] flex flex-col justify-between">
                      <div className="font-semibold text-white">{players[2].name}</div>
                      <div className="text-sm text-slate-400">Cards: {players[2].count}</div>
                    </div>
                  )}
                  {players[3] && (
                    <div className="panel p-4 min-h-[92px] flex flex-col justify-between">
                      <div className="font-semibold text-white">{players[3].name}</div>
                      <div className="text-sm text-slate-400">Cards: {players[3].count}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xl font-semibold text-white">Your hand</div>
                  <div className="text-sm text-slate-400">Cards are automatically grouped by suit and rank.</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={leaveRoom} className="px-4 py-2 bg-slate-800 rounded-2xl text-white font-semibold">Exit Room</button>
                  <button onClick={declareLoser} className="px-4 py-2 bg-red-500 rounded-2xl text-white font-semibold">Declare Loser</button>
                  <button onClick={startGame} className="px-4 py-2 bg-emerald-500 rounded-2xl text-white font-semibold">Start New Game</button>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {hand.length===0 && <div className="text-slate-400">No cards yet</div>}
                {sortHand(hand).map((c,i)=>(
                  <Card key={i} card={c} onPlay={playCard} disabled={current!==name} />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="card">
              <div className="font-semibold text-white">Players</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {players.map((p)=>(
                  <div key={p.id} className={`rounded-2xl border p-3 ${p.name === current ? 'border-orange-400/60 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-white truncate">{p.name}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{p.name === current ? 'Active' : 'Seat'}</div>
                    </div>
                    <div className="text-sm text-slate-400 mt-2">Cards: {p.count}</div>
                  </div>
                ))}
              </div>
              {finished.length>0 && <div className="mt-4 text-sm text-slate-400">Finished: {finished.join(', ')}</div>}
              {bhabi && <div className="mt-2 text-orange-300 font-semibold">Bhabi: {bhabi}</div>}
            </section>

            {mode === 'tournament' && (
              <section className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold text-white">Tournament ranking</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Points + wins</div>
                </div>
                <div className="space-y-2">
                  {standings.length === 0 && <div className="text-slate-400">No rankings yet</div>}
                  {standings.map((entry, index) => (
                    <div key={entry.username} className="rounded-2xl bg-white/5 border border-white/10 p-3 flex justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">#{index + 1} {entry.username}</div>
                        <div className="text-xs text-slate-400">Games: {entry.gamesPlayed}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-orange-300">Wins {entry.wins}</div>
                        <div className="text-slate-400 text-xs">Points {entry.tournamentPoints}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
