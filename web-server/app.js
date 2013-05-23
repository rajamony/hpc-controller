/*
 * Copyright 2013- IBM
 * All rights reserved
 *
 * Licensed under the Eclipse Public License, Version 1.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Simple server for HPC Controller
 * Written by: Ram Rajamony, IBM Research, Austin, TX
 *
 */

'use strict';

var 	port = process.env.PORT || 8090;
var 	util = require ('util'),
	fs = require ('fs'),
	express  = require ('express'),
	logic = require ('./js/logic.js'),
	deployer = require ('./js/deployer.js'),
	app = express(),
	operatingenv = require ('./js/operatingenv.js') (server, port),
    	ssl_options = { key: fs.readFileSync(operatingenv.sslkeydir + 'root-ca.key'), cert: fs.readFileSync(operatingenv.sslkeydir + 'cert.pem')},
    	server = require('https').createServer (ssl_options, app), 
	// server = require('http').createServer (app),
	cookieParser = express.cookieParser(operatingenv.SITE_SECRET),
    	io = require('socket.io').listen(server, {'log level': 1}),
	users = (require('./js/monkwithq')('mongodb://localhost:27017/hpc')).get('users'),	// Wraps guille's Monk with Q's promises
	sessionstore = new ((require('connect-mongo'))(express))({auto_reconnect: true, url: 'mongodb://localhost:27017/hpc/sessionstore', stringify: true, /* clear_interval: -1, */ }),
	sessionSockets = new (require('session.socket.io')) (io, sessionstore, cookieParser, 'connect.sid'),
	staticurlmaps = [ 	{ root: '/html',	disklocation: '/clientside/html'},
				{ root: '/css', 	disklocation: '/clientside/css'},
				{ root: '/js', 		disklocation: '/clientside/js'},
				{ root: '/', 		disklocation: '/clientside/html'},];

operatingenv.githookurl = (server.hasOwnProperty('cert')?'https://':'http://') + operatingenv.hostname + ':' + port + '/launchrun';
app.set ('case sensitive routing', true);
app.use (express.logger('dev'));
app.use (express.bodyParser());		// To handle POSTs.
app.use (express.methodOverride());	// To get app.get, app.put, etc.
app.use (cookieParser);
app.use (express.session({cookie: {maxAge: new Date(Date.now() + 10*365*86400*1000), httpOnly: /* FIXME */ false}, store: sessionstore}));
app.use (express.favicon());
app.use (app.router);	// I still don't understand wtf this does. http://tinyurl.com/afab75h is not entirely correct

app.all ('/launchrun?*', function (req, res) {logic.projectupdate (io, sessionSockets, users, req, res);});

// XXX For testing without github
if (process.env.TESTING) {
  app.get ('/launchtest', function(req,res) {
    var repo = req.param('repo');
    var sha = req.param('sha');

    console.log(repo);
    console.log(sha);

    if (repo == undefined) {
    	res.end("need repo");
    	return;
    }

    if (sha == undefined) {
    	res.end("need sha");
        return;
    }

    res.write(repo);
    res.write(sha);

    var spawn = require ('child_process').spawn;

    var proc = spawn('./testdeploy.sh', [repo, sha]);

    proc.stdout.on ('data', function (data) { res.write (data) });
	proc.stderr.on ('data', function (data) { res.write (data) });
	proc.on ('exit', function (code,signal) {
		if (code === 0) {
	        deployer.add(repo,sha);
	    } else {
	    	res.write('code: ' + code);
	    	res.write('signal: ' + signal);
	    }
		res.end();
	});
    
    
  })
}

app.all('/status', deployer.status);

app.get ('/exitnow?*', logic.exitnow);
app.use (function (err, req, res, next) { console.error ("\nInternal error:" + err); res.status (500); res.end (JSON.stringify({error: err.toString()})); });
staticurlmaps.forEach (function (x) { app.use (x.root, express.static(__dirname + x.disklocation, {maxAge: 0}));});

app.use('/userdata', express.static(__dirname + '/userdata'), {maxAge: 0});
app.use('/userdata', express.directory(__dirname + '/userdata'));


sessionSockets.on('connection', function (err, socket, session) {
	if (err !== null)
	    socket.emit ('error', {message: 'It looks like cookies are not enabled on your browser. Details: <' + err + '>'});
	else if (typeof session !== 'undefined' && typeof session.userinfo === 'undefined') {
	    // Dive into Mongo and set up the user structure IF we already know the user
	    // I don't think I need this codepath - the following diag provides no addnl useful information
	    console.log ('sessionSockets CONNECTION> Error: <' + err + '> session user data: <' + util.inspect (session.userinfo, {colors: true}) + '>');
	}
	logic.main (io, sessionSockets, err, socket, session, users);
    });

logic.setup (operatingenv, fs, users);
console.log('listening on port ' + port);
server.listen (port, '0.0.0.0');
