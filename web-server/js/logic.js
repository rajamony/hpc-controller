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
    operatingenv = null,
    serverstarttime = Date.now();	// formattedtime(new Date()),
    forcelogout = {},		// So we can forcibly log out a user
    activeusers = {};		// To keep track of the various socket endpoints for a specific user

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

function formattedtime (now) {
    function zeropad (n) { return ((n < 10) ? '0' : '') + n.toString(); }
    return zeropad (now.getHours()) + ':' + zeropad (now.getMinutes()) + ':' + zeropad (now.getSeconds()) + ' ' + 
	    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()] + '-' + zeropad (now.getDate()) + '-' + now.getFullYear();
}
 

function removeElement (arr, elem) {
    for (var i = 0; i < arr.length; i++) {
	if (arr[i] === elem)
	    arr.splice (i, 1);
    }
}


exports.setup = function (myenv, fs, users) {
    operatingenv = myenv;
    users.Q.findOne ({_id: 'admin'})
    	.then (function (doc) {
		return (doc !== null) ? doc : users.Q.insert (new UserInfo ({username: 'admin', pw: operatingenv.adminpw, fullname: 'Administrator', roles: ['root', 'admin', 'developer'], state: 'signedup'}));
	    })
	.fail (function (err) {
		console.log ("Setup: error is <" + err + ">");
		process.exit (1);
	    })
	.done (function (doc) {
		if (typeof doc === "undefined")
		    process.exit (1);
		console.log ("Admin account password is <" + operatingenv.adminpw + ">");
	    });
}


function setExceptionHandling (socket) {
    var realon = socket.on;
    socket.on = function (event, fn) {
	    realon.call (socket, event, function () {
		try {
		    fn.apply (socket, arguments);
		}
		catch (e) {
		    console.error ('Uncaught error' + e.toString() + '\n' + e.stack);
		}
	    });
    }
}

