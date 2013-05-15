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
 * Main logic (socket.io and GET) for doing the admin+developer interactions
 * Written by: Ram Rajamony, IBM Research, Austin, TX.
 *
 */

var util = require ('util'),
    bcrypt = require ('bcrypt'),
    crypto = require ('crypto'),
    assert = require('assert'),
    Q = require ('q'),
    githookurl = null;

function UserInfo (u) { 
    if (!(this instanceof UserInfo))
	return new UserInfo (u);

    if (typeof u.fullname === 'undefined') u.fullname = 'Name Unknown';
    if (typeof u.roles === 'undefined') u.roles = ['developer'];
    if (typeof u.state === 'undefined') u.state = 'waitingforsignup';
    if (typeof u.authcode === 'undefined') u.authcode = 'N/A';
    if (typeof u.pw === 'undefined') {
	assert.equal (u.state, 'waitingforsignup');
        u.pw = 'no password';
    }

    this.bcrypted_password = bcrypt.hashSync (u.pw, 8);
    this._id = u.username;
    this.state = u.state;
    this.userinfo = {
	    username: u.username,
	    fullname: u.fullname,
	    authcode: u.authcode,
	    roles: u.roles,
	    projects: [],
	};
}


exports.setup = function (fs, users, port, hostname) {
    var pw = 'foo'; // crypto.randomBytes(12).toString('hex');
    githookurl = 'http://' + hostname + ':' + port + '/launchrun'
    users.Q.findOne ({_id: 'admin'})
    	.then (function (doc) {
		return (doc !== null) ? doc : users.Q.insert (new UserInfo ({username: 'admin', pw: pw, fullname: 'Administrator', roles: ['root', 'admin', 'developer'], state: 'signedup'}));
	    })
	.fail (function (err) {
		console.log ("Setup: error is <" + err + ">");
		process.exit (1);
	    })
	.done (function (doc) {
		if (typeof doc === "undefined")
		    process.exit (1);
		console.log ("Admin account password is <" + pw + ">");
	    });
}


