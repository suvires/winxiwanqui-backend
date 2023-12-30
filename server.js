require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const socketIo = require('socket.io')
const bodyParser = require('body-parser')

const players = []

app.use(
  cors({
    origin: process.env.APP_URL,
    methods: ['GET'],
    credentials: true
  }),
  bodyParser.json()
)

let server
if (process.env.NODE_ENV === 'development') {
  const fs = require('fs')
  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY, 'utf8')
  const certificate = fs.readFileSync(process.env.CERTIFICATE, 'utf8')
  const credentials = { key: privateKey, cert: certificate }
  const https = require('https')
  server = https.createServer(credentials, app)
} else {
  const http = require('http')
  server = http.createServer(app)
}

app.get('/', (req, res) => {
  res.send('Winxiwanqui server')
})

app.get('/players', (req, res) => {
  res.json(players)
})

const io = socketIo(server, {
  cors: {
    origin: process.env.APP_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

io.on('connection', (socket) => {
  socket.on('createPlayer', ({ userId, characterSprite, positionX, positionY }) => {
    const playerExists = players.some(p => p.userId === userId)
    if (!playerExists) {
      const player = {}
      player.userId = userId
      player.positionX = positionX
      player.positionY = positionY
      player.characterSprite = characterSprite
      socket.player = player
      players.push(player)
      io.emit('playerCreated', { userId, characterSprite, positionX, positionY })
    }
  })

  socket.on('movePlayer', ({ userId, positionX, positionY, lastDirection }) => {
    const player = players.find((p) => p.userId === userId)
    if (player) {
      player.positionX = positionX
      player.positionY = positionY
      player.lastDirection = lastDirection
      io.emit('playerMoved', { userId, positionX, positionY })
    }
  })

  socket.on('sendMessage', message => {
    io.emit('messageReceived', message)
  })

  socket.on('disconnect', () => {
    if (socket.player && socket.player.userId) {
      const playerIndex = players.findIndex((p) => p.userId === socket.player.userId)
      if (playerIndex !== -1) {
        players.splice(playerIndex, 1)
        io.emit('playerDisconnected', socket.player.userId)
      }
    }
  })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.SERVER_HOST || 'localhost'
server.listen(PORT, HOST, () =>
  console.log(`Server running on ${HOST}, port ${PORT}`)
)
