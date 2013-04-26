(function ($) {
    var prevhash = null;
    var menus = [];
    var socket = io.connect ("/");
    var templatecache = {};
    var self = this;
    var user = null;

    $(window).bind('hashchange', function() { HandleHash(window.location.hash); });
    $(document).ready (function () { HandleHash (window.location.hash);});

    DisplayErrors = function (stringorarrayofstrings) {
	errors = [].concat (stringorarrayofstrings);	// Make it an array - error path, performance doesn't matter
	_.each (errors, function (e) {
		$('#errorbox').prepend ('<p> <i class="icon-exclamation-sign"></i>' + e + '</p>');	// looks nice than an <li>
	    });
        if (errors.length)
	    $('#errorbox').show();
    }

    ClearErrors = function () {
        $('#errorbox').hide();
	$('#errorbox').empty();
    }

    function SetUser (u) {
	user = u;
        console.dir (u);
	// Now let the other views know about new user
	// _.each( menus, function(menu) { if ( menu.NewUser ) { menu.NewUser(newuser); } });
    }

    /* FIXME - this function is polluting the window namespace */
    window.SignIn = function (src) {
	ClearErrors ();
	var username = $('input[name=username]').val();
	var password = $('input[name=password]').val();
	var errors = [];

	if (username.length === 0) errors.push("Username cannot be empty");
	if (password.length === 0) errors.push("Password cannot be empty");
	if (errors.length !== 0)
	    DisplayErrors (errors);
	else {
	    $(src).button('loading');
	    socket.emit ('signin', {username: username, password: password})
	}
    };

    /* FIXME - this function is polluting the window namespace */
    window.SignUp = function(src) {
	ClearErrors();
	var username = $('input[name=signup_username]').val();
	var authcode = $('input[name=signup_authcode]').val();
	var password = $('input[name=signup_password]').val();
	var password2 = $('input[name=signup_password2]').val();
	var errors = [];

	if (username.length === 0) errors.push("Username cannot be empty");
	if (password.length === 0) errors.push("Password cannot be empty");
	if (authcode.length === 0) errors.push("Authorization code cannot be empty");
	if (password !== password2) errors.push("Passwords do not match");

	if (errors.length !== 0)
	    DisplayErrors (errors);
	else {
	    $(src).button('loading');
	    socket.emit ('signup', {username: username, authcode: authcode, password: password});
	}
    }

    /* FIXME - this function is polluting the window namespace */
    window.UpdateUser = function(src) {
	ClearErrors();
	var fullname = $('input[name=settings_fullname]').val();
	var password = $('input[name=settings_password]').val();
	var password2 = $('input[name=settings_password2]').val();
	var errors = [];

	if (fullname.length === 0) errors.push("We need you to have a name");
	if (password.length === 0) errors.push("Password cannot be empty");
	if (password !== password2) errors.push("Passwords do not match");

	if (errors.length !== 0) 
	    DisplayErrors (errors);
	else {
	    $(src).button('loading');
	    socket.emit ('updateuser', {username: user.username, fullname: fullname, password: password});
	}
    }

    // See http://stackoverflow.com/questions/8366733/external-template-in-underscore
    function RenderTemplate (templatename, templatedata) {
	if (typeof templatecache[templatename] === 'undefined') {
	    $.ajax({
		url: '/clientside/underscore_templates/' + templatename,
		method: 'GET',
		async: false,
		success: function (data) {
		    templatecache[templatename] = _.template(data);
		},
		error: function (xhr, status, error) {
		    console.error ("Server side error: " + xhr.responseText + ' ' + error);
		    templatecache[templatename] = _.template (xhr.responseText + '<p>' + error);
		}
	    });
	}
	return templatecache[templatename](templatedata);
    }

    function EOS_NavClick() {
	HandleHash($(this)[0].hash);
    }

    function RenderBase () {
	compiledTmpl = RenderTemplate ('base.template.html', {});
	$('body').html(compiledTmpl);
    }

    function RenderTopbar () {
	compiledTmpl = RenderTemplate ('topbar.template.html', { site_title: "HPC Control Center", user: user, menus: menus });
	$('#topbar').html(compiledTmpl);
	// Associate any eos-nav-buttons with our nav click function
	$('#topbar .eos-nav-button').click(EOS_NavClick);
    }

    function HandleHash (hash) {
	console.log ("\nEntered HandleHash. Current = <" + hash + "> Previous = <" + self.prevhash + ">");
	ClearErrors();
	if (hash === self.prevhash) {
	    console.log ("Hash has not changed!");
	    return;
	}

	hash = hash.replace (/\/+$/,"");
	var path = hash.split ('/');
	if (path.length == 1)
	    path.push ("login");

	RenderBase();
	RenderTopbar();
	switch (path[1]) {
	    case 'welcome':
		$('#mainbody').html(RenderTemplate ('settings.template.html', {u: user}));
		break;
	    case 'administer':
	    	socket.emit ('getuserlist', {});
		break;
	    case 'settings':
		$('#mainbody').html(RenderTemplate ('settings.template.html', {u: user}));
		break;
	    default:		// Default to the login window
	        hash = '#/';	// Force it to the login hash
	    case 'login':
		$('#mainbody').html(RenderTemplate ('login.template.html', {}));
		break;
	}
	window.location.hash = self.prevhash = hash;
    }

    // Now set up the socketIO stuff. We already have our login information 
    socket.on ("signup_granted", function (u) {
	    SetUser (u);
    	    HandleHash ('#/welcome');
	});

    socket.on ("adduser_granted", function (u) {
	    console.log ('User authorized: ');
    	    console.dir (u);
	});

    socket.on ("getuserlist_granted", function (u) {
	    console.log ('Getuserlist granted: ');
    	    console.dir (u);
	    managedusers = u;
	    $('#mainbody').html(RenderTemplate ('administer.template.html', {u: managedusers}));
	});

    socket.on ("signin_granted", function (u) {
	    SetUser (u);
	    HandleHash ('#/welcome');
	});

    socket.on ('error', function (data) {
	    $('#mainbody').html(RenderTemplate ('error.template.html', data));
	});
})(jQuery);
