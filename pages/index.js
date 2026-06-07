import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSocket } from '../lib/socket'

const defaultAuth = { username: '', password: '' }

export default function Home() {
  const [rooms, setRooms] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [name, setName] = useState('Player')
  const [account, setAccount] = useState(null)
  const [token, setToken] = useState('')
  const [auth, setAuth] = useState(defaultAuth)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [creatingTournament, setCreatingTournament] = useState(false)
  const [roomError, setRoomError] = useState(null)
  const [tournamentForm, setTournamentForm] = useState({ name: 'Championship', maxPlayers: 4 })
  const API = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:3001'

  const refreshLists = async () => {
    const [roomsRes, tournamentsRes, leaderboardRes] = await Promise.all([
      fetch(`${API}/rooms`),
      fetch(`${API}/tournaments`),
      fetch(`${API}/leaderboard`),
    ])
    const roomsData = await roomsRes.json()
    const tournamentsData = await tournamentsRes.json()
    const leaderboardData = await leaderboardRes.json()
    setRooms(roomsData)
    setTournaments(tournamentsData)
    setLeaderboard(leaderboardData.users || [])
  }

  const loadAccount = async (storedToken) => {
    if (!storedToken) return
    try {
      const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
      if (!res.ok) return
      const data = await res.json()
      setAccount(data.user)
      setName(data.user.username)
      setToken(storedToken)
    } catch (error) {
      console.error('Failed to load account', error)
    }
  }

  useEffect(() => {
    const storedToken = window.localStorage.getItem('taash_token') || ''
    setToken(storedToken)
    loadAccount(storedToken)
    refreshLists()

    const socket = getSocket()
    socket.emit('listRooms')
    socket.on('rooms', (data) => setRooms(data))

    return () => {
      socket.off('rooms')
    }
  }, [])

  const submitAuth = async (mode) => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      const res = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auth),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      window.localStorage.setItem('taash_token', data.token)
      setToken(data.token)
      setAccount(data.user)
      setName(data.user.username)
      await refreshLists()
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const logout = () => {
    window.localStorage.removeItem('taash_token')
    setToken('')
    setAccount(null)
    setName('Player')
  }

  const createRoom = async () => {
    setCreatingRoom(true)
    setRoomError(null)
    try {
      const res = await fetch(`${API}/rooms`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      window.location.href = `/room/${data.id}?name=${encodeURIComponent(name)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    } catch (error) {
      setRoomError(error.message)
    } finally {
      setCreatingRoom(false)
    }
  }

  const createTournament = async () => {
    setCreatingTournament(true)
    setRoomError(null)
    try {
      const res = await fetch(`${API}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tournamentForm.name,
          maxPlayers: Number(tournamentForm.maxPlayers),
          token,
          hostName: account?.username || name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`)
      window.location.href = `/room/${data.id}?name=${encodeURIComponent(account?.username || name)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    } catch (error) {
      setRoomError(error.message)
    } finally {
      setCreatingTournament(false)
    }
  }

  const displayName = account?.username || name

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="card-hero overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)] pointer-events-none" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] p-6 md:p-8">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="seat-chip">Real-time multiplayer</span>
                <span className="seat-chip">Tournaments</span>
                <span className="seat-chip">Rankings</span>
                <span className="seat-chip">Mobile ready</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-orange-200/90">Bhabhi Online</p>
                <h1 className="mt-3 text-4xl sm:text-5xl font-black leading-tight text-white max-w-2xl">
                  A premium card-table experience for casual rooms, tournaments, and personal rankings.
                </h1>
                <p className="mt-4 text-slate-300 max-w-2xl text-base sm:text-lg leading-7">
                  Sign in to keep your own account, launch a tournament with a participant cap, and follow the leaderboard in a UI that feels like a live table rather than a form app.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="stat-tile">
                  <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">Current player</div>
                  <div className="mt-2 text-xl font-semibold text-white">{displayName}</div>
                </div>
                <div className="stat-tile">
                  <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">Wins</div>
                  <div className="mt-2 text-xl font-semibold text-emerald-300">{account ? account.wins : 'Guest'}</div>
                </div>
                <div className="stat-tile">
                  <div className="text-xs text-slate-400 uppercase tracking-[0.2em]">Tournament points</div>
                  <div className="mt-2 text-xl font-semibold text-orange-300">{account ? account.tournamentPoints : 0}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="panel p-4 md:p-5">
                <div className="text-sm text-slate-400">Account status</div>
                <div className="mt-1 text-2xl font-bold text-white">{account ? 'Signed in' : 'Guest mode'}</div>
                <div className="mt-3 text-sm text-slate-300 leading-6">
                  {account ? 'Your profile, wins, and tournament ranking are tied to this account.' : 'Create an account to keep your own ranking and tournament history.'}
                </div>
              </div>
              <div className="panel p-4 md:p-5">
                <div className="text-sm text-slate-400">Lobby highlights</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Casual room</span><span className="text-orange-300">Instant play</span></div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Tournament room</span><span className="text-emerald-300">Participant cap</span></div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Ranking board</span><span className="text-sky-300">Wins + points</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold text-white">Account</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Login options</span>
              </div>
              <div className="grid gap-3">
                <input
                  value={auth.username}
                  onChange={e => setAuth(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Username"
                  className="w-full p-3 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:ring-2 focus:ring-orange-400/70"
                />
                <input
                  value={auth.password}
                  onChange={e => setAuth(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password"
                  type="password"
                  className="w-full p-3 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:ring-2 focus:ring-orange-400/70"
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => submitAuth('login')} disabled={authBusy} className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-950 font-semibold disabled:opacity-60">{authBusy ? 'Working…' : 'Login'}</button>
                  <button onClick={() => submitAuth('register')} disabled={authBusy} className="px-4 py-2 rounded-2xl bg-orange-500 text-white font-semibold disabled:opacity-60">Create Account</button>
                  {account && <button onClick={logout} className="px-4 py-2 rounded-2xl bg-slate-800 text-white">Logout</button>}
                </div>
                {authError && <div className="text-red-300 text-sm">{authError}</div>}
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold text-white">Create room</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Casual or tournament</span>
              </div>
              <div className="space-y-3">
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:ring-2 focus:ring-orange-400/70" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={createRoom} disabled={creatingRoom} className="px-4 py-3 bg-orange-500 text-white rounded-2xl font-semibold disabled:opacity-60">{creatingRoom ? 'Creating…' : 'Create Casual Room'}</button>
                  <button onClick={createTournament} disabled={creatingTournament} className="px-4 py-3 bg-emerald-500 text-white rounded-2xl font-semibold disabled:opacity-60">{creatingTournament ? 'Creating…' : 'Create Tournament'}</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={tournamentForm.name} onChange={e => setTournamentForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Tournament name" className="w-full p-3 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/70" />
                  <input value={tournamentForm.maxPlayers} onChange={e => setTournamentForm(prev => ({ ...prev, maxPlayers: e.target.value }))} type="number" min="2" max="12" className="w-full p-3 rounded-2xl bg-slate-950/70 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/70" />
                </div>
                {roomError && <div className="text-red-300 text-sm">{roomError}</div>}
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Active rooms</h2>
                  <p className="text-sm text-slate-400">Join a live table or jump into a tournament lobby.</p>
                </div>
                <button onClick={refreshLists} className="text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10">Refresh</button>
              </div>
              <div className="grid gap-3">
                {rooms.length===0 && <div className="text-slate-400">No active rooms</div>}
                {rooms.map(room => (
                  <div key={room.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{room.mode === 'tournament' ? room.tournamentName || 'Tournament' : 'Room'} {room.id}</div>
                      <div className="text-sm text-slate-400">
                        {room.mode === 'tournament' ? `Tournament • ${room.players.length}/${room.maxPlayers} players` : `Players: ${room.players.length}`}
                      </div>
                    </div>
                    <Link href={`/room/${room.id}?name=${encodeURIComponent(displayName)}${token ? `&token=${encodeURIComponent(token)}` : ''}`} className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-950 font-semibold">Join</Link>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Leaderboard</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Ranked by wins</span>
              </div>
              <div className="space-y-3">
                {leaderboard.length === 0 && <div className="text-slate-400">No ranking data yet</div>}
                {leaderboard.slice(0, 10).map((player, index) => (
                  <div key={player.username} className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">#{index + 1} {player.username}</div>
                      <div className="text-xs text-slate-400">Games: {player.gamesPlayed} • Tournament wins: {player.tournamentWins}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-orange-300">Wins {player.wins}</div>
                      <div className="text-xs text-slate-400">Points {player.tournamentPoints}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Tournaments</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Participant cap</span>
              </div>
              <div className="space-y-3">
                {tournaments.length === 0 && <div className="text-slate-400">No active tournaments yet</div>}
                {tournaments.map(tournament => (
                  <div key={tournament.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="font-semibold text-white">{tournament.tournamentName || tournament.id}</div>
                    <div className="text-sm text-slate-400 mt-1">{tournament.players.length}/{tournament.maxPlayers} players</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Link href={`/room/${tournament.id}?name=${encodeURIComponent(displayName)}${token ? `&token=${encodeURIComponent(token)}` : ''}`} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-950 font-semibold">Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
