const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const crypto = require('crypto')

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
const users = {}
const tournaments = {}
const tokens = {}

function makeId() { return Math.random().toString(36).slice(2,8) }
function makeToken() { return crypto.randomUUID() }

function createEmptyRoom({ mode = 'casual', maxPlayers = 8, tournamentName = null, host = null } = {}){
  return {
    players: [],
    hands: {},
    played: [],
    deck: [],
    started: false,
    current: 0,
    mode,
    maxPlayers,
    tournamentName,
    host,
    tournament: tournamentName ? { name: tournamentName, standings: {}, rounds: 0 } : null,
  }
}

function getAccountFromToken(token){
  if (!token) return null
  const username = tokens[token]
  return username ? users[username] : null
}

function upsertAccount(username, password){
  const existing = users[username]
  if (existing){
    if (existing.password !== password) return null
    return existing
  }
  const account = {
    username,
    password,
    wins: 0,
    gamesPlayed: 0,
    tournamentWins: 0,
    tournamentPoints: 0,
  }
  users[username] = account
  return account
}

function serializeAccount(account){
  if (!account) return null
  const { password, ...safe } = account
  return safe
}

function compareLeaderboard(left, right){
  if (right.wins !== left.wins) return right.wins - left.wins
  if (right.tournamentPoints !== left.tournamentPoints) return right.tournamentPoints - left.tournamentPoints
  if (right.tournamentWins !== left.tournamentWins) return right.tournamentWins - left.tournamentWins
  return left.username.localeCompare(right.username)
}

function getLeaderboard(){
  return Object.values(users)
    .map(serializeAccount)
    .sort(compareLeaderboard)
}

function ensureRoom(roomId, options = {}){
  if (!rooms[roomId]) rooms[roomId] = createEmptyRoom(options)
  return rooms[roomId]
}

function getRoomSummary(room){
  const standings = room.tournament
    ? Object.entries(room.tournament.standings).map(([username, stats]) => ({
        username,
        wins: stats.wins,
        tournamentPoints: stats.points,
        tournamentWins: stats.wins,
        gamesPlayed: stats.gamesPlayed,
      })).sort(compareLeaderboard)
    : []
  return {
    ...room,
    standings,
  }
}

function recordFinishedRoom(room){
  const rankings = [...(room.finishedOrder || [])]
  if (room.bhabi) rankings.push(room.bhabi)

  if (room.tournament){
    room.tournament.rounds += 1
    const totalPlayers = rankings.length || room.players.length
    rankings.forEach((username, index)=>{
      const points = Math.max(totalPlayers - index - 1, 0)
      if (!room.tournament.standings[username]) {
        room.tournament.standings[username] = { wins: 0, points: 0, gamesPlayed: 0 }
      }
      room.tournament.standings[username].gamesPlayed += 1
      room.tournament.standings[username].points += points
      if (index < rankings.length - 1) room.tournament.standings[username].wins += 1

      const account = users[username]
      if (account){
        account.gamesPlayed += 1
        account.tournamentPoints += points
        if (index < rankings.length - 1) {
          account.wins += 1
          account.tournamentWins += 1
        }
      }
    })
  } else {
    const winnerSet = new Set(room.finishedOrder || [])
    room.players.forEach(player => {
      const account = users[player.name]
      if (account) {
        account.gamesPlayed += 1
        if (winnerSet.has(player.name)) account.wins += 1
      }
    })
  }
}

const { createDeck, shuffle, dealRoundRobin } = require('./game')

app.get('/rooms', (req,res)=>{
  const output = Object.keys(rooms).map(id=>({ id, ...getRoomSummary(rooms[id]), players: rooms[id].players.map(p=>({ name:p.name })) }))
  res.json(output)
})

app.post('/rooms', (req,res)=>{
  const id = makeId()
  rooms[id] = createEmptyRoom()
  console.log('Created room', id)
  res.json({ id })
})

app.post('/tournaments', (req,res)=>{
  const { name, maxPlayers, token, hostName } = req.body || {}
  const account = getAccountFromToken(token)
  const tournamentName = (name || 'Tournament').trim()
  const limit = Number(maxPlayers)
  if (!Number.isInteger(limit) || limit < 2 || limit > 12) {
    return res.status(400).json({ error: 'maxPlayers must be between 2 and 12' })
  }
  const roomId = makeId()
  const host = account?.username || hostName || 'Host'
  rooms[roomId] = createEmptyRoom({ mode: 'tournament', maxPlayers: limit, tournamentName, host })
  tournaments[roomId] = { id: roomId, name: tournamentName, maxPlayers: limit, host, roomId }
  res.json({ id: roomId, name: tournamentName, maxPlayers: limit, host })
})

