import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSocket } from '../lib/socket'

export default function Home() {
  const [rooms, setRooms] = useState([])
  const [name, setName] = useState('Player')

  useEffect(() => {
    const s = getSocket()
    s.emit('listRooms')
    s.on('rooms', (r) => setRooms(r))
    return () => { s.off('rooms') }
  }, [])

  const createRoom = async () => {
    const res = await fetch('http://localhost:3001/rooms', { method: 'POST' })
    const data = await res.json()
    window.location.href = `/room/${data.id}?name=${encodeURIComponent(name)}`
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-4">Bhabhi — Real-time</h1>
      <div className="w-full max-w-xl card">
        <div className="mb-4">Your name</div>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 rounded border" />
        <div className="flex gap-2 mt-4">
          <button onClick={createRoom} className="px-4 py-2 bg-orange-500 text-white rounded">Create Room</button>
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
              <Link href={`/room/${r.id}?name=${encodeURIComponent(name)}`}>
                <a className="px-3 py-1 bg-slate-800 text-white rounded">Join</a>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
