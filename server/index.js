const keys = require('./keys')

// Express App Setup
const exepress = require('express')
const bodeParser = require('body-parser')
const cors = require('cors')

const app = exepress()
app.use(cors())
app.use(bodeParser.json())

// Postgress Client Setup
const { Pool } = require('pg')
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
})

pgClient.on('error', () => console.log('Lost PG connection'))

pgClient
  .query('CREATE TABLE IF NOT EXISTS seen (number INT)')
  .catch((err) => console.log(err))

// Redis Client Setup

const redis = require('redis')
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
})
const redisPublisher = redisClient.duplicate()

// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi')
})

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM seen')
  res.send(values.rows)
})

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('seen', (err, values) => {
    res.send(values)
  })
})

app.post('/values', async (req, res) => {
  const index = req.body.index

  if (parseInt(index) > 40) {
    return res.status(422).send('Index top high')
  }

  redisClient.hset('seen', index, 'Nothing yet')
  redisPublisher.publish('insert', index)
  pgClient.query('INSERT INTO seen(number) VALUES($1)', [index])

  res.send({ working: true })
})

app.listen(5000, (err) => {
  console.log('Listening')
})
