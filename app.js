/*
 * Simple server for HPC Controller
 * Author: Ram Rajamony (rajamony@us.ibm.com)
**/
"use strict";

var port 	= process.env.PORT || 9080;
var hostname 	= process.env.HOSTURL || "0.0.0.0";
var SITE_SECRET = Math.random().toString();

var 	fs = require ('fs'),
	crypto = require ('crypto'),
	assert = require ('assert'),
	connect = require ('./node_modules/express/node_modules/connect'),
	cookie = require('cookie'),
	express  = require ('express'),
	mongoose = require ('mongoose'),
	utils = require ('./js/utils.js'),
	// users = require('./js/users.js'),
	NO_MORE_REQUIRES;

var	io = null,
	sessionstore_options = {
		auto_reconnect: true,
		url: 'mongodb://localhost:27017/hpc/sessions',
		stringify: true,
		// clear_interval: -1,
	    },
	sessionstore = new require('connect-mongo')(express)(sessionstore_options),
	sioCookieParser = express.cookieParser(SITE_SECRET),
	models = {};

function HandleError (err, req, res, next) {
    console.log ("\n\nInternal error?????\n");
    res.status (500); 
    res.end (JSON.stringify({error: err}));
}

function Initialize () {
    var db = mongoose.connect ('mongodb://localhost/hpc');
    var app = express();
    var ssl_options = { key: fs.readFileSync('/opt/keys/root-ca.key'), cert: fs.readFileSync('/opt/keys/cert.pem')};
//    var server = require('https').createServer (ssl_options, app);
    var server = require('http').createServer (app);
    models.users = require ('./mongoose-models/users')(mongoose).model;
    io = require('socket.io').listen(server);

    app.set ('case sensitive routing', true);
    app.use (app.router);			// Dynamic routes come first, then static files. See http://tinyurl.com/afab75h
    app.use (express.logger('dev'));
    app.use (express.bodyParser());		// To handle POSTs.
    app.use(express.methodOverride());
    app.use(express.cookieParser()); // app.use(express.cookieParser(SITE_SECRET));
    app.use(express.session({secret: SITE_SECRET, cookie: {maxAge: 10*1000}, store: sessionstore}));
// http://tinyurl.com/cbr8u9c

app.use(function(req, res){
  var body = '';
  if (req.session.views) {
    ++req.session.views;
  } else {
    req.session.views = 1;
    body += '<p>First time visiting? view this page in several browsers :)</p>';
  }
  res.send(body + '<p>viewed <strong>' + req.session.views + ' session id ' + req.sessionID + ' </strong> times.</p>');
});

    app.use ('/html', express.static(__dirname + '/html', {maxAge: 0}));	// Stale it immediately during development
    app.use ('/css', express.static(__dirname + '/css', {maxAge: 0}));	// Stale it immediately during development
    app.use ('/js', express.static(__dirname + '/js', {maxAge: 0}));	// Stale it immediately during development

    // app.all ('*', AuthenticateUser, LoadUser);
    app.use (HandleError); // app.use (express.errorHandler());

    server.listen (port, hostname, function () { 
	console.log ( "Server is now advertising itself as https://" + hostname + ":" + port); 
	// SetupSocketIO();
    });
}

function SetupSocketIO () {
    io.set ('log level', 1);
    io.sockets.on ('connection', function (socket) {
// console.log (sioCookieParser.toString());
        sioCookieParser (socket.handshake, {}, function(err) {
// console.dir (socket.handshake);
		sessionstore.get (socket.handshake.cookies["express.sid"], function(err, sessionData) {
			console.log ("SESSIONSTORE error = <" + err + "> sessionData = <" + sessionData + ">");
			// session data available here
		    });
	    });

	for (var i = 0; i < 10; i++)
	    socket.emit ('news', { hello: 'world ' + i });
	socket.on ('my other event', function (data) {
		console.log(data);
	    });
    });

/*
    io.set ('authorization', function (handshakeData, callback) {
//	    // Check database, ensure the user has already logged in.
//	    // If not, direct them to a login screen

    var accept = callback;
    if (handshakeData.headers.cookie) {
	handshakeData.cookie = cookie.parse(decodeURIComponent(handshakeData.headers.cookie));
	handshakeData.sessionID = connect.utils.parseSignedCookie (handshakeData.cookie['express.sid'], SITE_SECRET);
	console.log ("Got cookie <" + handshakeData.cookie['express.sid'] + "> and sessionID is <" + handshakeData.sessionID + ">");
	if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
	    console.log ("    but it is an invalid cookie");
	    return accept('Cookie is invalid.', false);
	}
    } else {
	console.log ("No cookie was sent");
	return accept('No cookie transmitted.', false);
    }
    accept(null, true);
});
*/

}

/*
var sessionobj = {}; //This is important; it will contain your connect.sid IDs.

app.use(express.session({ 
    secret: 'secret_pw',
    store: sessionStore,
    cookie: { 
        secure: true,
        expires: new Date(Date.now() + 60 * 1000), //setting cookie to not expire on session end
        maxAge: 60 * 1000,
        key: 'connect.sid'
    }
}));

app.get("/*", function(req, res, next){
    if(sessionobj[req.cookies['connect.sid']]){
        if(sessionobj[req.cookies['connect.sid']].login = true{
            //Authenticated AND Logged in
        }
        else{
            //authenticated but not logged in
        }
    }
    else{
        //not authenticated
    }
});

io.sockets.on('connection', function(socket){
    sessionobj[cookie.parse(socket.handshake.headers.cookie).'connect.sid'].login = false;
    sessionobj[cookie.parse(socket.handshake.headers.cookie).'connect.sid'].socketid = socket.id;
    socket.on('login', function(data){
        //DB Call, where you authenticate login
        //on callback (if login is successful):
        sessionobj[cookie.parse(socket.handshake.headers.cookie).connect.sid] = true;
    });
    socket.on('disconnect', function(data){
        //any cleanup actions you may want
    });
});

*/


Initialize();
