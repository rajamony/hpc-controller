/*
 * Simple server for HPC Controller
 * Author: Ram Rajamony (rajamony@us.ibm.com)
**/
"use strict";

var port 	= process.env.PORT || 9080;
var hostname 	= process.env.HOSTURL || "0.0.0.0";
var SITE_SECRET = 'Boston Marathon'; // Math.random().toString();

var 	fs = require ('fs'),
	express  = require ('express'),
	cookieParser = express.cookieParser(SITE_SECRET),
	app = express(),
    	ssl_options = { key: fs.readFileSync('/opt/keys/root-ca.key'), cert: fs.readFileSync('/opt/keys/cert.pem')},
    	server = require('http').createServer (app), // require('https').createServer (ssl_options, app),
    	io = require('socket.io').listen(server),
	sessionstore_options = { auto_reconnect: true, url: 'mongodb://localhost:27017/hpc/sessions', stringify: true, /* clear_interval: -1, */ },
	sessionstore = new ((require('connect-mongo'))(express))(sessionstore_options),
	staticurlmaps = [
		{ root: '/clientside/html', 			disklocation: '/clientside/html'},
		{ root: '/clientside/css', 			disklocation: '/clientside/css'},
		{ root: '/clientside/js', 			disklocation: '/clientside/js'},
		{ root: '/clientside/underscore_templates', 	disklocation: '/clientside/underscore_templates'},
		{ root: '/', 					disklocation: '/clientside/html'},
	    ];

io.set ('log level', 1);
app.set ('case sensitive routing', true);
app.use (app.router);			// Dynamic routes come first, then static files. See http://tinyurl.com/afab75h
app.use (express.logger('dev'));
app.use (express.bodyParser());		// To handle POSTs.
app.use (express.methodOverride());
app.use (cookieParser);
app.use (express.session({cookie: {maxAge: new Date(Date.now() + 10*365*86400*1000), httpOnly: /* FIXME */ false}, store: sessionstore}));
app.use (express.favicon());
staticurlmaps.each (function (x) { app.use (x.root, express.static(__dirname + x.disklocation, {maxAge: 0}));});

//app.use(function(req, res){
//  console.log ('Cookie: <' + req.cookies['express.sid'] + '> SessionID: <' + req.sessionID + '>');
//  var body = '';
//  if (req.session.views) { ++req.session.views; } else { req.session.views = 1; body += '<p>First time visiting? view this page in several browsers :)</p>'; }
//  res.send(body + '<p>viewed <strong>' + req.session.views + ' session id ' + req.sessionID + ' </strong> times.</p>');
//});

// app.all ('*', AuthenticateUser, LoadUser);
app.use (function (err, req, res, next) { console.error ("\nInternal error:" + err); res.status (500); res.end (JSON.stringify({error: err.toString()})); });

var sessionSockets = new (require('session.socket.io')) (io, sessionstore, cookieParser, 'connect.sid');
sessionSockets.on('connection', function (err, socket, session) {
	console.log ("Error: " + err); console.dir (session);
	if (typeof session.user === "undefined") {
	    socket.emit ('authenticate', {});
	    session.user = {name: 'larry'};
	}

        socket.on ('doyouknowme', function (data) {
		console.log ("Got a doyouknowme");
		if (typeof session.user !== "undefined")
		    socket.emit ('welcomeback', {name: session.user.name});
	    });
    });

server.listen (port, hostname);