app.get('/tournaments', (req,res)=>{
  const output = Object.entries(rooms)
    .filter(([, room]) => room.mode === 'tournament')
    .map(([id, room]) => ({ id, ...getRoomSummary(room) }))
  res.json(output)
})

app.get('/tournaments/:id', (req,res)=>{
  const room = rooms[req.params.id]
  if (!room || room.mode !== 'tournament') return res.status(404).json({ error: 'Tournament not found' })
  res.json({ id: req.params.id, ...getRoomSummary(room) })
})

app.post('/auth/register', (req,res)=>{
  const { username, password } = req.body || {}
  const cleanUsername = (username || '').trim()
  if (!cleanUsername || !password) return res.status(400).json({ error: 'username and password are required' })
  if (users[cleanUsername]) return res.status(409).json({ error: 'Username already exists' })
  const account = upsertAccount(cleanUsername, password)
  const token = makeToken()
  tokens[token] = cleanUsername
  res.json({ token, user: serializeAccount(account) })
})

app.post('/auth/login', (req,res)=>{
  const { username, password } = req.body || {}
  const cleanUsername = (username || '').trim()
  const account = upsertAccount(cleanUsername, password)
  if (!account) return res.status(401).json({ error: 'Invalid username or password' })
  const token = makeToken()
  tokens[token] = cleanUsername
  res.json({ token, user: serializeAccount(account) })
})

app.get('/me', (req,res)=>{
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token
  const account = getAccountFromToken(token)
  if (!account) return res.status(401).json({ error: 'Not authenticated' })
  res.json({ user: serializeAccount(account) })
})

app.get('/leaderboard', (req,res)=>{
  res.json({ users: getLeaderboard() })
})

io.on('connection', (socket)=>{
  console.log('socket connected', socket.id)

  socket.on('listRooms', ()=>{
    const out = Object.entries(rooms).map(([id, room])=>({
      id,
      mode: room.mode,
      maxPlayers: room.maxPlayers,
      started: room.started,
      tournamentName: room.tournamentName,
      players: room.players.map(p=>({ name: p.name })),
      standings: getRoomSummary(room).standings,
    }))
    socket.emit('rooms', out)
  })

  socket.on('joinRoom', ({ roomId, name, token })=>{
    const account = getAccountFromToken(token)
    const room = ensureRoom(roomId)
    const playerName = account?.username || name
    if (!playerName) return
    if (room.mode === 'tournament' && room.players.length >= room.maxPlayers && !room.players.find(p=>p.name===playerName)) return
    const player = { id: socket.id, name: playerName, count: 0 }
    // avoid duplicate
    if (!room.players.find(p=>p.id===socket.id)) room.players.push(player)

    socket.join(roomId)
    socket.emit('joined', { roomId, name: playerName })

    // emit update
    io.to(roomId).emit('room:update', { id: roomId, ...getRoomSummary(room) })
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
    room.openingCard = 'A♠'
    room.openingCardPlayed = false
    const openingPlayerIndex = room.players.findIndex(p => (room.hands[p.name] || []).includes('A♠'))
    room.current = openingPlayerIndex >= 0 ? openingPlayerIndex : 0
    room.trick = { leadSuit: null, plays: [] }
    room.finishedOrder = []
    io.to(roomId).emit('room:update', { id: roomId, ...getRoomSummary(room) })
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

    if (!room.openingCardPlayed && room.trick?.plays?.length === 0){
      if (card !== room.openingCard){
        socket.emit('invalidPlay', { reason: 'Opening move must be Ace of Spades', card })
        return
      }
    }

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
    if (card === room.openingCard) room.openingCardPlayed = true
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

      if (winner){
        const pile = trick.plays.map(p=>p.card)
        room.hands[winner] = (room.hands[winner] || []).concat(pile)
      }

      // reset trick
      room.trick = { leadSuit: null, plays: [] }

      room.players.forEach(p=> p.count = room.hands[p.name]?.length || 0)

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
        room.bhabi = remaining.length===1 ? remaining[0].name : null
        recordFinishedRoom(room)
        room.started = false
        io.to(roomId).emit('room:update', { id: roomId, ...getRoomSummary(room) })
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

    io.to(roomId).emit('room:update', { id: roomId, ...getRoomSummary(room) })
  })

  socket.on('disconnect', ()=>{
    // remove player from rooms
    for (const id of Object.keys(rooms)){
      const r = rooms[id]
      const idx = r.players.findIndex(p=>p.id===socket.id)
      if (idx>=0){
        r.players.splice(idx,1)
        io.to(id).emit('room:update', { id, ...getRoomSummary(r) })
      }
    }
  })
})

server.listen(PORT, ()=>console.log('Server listening on', PORT))
