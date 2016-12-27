/* Setting things up. */
var Twit = require('twit'),
    bot = require('./bot'),
    config = {
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET,
        timeout_ms: 60*1000,
      }
    },
    T = new Twit(config.twitter);

console.log(config.twitter);

// Initialize bot
var bot = new bot.CaptionBot(T);

var express = require('express');
var app = express();
app.use(express.static('public'));
listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
