var Twit = require('twit'),
    gm = require('gm'),
    request = require('request'),
    Nightmare = require('nightmare'),
    EventEmitter = require('events');

var URL = 'http://www.newyorker.com/cartoons/random/',
    nightmare = Nightmare({ show: false }),
    message;

// T: An instance of Twit

function CaptionBot(T) {
  this.name = 'NYCaptionBot';
  this.T = T;
  this.emitter = new EventEmitter();
  this.stream = T.stream('user', {replies: 'all', track: [this.name]});

  this.stream.on('tweet', this.handleTweet.bind(this));

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
    console.log('Connect');
  })

}

CaptionBot.prototype.handleTweet = function(tweet) {
  var handle = tweet.user.screen_name;
  // Filter out tweets from this account
  if (handle === this.name) { return false; };

  // Get the content and combine it into a message
  var text = tweet.text.split(this.name)[1];
  message = '@' + handle + ': here ya go';
  this.makeImage(text);
};

CaptionBot.prototype.fetchImage = function() {
  var self = this;
  nightmare
    .goto(URL)
    .wait('#cartoon img')
    .evaluate(function() {
      var src = document.querySelector('#cartoon img').src;
      return src;
    })
    .end()
    .then(function(result) {
      self.emitter.emit('fetchedCartoon', result);
    })
    .catch(function (error) {
      console.error('Search failed:', error);
    });
};

CaptionBot.prototype.splitText = function(text) {
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

CaptionBot.prototype.makeImage = function(text) {
  this.fetchImage();
  var y; // Y-coordinates, will be derived from the height
  var text = this.splitText(text);
  var self = this;
  this.emitter.on('fetchedCartoon', function(result) {
    gm(request(result))
      .resize(600)
      .size(function(err, size) {
        y = size.height - 40;
      })
      .append('public/img/caption-bg.jpg')
      .toBuffer('JPG', function(err, buffer) {
        gm(buffer, 'img.jpg')
        .font('public/caslon.ttf', 16)
        .drawText(20, 50, text[0], 'south')
        .drawText(20, 28, text[1], 'south')
        .toBuffer('JPG', self.postImage.bind(self));
      })
  })
};

CaptionBot.prototype.postImage = function(err, buffer) {
  if (err) { return false; }
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
