
const keys = require('./keys') ; 

//express app setup 
const express = require('express') ; 
const bodyParser = require('body-parser') ; 
const cors = require('cors') ; 

// app sets up the express api that will receive requests
// and respond to those requests from the react ap 
const app = express() ; 

// cors allows 1 domain, that the react app is hosted on, 
// to respond to another domain that the express app is hosted on
app.use(cors()) ; 

// bodyParser will parse incoming POST requests from the react application 
// and transform the body of the request into json format so our express app can
// easily work the request
app.use(bodyParser.json()) ; 

// postgres client set up 
const { Pool } = require('pg') ; 

// postgres will store the indicies it has seen (been submitted to the react app 
// and sent to this express app)
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
    ssl:
      process.env.NODE_ENV !== 'production'
        ? false
        : { rejectUnauthorized: false },
  });

pgClient.on("connect", (client) => {
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err));
  });


// pgClient.on('error', () => console.log('Lost PG connection')) ; 

// // create values table if not already there
// pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
//     .catch(err => console.log(err)) ; 


// Redis Client Setup 
const redis = require('redis') ; 
const redisClient = redis.createClient({
    host: keys.redisHost, 
    port: keys.redisPort, 
    retry_strategy: () => 1000 //if we lose connection to Redis, then try to reconnect every 1 second 
}) ; 


const redisPublisher = redisClient.duplicate() ; 

// Express route handlers 

app.get('/', (req, res) => {
    res.send('Hi'); 

}) ; 

// this route will query the postgres instance for all the different indicies that 
// have ever been submitted to postgres
app.get('/values/all', async (req, res) => {
    const indicies = await pgClient.query('SELECT * from values') ; 

    // just send back the relevant data, not data about the query itself
    // which would also be contained in values 
    res.send(indicies.rows) ; 
})

// this route will contact the redis instance and get all
// the index:value fibonacci pairs ever submitted to the backend
app.get('/values/current', async (req, res) => {
    // from the redis instance, get the hash table (instance)
    // called values
    redisClient.hgetall('values', (err, values) => {
        res.send(values) ; 
    })
}) ; 

// this post route is for when the user submits a post request
app.post('/values', async (req, res) => {
    const index = req.body.index ; 

    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high') ; 
    }

    // put into the redis 'values' instance the index and value of 'Nothing yet!'
    // since the other node process is responsible for calculating the value 
    redisClient.hset('values', index, 'Nothing yet!') ; 
    // tell the redisPubliser to publish insert event which will trigger
    // the node process that is monitoring for the insert event 
    redisPublisher.publish('insert', index) ; 
    // insert the index into the postgres database 
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]) ; 

    // arbitrary response that says we are doing some work to 
    // calculate your fibonacci value 
    res.send({working: true}) ; 


}) ; 

app.listen(5000, err => {
    console.log('Listening') ; 
})