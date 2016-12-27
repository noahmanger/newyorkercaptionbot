var Twit = require('twit'),
    gm = require('gm'),
    request = require('request'),
    EventEmitter = require('events');

var URL = 'http://www.newyorker.com/cartoons/random/randomAPI';

// T: An instance of Twit

function CaptionBot(T) {
  this.name = 'NYCaptionBot';
  this.T = T;
  this.emitter = new EventEmitter();
  this.stream = T.stream('user', {replies: 'all', track: [this.name]});

  this.stream.on('tweet', this.handleTweet.bind(this));

  this.emitter.on('madeImage', this.postImage.bind(this));
  this.emitter.on('fetchedCartoon', this.compositeImages.bind(this));

  this.stream.on('limit', function (limitMessage) {
    console.log('Limited');
  });

  this.stream.on('disconnect', function (disconnectMessage) {
    console.log('disconnected');
  });

  this.stream.on('warning', function (warning) {
    console.log('warning');
  })

  this.stream.on('connected', function (response) {
    console.log('Connected!');
  });

  this.stream.on('connect', function (request) {
    console.log('Connecting...');
  })

}

CaptionBot.prototype.handleTweet = function(tweet) {
  var handle = tweet.user.screen_name;
  // Filter out tweets from this account
  if (handle === this.name) { return false; };
  console.log(tweet);

  // Find the instance of bot handle
  var botHandle = tweet.text.match(/@nycaptionbot/i);
  // Filter out tweets that don't start with @ing me
  if (tweet.text.split(' ')[0] === botHandle[0]) {
    // Get the content and combine it into a message
    var caption = tweet.text.split(botHandle[0])[1];
    var message = 'Caption by @' + handle + '.';
    this.fetchImage(caption, message);
  } else {
    console.log('That tweet was not formatted correctly');
  }
};

CaptionBot.prototype.splitText = function(text) {
  console.log('Splitting text');
  if (text.length <= 70) {
    return [text, ''];
  } else {
    var raw = text.split(' ');
    var text1 = raw[0];
    var text2 = '';
    // Combine words until we reach 80 characters in text1 then add to text2
    for (var i = 1; i < raw.length; i++) {
      if (text1.length < 70) {
        text1 = text1 + ' ' + raw[i];
      } else {
        text2 = text2 + ' ' + raw[i];
      }
    }
    return [text1, text2];
  }
};

CaptionBot.prototype.fetchImage = function(caption, message) {
  console.log('Fetching image');
  var self = this;
  request(URL, function(err, response, body) {
    console.log('Image fetch complete');
    var body = JSON.parse(body);
    var src = body[0].src;
    self.emitter.emit('fetchedCartoon', src, caption, message);
  });
};

CaptionBot.prototype.compositeImages = function(src, caption, message) {
  console.log('Compositing images')
  var y; // Y-coordinates, will be derived from the height
  var text = this.splitText(caption);
  var self = this;
  gm(request(src))
    .resize(600)
    .size(function(err, size) {
      y = size.height - 40;
    })
    .append('public/img/caption-bg.jpg')
    .toBuffer('JPG', function(err, buffer) {
      if (err) { console.log(err); }
      gm(buffer, 'img.jpg')
      .font('public/caslon.ttf', 18)
      .drawText(20, 50, text[0], 'south')
      .drawText(20, 30, text[1], 'south')
      .toBuffer('JPG', function(err, buffer) {
        if (!err) {
          self.emitter.emit('madeImage', buffer, message);
        }
      });
    })
};

CaptionBot.prototype.postImage = function(buffer, message) {
  console.log('=====POSTING TWEET======');
  console.log(message);
  var T = this.T;
  // Encode to base64
  var newImage = buffer.toString('base64');
  T.post('media/upload', {media_data: newImage}, function(err, data, response) {
    if (err) { console.log(err); }
    // Add meta data
    var mediaIdStr = data.media_id_string
    var altText = "New Yorker Cartoon"
    var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
    // Post the tweet
    T.post('media/metadata/create', meta_params, function (err, data, response) {
      if (err) { console.log(err); }
      if (!err) {
        // now we can reference the media and post a tweet (media will attach to the tweet)
        var params = { status: message, media_ids: [mediaIdStr] }
        T.post('statuses/update', params, function (err, data, response) {
          if (err) { console.log(err) }
        })
      }
    })
  });
};

module.exports = {
  CaptionBot: CaptionBot,
}