exports.main = function (connectionerror, socket, session, users) {

    socket.emit('info', { site_title: 'HPC Control Center'});
    if (typeof session !== "undefined" && typeof session.userinfo !== "undefined")
	socket.emit ('signin_granted', session.userinfo);

    function EmitError (e) {
	console.log ("EmitError called: " + e.toString());
        socket.emit ('error', {message: e.toString()});
    }

    function BarfIfNotSignedIn () {
    	BarfIfNoSession(); 
	if (typeof session.userinfo === "undefined") 
	    throw new Error ('You are not logged in');
    }

    function BarfIfNoSession () {
    	if (connectionerror !== null || session === null) 
	    throw new Error ('No session established. Cookies are likely disabled on your end');
    }

    function BarfIfNotAdmin () {
	BarfIfNotSignedIn ();
	if ((typeof session.userinfo === 'undefined') || (-1 === session.userinfo.roles.indexOf ('admin')))
	    throw new Error ('You are not authorized to perform the getuserlist operation');
    }

    function BarfIfNotDeveloper () {
	BarfIfNotSignedIn ();
	if ((typeof session.userinfo === 'undefined') || (-1 === session.userinfo.roles.indexOf ('developer')))
	    throw new Error ('Only users with the developer role can perform this operation (this error should not happen)');
    }


    socket.on ('signin', function (signin) {
	    Q.fcall (BarfIfNoSession)
	        .then (function () {
			return users.Q.findOne ({_id: signin.username});
		    })
	        .then (function (doc) {
			if ((doc === null) || ! bcrypt.compareSync (signin.password, doc.bcrypted_password))
			    throw new Error ('Invalid account/password');
			else { 
			    console.log ('SIGNIN SUCCESSFUL doc: <' + util.inspect (doc.userinfo, {colors: true}) + '>');
			    session.userinfo = doc.userinfo;
			    session.save();
			    socket.emit ('signin_granted', doc.userinfo);
			}
		    })
	        .fail (EmitError)
		.done ();
	});


    socket.on ('signout', function () {
	    Q.fcall (BarfIfNotSignedIn)
	        .then (function () {
			console.log ('SIGNOUT  username <' + session.userinfo.username + '>');
			delete session.userinfo; 
			session.save();
		    })
	        .fail (EmitError)
		.done ();
	});


    socket.on ('getuserlist', SendUserList);
    function SendUserList () {
        Q.fcall (BarfIfNotAdmin)
	    .then (function () {
		    return users.Q.find ({_id: {$ne: 'admin'}});
		})
	    .then (function (doc) {
		    var userlist = [];
		    doc.forEach (function (u) {userlist.push (u.userinfo);});
		    socket.emit ('getuserlist_granted', userlist);
		})
	    .fail (EmitError)
	    .done ();
    }


    socket.on ('adduser', function (theuser) {
        Q.fcall (BarfIfNotAdmin)
	    .then (function () {
		    console.log ('ADDUSER  username <' + theuser.username + '>');
	            return users.Q.findOne ({_id: theuser.username});
		})
	    .then (function (doc) {
	            if (doc)
		        throw new Error ('Username <' + theuser.username + '> already exists. Pick another username');
		    return users.Q.insert (new UserInfo ({username: theuser.username, authcode: crypto.randomBytes(12).toString('hex')}));
		})
	    .then (function () {
		    socket.emit ('adduser_granted', {username: theuser.username});
		    SendUserList();
		})
	    .fail (EmitError)
	    .done ();
	});


    socket.on ('deleteuser', function (theuser) {
        Q.fcall (BarfIfNotAdmin)
	    .then (function () {
		    console.log ('DELETEUSER  username <' + theuser.username + '>');
	            return users.Q.findOne ({_id: theuser.username});
		})
	    .then (function (doc) {
	            if (doc === null)
		        throw new Error ('Username <' + theuser.username + '> does not exist.');
		    if (-1 !== doc.userinfo.roles.indexOf ('root'))
		        throw new Error ('You cannot remove the root admin account');
		    return users.Q.remove ({_id: theuser.username});
		})
	    .then (function () {
		    socket.emit ('deleteuser_granted', {username: theuser.username});
		    SendUserList();
		})
	    .fail (EmitError)
	    .done ();
	});


    socket.on ('signup', function (signup) {
	    console.log ('SIGNUP  username <' + signup.username + '>');
	    Q.fcall (BarfIfNoSession)
	        .then (function () {
			return users.Q.findOne ({_id: signup.username});
		    })
	        .then (function (u) {
			if (u === null)
			    throw new Error ('You need to be authorized to use this system. Contact the administrator and ask for an account');
			else if (u.state !== 'waitingforsignup')
			    throw new Error ('You have already signed up on this system. Contact the administrator if you have forgotten your password');
			else if (u.userinfo.authcode !== signup.authcode)
			    throw new Error ('Incorrect authorization code');
			return users.Q.update ({_id: signup.username}, new UserInfo ({username: signup.username, pw: signup.password, state: 'signedup'}));
		    })
		.then (function () {
			return users.Q.findOne ({_id: signup.username});	// Ugh. Waste to do the find again, but the update wasn't returning the user
		    })
		.then (function (u) {
			session.userinfo = u.userinfo; 
			session.save();
			socket.emit ('signup_granted', u.userinfo);
		    })
	        .fail (EmitError)
		.done ();
	});


    socket.on ('getprojectlist', SendProjectList);
    function SendProjectList () {
        Q.fcall (BarfIfNotDeveloper)
	    .then (function () {
		    return users.Q.findOne ({_id: session.userinfo.username});
		})
	    .then (function (doc) {
		    if (doc === null)
		        throw new Error ("Could not find user <" + session.userinfo.username + ">");
		    socket.emit ('getprojectlist_granted', doc.userinfo.projects);
		})
	    .fail (EmitError)
	    .done ();
    }


    socket.on ('addproject', function (theproject) {
	console.log ('ADDPROJECT  projectname <' + theproject.projectname + '>');
        Q.fcall (BarfIfNotDeveloper)
	    .then (function () {
	            return users.Q.findOne ({_id: session.userinfo.username});
		})
	    .then (function (doc) {
	            if (doc === null)	// Should we forcbily logout the user under such situations?
		        throw new Error ('Username <' + session.userinfo.username + '> could not be found');
		    if (doc.userinfo.projects.some (function (p) { return (p.projectname === theproject.projectname)}))
			throw new Error ('Projectname <' + theproject.projectname + '> already exists in your portfolio. Pick another name');
		    else {
			var githook = githookurl + '?user=' + session.userinfo.username + '&project=' + theproject.projectname + '&key=' + crypto.randomBytes(12).toString('hex')
			doc.userinfo.projects.unshift ({projectname: theproject.projectname, githook: githook});
			return users.Q.update ({_id: session.userinfo.username}, doc);
		    }
		})
	    .then (function () {
		    socket.emit ('addproject_granted', {projectname: theproject.projectname});
		    SendProjectList(theproject.projectname);
		})
	    .fail (EmitError)
	    .done ();
	});


    socket.on ('deleteproject', function (theproject) {
        Q.fcall (BarfIfNotDeveloper)
	    .then (function () {
	            return users.Q.findOne ({_id: session.userinfo.username});
		})
	    .then (function (doc) {
	            if (doc === null)
		        throw new Error ('Username <' + session.userinfo.username + '> does not exist.');
		    if (doc.userinfo.projects.some (function (p) { return (p.projectname === theproject.projectname); }))
			return users.Q.update ({_id: session.userinfo.username}, {$pull: {'userinfo.projects': {'projectname': theproject.projectname}}});
		    else
			throw new Error ('Projectname <' + theproject.projectname + '> was not found in your portfolio.');
		})
	    .then (function (n) {
		    if (n === 0)
		        throw new Error ('Something has gone kaput. We tried but could not delete project <' + theproject.projectname + '>');
		    else
			socket.emit ('deleteproject_granted', {theproject: theproject.projectname});
		})
	    .fail (EmitError)
	    .done (SendProjectList);
	});
}

var spawn = require ('child_process').spawn;

exports.launchrun = function (req, res) {
    console.log (req.query);
    junk = spawn ('ls', ['-lrt', '.', 'asdadasd', '..']);

    function appendtoResponse (data) {
	res.write (data);
    }
    junk.stdout.on ('data', appendtoResponse);
    junk.stderr.on ('data', appendtoResponse);
    junk.on ('close', function (code) {
            res.end();
	});
}


exports.exitnow = function (req, res) {
    var str = "";
    if (typeof req.query.markerfile !== 'undefined') {
	str = 'Got an exit command at ' + new Date();
	require('fs').writeFileSync (req.query.markerfile, str);
	res.write (JSON.stringify(req.connection));
	res.end (str);
	setTimeout (process.exit, 1000);
    }
    else {
	str = "Could not determine marker filename " + req.url;
	console.error (str);
	res.end (str);
    }
};
