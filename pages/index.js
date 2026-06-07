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
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="card">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-orange-300">Bhabhi Online</p>
                <h1 className="text-4xl font-bold mt-2">Real-time rooms, tournaments, and rankings</h1>
                <p className="text-slate-400 mt-3 max-w-2xl">
                  Sign in to keep your own profile, create a tournament with a fixed participant limit, and track wins on the leaderboard.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 min-w-[220px]">
                <div className="text-sm text-slate-400">Current player</div>
                <div className="text-xl font-semibold">{displayName}</div>
                <div className="text-sm text-slate-400 mt-1">{account ? `Wins: ${account.wins} • Tournament points: ${account.tournamentPoints}` : 'Guest mode'}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Account</h2>
              <div className="grid gap-3">
                <input
                  value={auth.username}
                  onChange={e => setAuth(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Username"
                  className="w-full p-3 rounded-xl bg-slate-950/70 border border-white/10"
                />
                <input
                  value={auth.password}
                  onChange={e => setAuth(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password"
                  type="password"
                  className="w-full p-3 rounded-xl bg-slate-950/70 border border-white/10"
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => submitAuth('login')} disabled={authBusy} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-950 font-semibold disabled:opacity-60">{authBusy ? 'Working…' : 'Login'}</button>
                  <button onClick={() => submitAuth('register')} disabled={authBusy} className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold disabled:opacity-60">Create Account</button>
                  {account && <button onClick={logout} className="px-4 py-2 rounded-xl bg-slate-800 text-white">Logout</button>}
                </div>
                {authError && <div className="text-red-400 text-sm">{authError}</div>}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Create Room</h2>
              <div className="space-y-3">
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 rounded-xl bg-slate-950/70 border border-white/10" />
                <button onClick={createRoom} disabled={creatingRoom} className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-60">{creatingRoom ? 'Creating…' : 'Create Casual Room'}</button>
                <button onClick={createTournament} disabled={creatingTournament} className="w-full px-4 py-3 bg-emerald-500 text-white rounded-xl font-semibold disabled:opacity-60">{creatingTournament ? 'Creating…' : 'Create Tournament'}</button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={tournamentForm.name} onChange={e => setTournamentForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Tournament name" className="w-full p-3 rounded-xl bg-slate-950/70 border border-white/10" />
                  <input value={tournamentForm.maxPlayers} onChange={e => setTournamentForm(prev => ({ ...prev, maxPlayers: e.target.value }))} type="number" min="2" max="12" className="w-full p-3 rounded-xl bg-slate-950/70 border border-white/10" />
                </div>
                {roomError && <div className="text-red-400 text-sm">{roomError}</div>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">Active Rooms</h2>
              <button onClick={refreshLists} className="text-sm px-3 py-2 rounded-lg bg-slate-800">Refresh</button>
            </div>
            <div className="grid gap-3">
              {rooms.length===0 && <div className="text-slate-400">No active rooms</div>}
              {rooms.map(room => (
                <div key={room.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{room.mode === 'tournament' ? room.tournamentName || 'Tournament' : 'Room'} {room.id}</div>
                    <div className="text-sm text-slate-400">
                      {room.mode === 'tournament' ? `Tournament • ${room.players.length}/${room.maxPlayers} players` : `Players: ${room.players.length}`}
                    </div>
                  </div>
                  <Link href={`/room/${room.id}?name=${encodeURIComponent(displayName)}${token ? `&token=${encodeURIComponent(token)}` : ''}`} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-950 font-semibold">Join</Link>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
            <div className="space-y-3">
              {leaderboard.length === 0 && <div className="text-slate-400">No ranking data yet</div>}
              {leaderboard.slice(0, 10).map((player, index) => (
                <div key={player.username} className="rounded-xl bg-slate-950/60 border border-white/10 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">#{index + 1} {player.username}</div>
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
            <h2 className="text-xl font-semibold mb-4">Tournaments</h2>
            <div className="space-y-3">
              {tournaments.length === 0 && <div className="text-slate-400">No active tournaments yet</div>}
              {tournaments.map(tournament => (
                <div key={tournament.id} className="rounded-xl bg-slate-950/60 border border-white/10 p-3">
                  <div className="font-semibold">{tournament.tournamentName || tournament.id}</div>
                  <div className="text-sm text-slate-400">{tournament.players.length}/{tournament.maxPlayers} players</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Link href={`/room/${tournament.id}?name=${encodeURIComponent(displayName)}${token ? `&token=${encodeURIComponent(token)}` : ''}`} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
