(function ($) {
    var user = null;
    var menus = [];
    var socket = io.connect ("/");
    var templatecache = {};

    // See http://stackoverflow.com/questions/8366733/external-template-in-underscore
    function RenderTemplate (templatename, templatedata) {
	if (typeof templatecache[templatename] === 'undefined') {
	    $.ajax({
		url: '/clientside/underscore_templates/' + templatename,
		method: 'GET',
		async: false,
		success: function (data) {
		    templatecache[templatename] = _.template(data);
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
	    if ( lastHash === hash ) {
		    //return;
	    }

	    console.log("Handling hash of " + hash);

	    var path = hash.split('/');
	    var resource = path[1];
	    path.splice(0,2);

	    CheckSession();

	    DismissMessages();

	    $(".eos-nav-button").parent().removeClass("active");

	    //
	    // Be sure to close any previous views
	    //
	    _.each( menus, function(menu) {
		    if ( menu.closeView ) {
			    menu.closeView();
		    }
	    })

	    //
	    //	Select button that ends with our current hash and highlight the parent <li>
	    //
	    if ( resource && resource.length > 0 ) {
		    $(".eos-nav-button[href^=\'#/"+resource+"\']").parent().addClass("active");
	    }

	    var found = false;

	    if ( !user ) {
		    RenderBody();
		    found = true;
	    } else {

		    if ( !resource ) {
			    resource = "";
		    }

		    switch( resource ) {
    case 'oauth':
      var appname = path[0];
      var transactionID = path[1];
      var appid = path[2];
      var query = path[3];

      if (user.authorized_apps.indexOf(appid) >= 0) {
	window.location.replace('/dialog/oauth?'+query);
      } else {
	var formHTML = '<div class="container-fluid">\
	<div class="row-fluid">\
	<div class="span12 well">\
	<form action="/dialog/oauth/decision" method="POST">\
	  <fieldset>\
	    <legend>App authorization</legend>\
	    <span class="help-block">Do you want authorize '+appname+'?<span>\
	    <button type="submit" class="btn" name="cancel" value="Deny">No</button>\
	    <button type="submit" class="btn btn-primary" value="Allow">Yes</button>\
	    <input type="hidden" name="transaction_id" value="'+transactionID+'"></input>\
	  </fieldset>\
	</form></div></div></div>';

	$("#mainbody").html(formHTML);
	//remove topbar!
	$("#topbar").hide();
	break;
      }
			    case "debug":
				    RenderDebug();
				    found = true;
				    break;
			    case "about":
				    RenderAbout();
				    found = true;
				    break;
			    case "docs":
				    RenderDocs();
				    found = true;
				    break;
			    case "logout":
				    Logout();
				    found = true;
				    //window.location.replace(window.location.toString().split("#")[0] + "#/");
				    break;
			    case "":
				    RenderBody();
				    found = true;
				    break;
			    default:
			    {
				    _.each( menus, function(menu) {
					    if ( menu.label.toLowerCase() == resource.toLowerCase() ) {

						    if ( menu.ref.hidden == false ) {
							    menu.OpenView("#mainbody",path);
							    found = true;
						    } else {
							    console.log("Found menu for " + menu.label + " but it is hidden ");
						    }
					    }
				    })

				    if ( !found ) {
					    RenderBody();
					    console.log("Warning: Don't know what to do with action (" + resource + ") yet.");
				    }
				    break;
			    }
		    }
	    }

	    if ( found ) {
		    lastHash = hash;
	    }
    }
    
    $(window).bind('hashchange', function() {
	    console.log("Hash changed")
	    HandleHash(window.location.hash);
    });


    // Now set up the socketIO stuff. We already have our login information 
    socket.on ("authenticate", function (data) {
    	    console.log ("SOCKET: authenticate");
	    socket.emit ('doyouknowme', {data: 'asas'})
	});
    socket.on ("welcomeback", function (data) {
	    console.log ("SOCKET: welcomeback <" + data.name + ">\nCookies: " + document.cookie); 
	    RenderBase();
	    RenderTopbar();
	    $('#mainbody').html(RenderTemplate ('login.template.html', {}));
	});

})(jQuery);
