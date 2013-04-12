/*
 * Simple server for HPC Controller
 * Author: Ram Rajamony (rajamony@us.ibm.com)
 *
 * Main server-side file, processed by node.js
**/

"use strict";

var 	fs = require ('fs'),
	http = require ('http'),
	crypto = require ('crypto'),
	assert = require ('assert'),
	express  = require ('express'),
	mongodb = require ('mongodb'),
	utils = require ('js/utils.js'),
	MongoUsers = null,
	MongoAudio = null,

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

	NO_MORE_VARS; // Thats all folks



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
	    server.post ('/Perform', HandlePosts);
	    db.createCollection ('users', function (err, collection) {
		assert.equal (err, null, "Could not open/create collection <users> within MongoDB. Error <" + String(err) + ">");
		MongoUsers = collection;

		server.listen (port, hostname, function () {
			var myroot = "http://" + hostname + ":" + port;	// FIXME: What if we're https?
			console.log ( "Server is now advertising as " + myroot);
		    });
	    });
	});
}


function HandlePosts (req, res) {
    res.writeHead(200, {'Content-Type': 'text/javascript;charset=UTF-8'});	// We always respond with a JSON
    var jsondata = new utils.RadioFromBrowser(req.body);
    if (jsondata.ValidateOrRespondWithError (res)) {
	switch (jsondata.action) {
	    case "doesuserexist": DoesUserAlreadyExist (req, res, jsondata); break;
	    case "signup": AddNewUser (req, res, jsondata); break;
	    case "signin": LoginExistingUser (req, res, jsondata); break;
	}
    }
}


function DoesUserAlreadyExist (req, res) {
    UserModel.findOne ({_id: req.body.username}, function (err, doc) {
	    var jsonresp = { error: (err === null) ? "" : "DoesUserAlreadyExist" + String(err), username: req.body.username, credentials: "" };
	    if (doc === null)
		jsonresp.credentials = "nosuchuser";
	    else {
		if (doc._id !== req.body.username)	// Why would Mongo give us a non-null document with a DIFFERENT _id?
		    jsonresp.error += "DoesUserAlreadyExist: Something screwed up in Mongo";
		else
		    jsonresp.credentials = "useralreadyexists";
	    }
	    Debuglog ("DoesUserAlreadyExist: username <" + req.body.username + "> = " + jsonresp.credentials + ". Error = <" + ">");
	    res.end (JSON.stringify(jsonresp));
	});
}

/* Responds eventually with a JSON 
 * 	error:	      ""     If no errors were encountered. Remaining fields invalid if this is non-null
 *	username:     "..."  We echo back the supplied username
 *	credentials:  "..."  If user exists: "useralreadyexists". Otherwise, if user successfully added: "valid". Else ""
 * 	accesskey:    "..."  If the user was successfully added. This needs to be given to the Chrome plugin for all subsequent use
**/
function AddNewUser (req, res) {
    var record = new UserModel();
    record._id = req.body.username;
    record.accesskey = record.password = req.body.password; // For now, we just send the cleartext password back
    record.usersince = new Date();
    // record.stations = [{ _id: "Adventure"}, {_id: "Kids"}];
    record.save (function (err) {
	    var jsonresp = { error: "", username: req.body.username, accesskey: "", credentials: "" };
	    if (err === null) {
		jsonresp.accesskey = record.accesskey;
		jsonresp.credentials = "valid";
	    }
	    else {
		if (-1 !== String(err).search("duplicate key error index"))
		    jsonresp.credentials = "useralreadyexists"; 
		else
		    jsonresp.error = "AddNewUser: Error during saving of record: " + String(err);
	    }
	    Debuglog ("AddNewUser: Username <" + req.body.username + ">, credentials = " + jsonresp.credentials + ". Errors: <" + jsonresp.error + ">");
	    res.end (JSON.stringify (jsonresp));
	});
}

/* Responds eventually with a JSON
 * 	error:	     ""      If no errors were encountered. Remaining fields invalid if this is non-null
 *	username:    "..."   We echo back the supplied username
 *      credentials: "..."   Set to "valid" if the supplied password matches what we have in Mongo, set to "invalid" otherwise
 *	accesskey:   "..."   A secret we give back to the user so the plugin can tag its requests; same as password for now
**/
function LoginExistingUser (req, res) {
    UserModel.findOne ({_id: req.body.username}, function (err, doc) {
	    var jsonresp = { error: (err === null) ? "" : "LoginExistingUser: " + String(err), username: req.body.username, accesskey: "", credentials : "invalid" };
	    if (err === null && doc !== null && doc.password === req.body.password) {
	        jsonresp.credentials = "valid";
		jsonresp.accesskey = doc.accesskey;
	    }
	    Debuglog ("LoginExistingUser: username <" + jsonresp.username + "> outcome " + jsonresp.credentials + ", accesskey <" + jsonresp.accesskey + "> with error: " + jsonresp.error);
	    res.end (JSON.stringify (jsonresp));
	});
}



Initialize();
