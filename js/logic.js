var util = require ('util'),
    bcrypt = require ('bcrypt');

function UserInfo (username, pw, fullname, roles) {
    if (typeof roles === 'undefined') roles = ['developer'];
    this.bcrypted_password = bcrypt.hashSync (pw, 8);
    this.username = username;
    this.state = 'waitingforsignup';
    this.userinfo = {
	    username: username,
	    roles: roles,
	    fullname: fullname,
	};
}

exports.Precondition = function (users, fs) {
    var promise = users.findOne ({username: 'admin'});
    promise.on ('error', function (err) {console.error ('Precondition ERROR: ' + err); process.exit (1); });
    promise.on ('success', function (doc) {
	    if (doc === null) {
	        var admin = new UserInfo ('admin', 'foo', 'Administrator', ['admin', 'developer']);
		admin.state = 'signedup';
		users.insert (admin, function (err, doc) {
			console.log ("Precondition: error is <" + err + "> and doc is <" + doc + ">");
		    });
	    }
	});
}

exports.SetupHandlers = function (err, socket, session, users) {
    var self = {err: err};

    function EmitError (e) { socket.emit ('error', {message: e}); return true;}
    function HandleMonkError (err) { console.error ('HandleMonkError: <' + err + '>'); EmitError ('mongo/monk error ' + err); }
    function NotOkayToProceed () { return (self.err === null) ? false : EmitError ('Cookies must be enabled on your browser'); }

    socket.on ('signin', function (signin) {
	    if (NotOkayToProceed()) 
		return;
	    console.log ('SIGNIN  username <' + signin.username + '> password <' + signin.password + '> + current session user-data:' + util.inspect (session.user, {colors: true}));
	    session.user = null;
	    var promise = users.findOne ({username: signin.username});
	    promise.on ('error', HandleMonkError);
	    promise.on ('success', function (doc) {
		    if ((doc === null) || ! bcrypt.compareSync (signin.password, doc.bcrypted_password))
		        EmitError ('Invalid account/password');
		    else { 
			console.log ('SIGNIN SUCCESSFUL doc: <' + util.inspect (doc.userinfo, {colors: true}) + '>');
			socket.emit ('signin_granted', (session.user = doc.userinfo));
		    }
		});
	});

    socket.on ('getuserlist', function () {
	    if (NotOkayToProceed())
		return;
	    console.log ('ADMINISTRATE  current session user-data:' + util.inspect (session.user, {colors: true}));
	    if ((typeof session.user === 'undefined') || (-1 === session.user.roles.indexOf ('admin')))
	        EmitError ('You are not authorized to perform the getuserlist operation');
	    else {
	        var promise = users.find ({username: {$ne: 'XXadmin'}});
		promise.on ('error', HandleMonkError);
		promise.on ('success', function (doc) {
			console.log ('GETUSERLIST SUCCESSFUL doc: <' + util.inspect (doc, {colors: true}) + '>');
			var userlist = [];
			doc.forEach (function (u) {userlist.push (u.userinfo);});
			socket.emit ('getuserlist_granted', userlist);
		    });
	    }
	});

    socket.on ('adduser', function (newuser) {
	    if (NotOkayToProceed())
		return;
	    console.log ('ADDUSER  username <' + newuser.username + '> current session user-data:' + util.inspect (session.user, {colors: true}));
	    if ((typeof session.user === 'undefined') || (-1 === session.user.roles.indexOf ('admin')))
	        EmitError ('You are not authorized to add new users');
	    else {
	        var promise = users.find ({username: newuser.username});
		promise.on ('error', HandleMonkError);
		promise.on ('success', function (doc) {
			console.log ('ADDUSER SUCCESSFUL doc: <' + util.inspect (doc, {colors: true}) + '>');
			if (doc === null)
			    socket.emit ('adduser_granted', {username: newuser.username, authcode: 'gayatri'});
			else
			    EmitError ('Could not add user ' + newuser.username + ' since they already exist');
		    });
	    }
	});

    socket.on ('signup', function (signup) {
	    if (NotOkayToProceed()) 
		return;
	    console.log ('SIGNUP  username <' + signup.username + '> current session user-data:' + util.inspect (session.user, {colors: true}));
	    var promise = users.findOne ({username: signup.username});
	    promise.on ('error', HandleMonkError);
	    promise.on ('success', function (u) {
	    	    if (u === null)
		    	EmitError ('You need to be authorized to use this system. Contact the administrator and ask for an account');
		    else if (u.state !== 'waitingforsignup')
		    	EmitError ('You have already signed up on this system. Contact the administrator if you have forgotten your password');
		    else if (u.authcode !== signup.authcode)
		    	EmitError ('Incorrect authorization code');
		    else {
		    	var newuser = new UserInfo (signup.username, signup.password, 'Unknown');
			var promise = users.insert (newuser);
			promise.on ('success', function (doc) { socket.emit ('signup_granted', (session.user = newuser)); });
			promise.on ('error', function (e) { EmitError ('Could not sign you up. Error: ' + e);});
		    }
		});
	});

    socket.on ('echo', function (data) {
	    console.log ('Got echo request for <' + data + '>');
    	    socket.emit ('echo', data);
	});
}

// user state after admin authorizes must be 'waitingforsignup'
/*
                                password_hashed: server.bcrypt.hashSync("password", 8),
                                emails: ["admin"],
                                roles: ["admin", "developer", "operator"],
                                fullname: "Admin Account"

*/
