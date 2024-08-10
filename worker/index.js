const keys = require('./keys') ; 
const redis = require('redis') ; 

// the purpose of this worker process is to watch
// redis for newly inserted indicies. 
// The worker process pulls the new index, calculates
// the corresponding value and then puts it back into redis. 


//creates a Redis client connection 
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
}) ; 

const sub = redisClient.duplicate() ; 

function fib(index) {
    if(index < 2) return 1 ; 
    return fib(index - 1) + fib(index - 2) ; 
}

// anytime Redis has an insert event and there is a message, the callback
// will run 
// anytime we get a new message, run the callback we've defined 
sub.on('message', (channel, message) => {
    // insert 'index':'fib value' into hash table called values
    // Redis receives the index as 'message'
    redisClient.hset('values', message, fib(parseInt(message))) ; 
})

// we subscribe to any Redis insert events 
sub.subscribe('insert') ; 