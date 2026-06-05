import { io } from 'socket.io-client'

let socket
export function getSocket() {
  if (!socket) {
    const url = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:3001'
    socket = io(url)
  }
  return socket
}
