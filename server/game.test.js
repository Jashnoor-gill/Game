const { createDeck, shuffle, dealRoundRobin } = require('./game')

test('createDeck returns 52 unique cards', ()=>{
  const deck = createDeck()
  expect(deck.length).toBe(52)
  const set = new Set(deck)
  expect(set.size).toBe(52)
})

test('shuffle changes order', ()=>{
  const d1 = createDeck()
  const d2 = createDeck()
  shuffle(d2)
  // it's possible shuffle returns same order rarely, but very unlikely
  const same = d1.every((v,i)=>v===d2[i])
  expect(same).toBe(false)
})

test('dealRoundRobin distributes all cards', ()=>{
  const deck = createDeck()
  shuffle(deck)
  const players = ['A','B','C','D']
  const hands = dealRoundRobin(deck, players)
  const total = Object.values(hands).reduce((s,arr)=>s+arr.length,0)
  expect(total).toBe(52)
  // all players should have roughly equal cards (diff <=1)
  const counts = players.map(p=>hands[p].length)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  expect(max-min).toBeLessThanOrEqual(1)
})
