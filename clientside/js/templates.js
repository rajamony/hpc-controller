(function ($) {
    var prevhash = null;
    var menus = [];
    var socket = io.connect ("/");
    var templatecache = {};
    var self = this;
    var user = null;

    DisplayErrors = function (stringorarrayofstrings) {
	errors = [].concat (stringorarrayofstrings);	// Make it an array - error path, performance doesn't matter
	errors.forEach (function (e) {
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

})(jQuery);
