require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const socketIo = require('socket.io')
const bodyParser = require('body-parser')

app.use(
  cors({
    origin: process.env.APP_URL,
    methods: ['GET', 'POST', 'PUT'],
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
  res.send('Runs!')
})

const io = socketIo(server, {
  cors: {
    origin: process.env.APP_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

const avatars = []

app.post('/avatars', (req, res) => {
  const { avatar } = req.body
  const avatarIndex = avatars.findIndex((item) => item.id === avatar.id)
  if (avatarIndex === -1) {
    avatars.push(avatar)
    res.status(200).json('Avatar created')
    io.emit('avatarCreated', avatar)
  } else {
    res.status(409).json('Avatar already exists')
  }
})

app.get('/avatars', (req, res) => {
  res.json(avatars)
})

io.on('connection', (socket) => {
  socket.on('setUserId', (userId) => {
    socket.userId = userId
  })

  socket.on('moveAvatar', (data) => {
    const { userId, position } = data
    const avatarIndex = avatars.findIndex((avatar) => avatar.id === userId)
    if (avatarIndex !== -1) {
      avatars[avatarIndex].position = position
      console.log(avatars[avatarIndex])
      io.emit('avatarMoved', avatars[avatarIndex])
    }
  })

  socket.on('sendMessage', message => {
    io.emit('messageReceived', message)
  })

  socket.on('disconnect', () => {
    if (socket.userId) {
      const avatarIndex = avatars.findIndex((avatar) => avatar.id === socket.userId)
      if (avatarIndex !== -1) {
        avatars.splice(avatarIndex, 1)
        io.emit('avatarRemoved', socket.userId)
      }
    }
  })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.SERVER_HOST || 'localhost'
server.listen(PORT, HOST, () =>
  console.log(`Server running on ${HOST}, port ${PORT}`)
)
