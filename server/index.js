const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

const PORT = process.env.PORT || 3001

// If REDIS_URL is provided, configure Socket.IO Redis adapter for horizontal scaling
async function setupRedisAdapter(){
  if (!process.env.REDIS_URL) return
  try{
    const { createClient } = require('redis')
    const { createAdapter } = require('@socket.io/redis-adapter')
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()
    await pubClient.connect()
    await subClient.connect()
    io.adapter(createAdapter(pubClient, subClient))
    console.log('Socket.IO Redis adapter connected')
  }catch(err){
    console.error('Failed to setup Redis adapter', err)
  }
}
setupRedisAdapter()

// Simple in-memory rooms
const rooms = {}

function makeId() { return Math.random().toString(36).slice(2,8) }

const { createDeck, shuffle, dealRoundRobin } = require('./game')

app.get('/rooms', (req,res)=>{
  const output = Object.keys(rooms).map(id=>({ id, players: rooms[id].players.map(p=>({ name:p.name })) }))
  res.json(output)
})

app.post('/rooms', (req,res)=>{
  const id = makeId()
  rooms[id] = { players: [], hands: {}, played: [], deck: [], started: false, current: 0 }
  console.log('Created room', id)
  res.json({ id })
})

io.on('connection', (socket)=>{
  console.log('socket connected', socket.id)

  socket.on('listRooms', ()=>{
    const out = Object.keys(rooms).map(id=>({ id, players: rooms[id].players }))
    socket.emit('rooms', out)
  })

  socket.on('joinRoom', ({ roomId, name })=>{
    if (!rooms[roomId]) rooms[roomId] = { players: [], hands: {}, played: [], deck: [], started: false, current: 0 }
    const room = rooms[roomId]
    const player = { id: socket.id, name, count: 0 }
    // avoid duplicate
    if (!room.players.find(p=>p.id===socket.id)) room.players.push(player)

    socket.join(roomId)
    socket.emit('joined', { roomId })

    // emit update
    io.to(roomId).emit('room:update', room)
  })

  socket.on('startGame', ({ roomId })=>{
    const room = rooms[roomId]
    if (!room) return
    if (room.started) return
    // build deck and deal equally
    const deck = createDeck()
    shuffle(deck)
    room.deck = deck
    const pcount = room.players.length
    if (pcount===0) return
    // deal round-robin
    const playerNames = room.players.map(p=>p.name)
    const hands = dealRoundRobin(deck, playerNames)
    room.hands = hands
    room.players.forEach(p=> p.count = room.hands[p.name].length)
    room.started = true
    room.current = 0
    room.trick = { leadSuit: null, plays: [] }
    room.finishedOrder = []
    io.to(roomId).emit('room:update', room)
  })

  socket.on('playCard', ({ roomId, name, card })=>{
    const room = rooms[roomId]
    if (!room || !room.started) return
    // verify turn
    const currentPlayer = room.players[room.current]
    if (!currentPlayer || currentPlayer.name !== name) return

    // simple helpers
    const suitOf = (c) => c.slice(-1)
    const rankOf = (c) => c.slice(0, c.length-1)
    const rankValue = (r) => {
      const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
      return order.indexOf(r)
    }

    // verify card exists in hand
    if (!room.hands[name] || !room.hands[name].includes(card)) return

    // enforce follow-suit
    const trick = room.trick || { leadSuit: null, plays: [] }
    const leadSuit = trick.leadSuit
    if (leadSuit){
      const hasLeadSuit = (room.hands[name]||[]).some(c=> suitOf(c) === leadSuit)
      if (hasLeadSuit && suitOf(card) !== leadSuit){
        // invalid play: player must follow suit
        socket.emit('invalidPlay', { reason: 'Must follow suit', card })
        return
      }
    } else {
      // first play of trick sets leadSuit
      trick.leadSuit = suitOf(card)
    }

    // remove card from hand and add to trick plays
    room.hands[name] = room.hands[name].filter(c=>c!==card)
    trick.plays.push({ name, card })
    room.trick = trick
    room.players.forEach(p=> p.count = room.hands[p.name]?.length || 0)

    // determine number of active players (with cards)
    const activePlayers = room.players.filter(p=> (room.hands[p.name]||[]).length>0 || p.name === name || trick.plays.some(x=>x.name===p.name))
    // if trick complete: when plays by all players who had cards at trick start have played
    const playersToPlay = room.players.filter(p=> (room.hands[p.name]||[]).length>0 || p.name===name || trick.plays.some(x=>x.name===p.name))

    // We consider trick complete when plays.length equals number of players who had cards at trick start
    // Simpler approach: assume number of plays equals number of players who are still in round (players with count>0 plus those who just played)
    const playersStill = room.players.filter(p=> (room.hands[p.name]||[]).length>0 || trick.plays.some(x=>x.name===p.name))
    const expectedPlays = playersStill.length

    if (trick.plays.length >= expectedPlays){
      // find winner: highest rank in leadSuit
      let winner = null
      let bestVal = -1
      for (const p of trick.plays){
        if (suitOf(p.card) !== trick.leadSuit) continue
        const val = rankValue(rankOf(p.card))
        if (val>bestVal){ bestVal = val; winner = p.name }
      }

      // reset trick
      room.trick = { leadSuit: null, plays: [] }

      // set next current to winner index
      const widx = room.players.findIndex(p=>p.name===winner)
      room.current = widx>=0 ? widx : room.current

      // check finished order
      room.players.forEach(p=>{
        if ((room.hands[p.name]||[]).length===0 && !room.finishedOrder.includes(p.name)){
          room.finishedOrder.push(p.name)
        }
      })

      // if only one player left with cards -> Bhabi
      const remaining = room.players.filter(p=> (room.hands[p.name]||[]).length>0)
      if (remaining.length<=1){
        room.started = false
        room.bhabi = remaining.length===1 ? remaining[0].name : null
        io.to(roomId).emit('room:update', room)
        return
      }
    } else {
      // advance to next player who has cards and hasn't played this trick
      let next = (room.current+1) % room.players.length
      for (let i=0;i<room.players.length;i++){
        const p = room.players[next]
        const hasPlayed = trick.plays.some(x=>x.name===p.name)
        if (!hasPlayed && (room.hands[p.name]||[]).length>0) break
        next = (next+1) % room.players.length
      }
      room.current = next
    }

    io.to(roomId).emit('room:update', room)
  })

  socket.on('disconnect', ()=>{
    // remove player from rooms
    for (const id of Object.keys(rooms)){
      const r = rooms[id]
      const idx = r.players.findIndex(p=>p.id===socket.id)
      if (idx>=0){
        r.players.splice(idx,1)
        io.to(id).emit('room:update', r)
      }
    }
  })
})

server.listen(PORT, ()=>console.log('Server listening on', PORT))
