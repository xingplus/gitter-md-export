/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var express         = require('express');
var passport        = require('passport');
var OAuth2Strategy  = require('passport-oauth2');
var request         = require('request');
var elasticsearch = require('elasticsearch');
var esclient = new elasticsearch.Client({
  host: 'eshost:9200',
  log: 'trace'
});

var gitterHost    = process.env.HOST || 'https://gitter.im';
var port          = process.env.PORT || 7000;

// Client OAuth configuration
var clientId      = process.env.GITTER_KEY;
var clientSecret  = process.env.GITTER_SECRET;

// Gitter API client helper
var gitter = {
  fetch: function(path, token, cb) {
    var options = {
     url: gitterHost + path,
     headers: {
       'Authorization': 'Bearer ' + token
     }
    };

    request(options, function (err, res, body) {
      if (err) return cb(err);

      if (res.statusCode === 200) {
        cb(null, JSON.parse(body));
      } else {
        cb('err' + res.statusCode);
      }
    });
  },

  fetchCurrentUser: function(token, cb) {
    this.fetch('/api/v1/user/', token, function(err, user) {
      cb(err, user[0]);
    });
  },

  fetchRooms: function(user, token, cb) {
    this.fetch('/api/v1/user/' + user.id + '/rooms', token, function(err, rooms) {
      cb(err, rooms);
    });
  },

  fetchMessages: function(room, beforeId, token, cb) {
    // /v1/rooms/:roomId/chatMessages?limit=50

	  var url = '/api/v1/rooms/' + room + '/chatMessages?limit=100';
	  if (beforeId) {
	  	url += '&beforeId=' + beforeId
	  }
    this.fetch(url, token, function(err, messages) {
      cb(err, messages);
    });
  }
};

var app = express();

// Middlewares
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static( __dirname + '/public'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// Passport Configuration

passport.use(new OAuth2Strategy({
    authorizationURL:   gitterHost + '/login/oauth/authorize',
    tokenURL:           gitterHost + '/login/oauth/token',
    clientID:           clientId,
    clientSecret:       clientSecret,
    callbackURL:        '/login/callback',
    passReqToCallback:  true
  },
  function(req, accessToken, refreshToken, profile, done) {
    req.session.token = accessToken;
    gitter.fetchCurrentUser(accessToken, function(err, user) {
      return (err ? done(err) : done(null, user));
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, JSON.stringify(user));
});

passport.deserializeUser(function (user, done) {
  done(null, JSON.parse(user));
});

app.get('/login', 
  passport.authenticate('oauth2')
);

app.get('/login/callback', 
  passport.authenticate('oauth2', {
    successRedirect: '/home',
    failureRedirect: '/'
  })
);

app.get('/logout', function(req,res) {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', function(req, res) {
  res.render('landing');
});


app.get('/home', function(req, res) {
  if (!req.user) return res.redirect('/');

  // Fetch user rooms using the Gitter API
  gitter.fetchRooms(req.user, req.session.token, function(err, rooms) {
    if (err) return res.send(500);

    res.render('home', {
      user: req.user, 
      token: req.session.token, 
      clientId: clientId,
      rooms: rooms
    });
  });

});

app.get('/room/*/*', function(req, res) {
  if (!req.user) return res.redirect('/');
  console.log(req);

  // Fetch user rooms using the Gitter API
  gitter.fetchMessages(req.params[0], req.params[1], req.session.token, function(err, messages) {
    if (err) return res.send(500);

    var return_string = "";

    var i;
	var bulk = [];
    for (i in messages) {
      var msg = messages[i];
	  bulk.push({
		  index: {
			  _index: 'gitter_reactor',
			  _type: 'chat_log',
			  _id: msg.id
		  }
	  });
	  bulk.push(msg);
      return_string += "---\n\n## " 
                    + msg.fromUser.displayName
                    + " *" + msg.sent + "*: \n\n"
					+ msg.id + " \n\n"
                    + msg.text + "\n\n";
    }
	esclient.bulk({
		body: bulk
	}, function(err, resp) {
		console.log('err=');
		console.log(err);
		console.log('resp=');
		console.log(resp);
	})
    res.set('Content-Type', 'text/x-markdown');

    res.send(return_string);

    // res.render('messages', {
    //   user: req.user, 
    //   token: req.session.token, 
    //   clientId: clientId,
    //   messages: messages
    // });
  });

});


app.listen(port);
console.log('Demo app running at http://localhost:' + port);
