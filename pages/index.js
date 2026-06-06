import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSocket } from '../lib/socket'

export default function Home() {
  const [rooms, setRooms] = useState([])
  const [name, setName] = useState('Player')
  const API = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:3001'
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSocket()
    s.emit('listRooms')
    s.on('rooms', (r) => setRooms(r))
    return () => { s.off('rooms') }
  }, [])

  const createRoom = async () => {
    setCreating(true)
    setError(null)
    console.log('Creating room via', API)
    try{
      const res = await fetch(`${API}/rooms`, { method: 'POST' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      window.location.href = `/room/${data.id}?name=${encodeURIComponent(name)}`
    }catch(err){
      console.error('Create room failed', err)
      setError(err.message)
      alert('Create room failed: '+err.message)
    }finally{
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-4">Bhabhi — Real-time</h1>
      <div className="w-full max-w-xl card">
        <div className="mb-4">Your name</div>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 rounded border" />
        <div className="flex gap-2 mt-4">
          <button onClick={createRoom} disabled={creating} className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-60">{creating? 'Creating…':'Create Room'}</button>
          {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
        </div>
      </div>

      <div className="w-full max-w-xl mt-6">
        <h2 className="text-xl mb-2">Active Rooms</h2>
        <div className="grid gap-3">
          {rooms.length===0 && <div className="card">No active rooms</div>}
          {rooms.map(r => (
            <div key={r.id} className="card flex justify-between items-center">
              <div>
                <div className="font-semibold">Room {r.id}</div>
                <div className="text-sm text-slate-500">Players: {r.players.length}</div>
              </div>
              <Link href={`/room/${r.id}?name=${encodeURIComponent(name)}`} className="px-3 py-1 bg-slate-800 text-white rounded">Join</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
