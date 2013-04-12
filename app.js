/*
 * Radio. A learning experiment 
 * Author: Ram Rajamony (rajamony@us.ibm.com)
 *
 * Main server-side file, processed by node.js
 * Since node.js places each file in its namespace, we don't have to worry about namespace pollution
**/

"use strict";


var 	// Some required modules
	fs = require ('fs'),
	http = require ('http'),
	crypto = require ('crypto'),
	assert = require ('assert'),
	express  = require ('express'),
	mongodb = require ('mongodb'),

	// Setup environment
	port           = process.env.PORT || 8090,
	hostname	= process.env.HOSTURL || "0.0.0.0",

	tts_options = {
	    method: 'POST',
	    path: '/TTS/',
	    port: 80,
	    hostname: 'texttospeech.ibmeos.com',
	    // port: 1337,
	    // hostname: 'localhost',
	    headers: {"content-type" : "application/json; charset=UTF-8"},
	},

	// Thats all folks
	NO_MORE_VARS;


function HandleStaticFile (req, res) {
    console.log ("Got a HandleStaticFile for <" + req.url + ">");
    res.sendfile ("." + req.url);
}

/*
 * Opens connection to MongoDB, sets up hooks for processing different requests and starts listening. 
 * All other processing happens through callbacks
**/
function Initialize () {
    mongodb.MongoClient.connect ('mongodb://localhost:27017/hpcusers', {auto_reconnect: true},
        function (err, db) {
	    assert.equal (err, null, "Could not open connection to MongoDB. Error <" + String(err) + ">");

	    var server = express();
	    server.use (express.bodyParser());		// To handle POSTs
	    server.get('/*', HandleStaticFile);	// Anything but the above gets treated as a static file
	    db.createCollection ('users', function (err, collection) {
		assert.equal (err, null, "Could not open/create collection <users> within MongoDB. Error <" + String(err) + ">");
		server.listen (port, hostname, function () {
			var myroot = "http://" + hostname + ":" + port;	// FIXME: What if we're https?
			console.log ( "Server is now advertising as " + myroot);
		    });
	    });
	});
}

Initialize();
