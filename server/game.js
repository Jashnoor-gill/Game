function createDeck(){
  const suits = ['♣','♦','♥','♠']
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
  const deck = []
  for (const s of suits) for (const r of ranks) deck.push(r + s)
  return deck
}

function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1))
    ;[a[i],a[j]] = [a[j],a[i]]
  }
}

function dealRoundRobin(deck, players){
  const hands = {}
  players.forEach(p=> hands[p]=[])
  const d = deck.slice()
  let idx=0
  while (d.length>0){
    const card = d.pop()
    const player = players[idx%players.length]
    hands[player].push(card)
    idx++
  }
  return hands
}

module.exports = { createDeck, shuffle, dealRoundRobin }