exports.main = function (deployer, io, sessionSockets, connectionerror, socket, session, users) {

    function EmitError (e) {
	console.log ("EmitError called: " + e.toString() + '\n' + e.stack);
        socket.emit ('error', {message: e.toString()});
    }

    function BarfIfNoSession () {
    	if (connectionerror !== null || session === null) 
	    throw new Error ('No session established. Cookies are likely disabled on your end');
    }

    function BarfIfNotSignedIn () {
    	BarfIfNoSession(); 
	if (typeof session.userinfo === "undefined") 
	    throw new Error ('You are not logged in');
        if (typeof forcelogout[session.userinfo.username] !== 'undefined')
	    throw new Error ('You have been forcibly logged out elsewhere. Log back in to use the system');
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

    function removeUsersSocket (username, socket) {
	console.log ("    Removing socket from user's list of sockets");
	removeElement (activeusers[username], socket);
	if (activeusers[username].length === 0)
	    delete activeusers[username];
    }

    function signInUser (socket, userinfo) {
	socket.emit ('signin_granted', userinfo);
	if (typeof activeusers[userinfo.username] === 'undefined')	// We are the first socket for this user
	    activeusers[userinfo.username] = [];
        activeusers[userinfo.username].push (socket);	// We will now track this user as they come in over multiple devices
    }


    /*
     *	Function declarations are over, the real work begins
     */

    setExceptionHandling (socket);
    socket.emit('info', { site_title: 'HPC Control Center', serverstarttime: serverstarttime, site_hostname: operatingenv.hostname});  // All see this
    if (typeof session !== "undefined" && typeof session.userinfo !== "undefined") {
	if (typeof forcelogout[session.userinfo.username] === 'undefined') 
	    signInUser (socket, session.userinfo);
	else {
	    delete session.userinfo; 	// They logged out on a different session, so don't let them come in here
	    session.save();
	}
    }

    socket.on ('disconnect', function () {	// Don't send this socket any more notifications
    	    Q.fcall (BarfIfNotSignedIn)
	    .then (function (/* session.userinfo is now valid */) {
		    console.log ('Got a disconnect for user <' + session.userinfo.username + '>');
		    if (typeof activeusers[session.userinfo.username] !== 'undefined')
			removeUsersSocket (session.userinfo.username, socket);
		})
	    .fail(console.log /* its a disconnect, so ignore the Errors thrown from BarfIfNotSignedIn */)
	    .done();
	});

    socket.on ('signin', function (signin) {
	    Q.fcall (BarfIfNoSession)
	        .then (function () {
			return users.Q.findOne ({_id: signin.username});
		    })
	        .then (function (doc) {
			if ((doc === null) || ! bcrypt.compareSync (signin.password, doc.bcrypted_password))
			    throw new Error ('Invalid account/password');
			else { 
			    console.log ('SIGNIN SUCCESSFUL for user <' + doc.userinfo.username + '>');
			    session.userinfo = doc.userinfo;
			    session.save();
			    signInUser (socket, doc.userinfo);
			    if (typeof forcelogout[session.userinfo.username] !== 'undefined')	// Make sure the user will no longer be forcibly logged out
				delete forcelogout[session.userinfo.username];
			}
		    })
	        .fail (EmitError)
		.done ();
	});


    function broadcastToUsersSockets (username, event, data) {
	if (typeof activeusers[username] !== 'undefined')
	    activeusers[username].forEach (function (socket) { socket.emit (event, data); });
    }

    socket.on ('signout', function () {
	    Q.fcall (BarfIfNotSignedIn)
	        .then (function (/* session.userinfo is now valid */) {
			console.log ('SIGNOUT  username <' + session.userinfo.username + '>');
			removeUsersSocket (session.userinfo.username, socket);
			broadcastToUsersSockets (session.userinfo.username, 'forced_logout', {});
			if (typeof activeusers[session.userinfo.username] !== 'undefined') {
			    delete activeusers[session.userinfo.username];
			    forcelogout[session.userinfo.username] = new Date();	// Must force out other established sessions if they exist
			}
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
		    // Do this afresh at each emit because we may use the same DB but be running on a different server
		    doc.userinfo.projects.forEach (function (p) {p.githook = operatingenv.githookurl + '?user=' + session.userinfo.username + '&project=' + p.projectname + '&key=' + p.key;});
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
			doc.userinfo.projects.unshift ({projectname: theproject.projectname, key: crypto.randomBytes(12).toString('hex'), gitdata: []});
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
	    // FIXME: Now blow up the user's project directory 
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
		    socket.emit ('deleteproject_granted', {theproject: theproject.projectname});
		})
	    .fail (EmitError)
	    .done (SendProjectList);
	});

    socket.on ('getallprojectupdates', SendAllProjectUpdates);
    function SendAllProjectUpdates () {
	Q.fcall (BarfIfNotDeveloper)
	    .then (function () {
		    return users.Q.findOne ({_id: session.userinfo.username});
		})
	    .then (function (doc) {
		    var response = [];
		    if (doc === null)
			throw new Error ("Could not find user <" + session.userinfo.username + ">");
		    console.log ("Accumulating project updates into response for getallprojectupdates_granted emit");
		    doc.userinfo.projects.forEach (function (p) {
			    p.gitdata.forEach (function (g) {
				    response.push (g);
				});
			});
		    response.sort (function (a, b) {return a.whenobserved > b.whenobserved;});
		    console.dir (response);
		    socket.emit ('getallprojectupdates_granted', response);
		})
	    .fail (EmitError)
	    .done ();
    }

    socket.on ('getjoblist', function () {
    	    var joblist = deployer.status();
	    var alljobs = [];
	    joblist.active.forEach (function (job) {alljobs.push ({repo: job.repo, sha: job.sha, state: job.state, attempts: job.attempts, daemon: job.isDaemon});});
	    joblist.pending.forEach (function (job) {alljobs.push ({repo: job.repo, sha: job.sha, state: job.state, attempts: job.attempts, daemon: job.isDaemon});});
	    joblist.done.forEach (function (job) {alljobs.push ({repo: job.repo, sha: job.sha, state: job.state, attempts: job.attempts, daemon: job.isDaemon});});
	    joblist.daemons.forEach (function (job) {alljobs.push ({repo: job.repo, sha: job.sha, state: job.state, attempts: job.attempts, daemon: job.isDaemon});});
	    socket.emit ('getjoblist_granted', alljobs);
	});

    socket.on ('killjob', function (job) {
	    console.log ("Got a killjob for repo <" + job.repo + " @ " + job.sha + ">");
    	    deployer.kill (job.repo, job.sha, function (err) {
	    	    if (typeof err === 'undefined')
		        socket.emit ('killjob_granted', job);	// FIXME: Emit the new joblist right here instead of waiting for the client request
		    else
		        EmitError ('Could not kill job <' + job.repo + ',' + job.sha + '> ' + err);
		});
	});
}

function githubUpdate (req) {	// Preserve the raw github data, but parse it into something useful for us also
    var theupdate = {valid: false, projectname: 'unknown', updatebranch: 'unknown', updater: 'unknown', whenobserved: Date.now(),
    		     updatetime: formattedtime(new Date()), commit: 'none', daemon: false };

    if (typeof req.query !== 'undefined' && typeof req.query.user !== 'undefined' && typeof req.query.project !== 'undefined' && typeof req.query.key !== 'undefined') {
	theupdate.daemon = (typeof req.query.daemon === 'undefined') ? false : true;
        theupdate.projectname = req.query.project;
        theupdate.key = req.query.key;
	theupdate.username = req.query.user;
	var gitdata = req.body;
	if (typeof gitdata !== 'undefined' && typeof gitdata.payload !== 'undefined') {
	    theupdate.rawgithubpayload = gitdata.payload;
	    var payload = JSON.parse (gitdata.payload);
	    if (typeof payload.ref !== 'undefined' && typeof payload.head_commit !== 'undefined' && typeof payload.head_commit.author !== 'undefined' 
	    		&& typeof payload.head_commit.author.username !== 'undefined' && typeof payload.head_commit.timestamp !== 'undefined'
			&& typeof payload.after !== 'undefined' && typeof payload.repository.url !== 'undefined') {
		theupdate.updatebranch = payload.ref;
		theupdate.commit = payload.after;
		theupdate.updater = payload.head_commit.author.username;
		theupdate.repositoryurl = payload.repository.url;
		try { theupdate.updatetime = formattedtime(new Date(payload.head_commit.timestamp)); theupdate.valid = true;}
		catch (e) { console.log ('githubUpdate: Could not make sense of timestamp <' + payload.head_commit.timestamp + '>'); }
	    }
	}
    }
    theupdate.projectdir = theupdate.username + '/' + theupdate.projectname + '/' + theupdate.commit;
    theupdate.outdir = operatingenv.outdir + '/' + theupdate.projectdir;
    return theupdate;
}


exports.projectupdate = function (deployer, io, sessionSockets, users, req, res) {
    var spawn = require ('child_process').spawn;
    var theupdate = new githubUpdate (req);

    if (! theupdate.valid) {
	console.log ('projectupdate: ERROR parsing github update\nreq.query = ' + util.inspect (req.query) + '\nreq.body = ' + util.inspect (req.body) + '\n');
        return;	// We couldn't even parse the github update, so we're outta here 
    }
    console.log ('PROJECTUPDATE: Details = ' + util.inspect (theupdate));

    function informThisUsersSockets (fn) {
	for (var u in activeusers) {
	    if (activeusers.hasOwnProperty (u) && (u === theupdate.username)) {
		console.log ('Checking sockets for user <' + u + '>');
		activeusers[u].forEach (fn);
	    }
	}
    }

    users.Q.findOne ({_id: theupdate.username})
    .then (function (doc) {
	    if (doc === null)	// Whoa! The user doesn't exist anymore?
		throw new Error ('Username <' + theupdate.username + '> could not be found');
	    if (! doc.userinfo.projects.some (function (p) { return (p.projectname === theupdate.projectname && p.key === theupdate.key);}))
		throw new Error ('Projectname <' + projectname + '> could not be found or the supplied key was invalid');
	})
    .then (function () {
	    return users.Q.update ({_id: theupdate.username, 'userinfo.projects': {$elemMatch: {'projectname': theupdate.projectname, 'key': theupdate.key}}}, 
				{$push: {'userinfo.projects.$.gitdata': theupdate}});	// FIXME: Trim array to prevent blowup
	})
    .then (function () {
	    //var bringover = spawn ('./pullprojectandrun.sh', [theupdate.projectdir, theupdate.repositoryurl, theupdate.updatebranch]);
	    //bringover.stdout.on ('data', function (data) { res.write (data) });
	    //bringover.stderr.on ('data', function (data) { res.write (data) });
	    //bringover.on ('close', function (code) { res.end(); });
	    deployer.add(theupdate.repositoryurl, theupdate.commit, theupdate.daemon);
	})
    .then (function () {
	    informThisUsersSockets (function (socket) { socket.emit ('projectupdate', theupdate); });
	})
    .fail (function (e) {
	    informThisUsersSockets (function (socket) { socket.emit ('error', {message: e.toString()})});
	})
    .done ();

}

exports.exitnow = function (req, res) {
    res.end ('Got an exit command at ' + new Date());
    setTimeout (process.exit, 1000);	// An inelegant way of making sure the response is received before the server dies
};
