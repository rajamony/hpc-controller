'use strict';

var globsocket;

// Declare app level module which depends on filters, and services
var app = angular.module('myApp', [])
  .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $routeProvider.when('/administer',	{templateUrl: '/html/admin.angular.html', 	controller: AdministerCtrl});
    $routeProvider.when('/', 		{templateUrl: '/html/login.angular.html', 	controller: FrontDoorCtrl, myaction: 'signin'});
    $routeProvider.when('/logout', 	{templateUrl: '/html/login.angular.html', 	controller: FrontDoorCtrl, myaction: 'signout'});
    $routeProvider.when('/develop', 	{templateUrl: '/html/develop.angular.html', 	controller: DevelopCtrl});
//  $routeProvider.when('/settings', 	{templateUrl: '/html/settings.angular.html',	controller: SettingsCtrl});

    $routeProvider.otherwise({redirectTo: '/'});
//  $locationProvider.html5Mode(true);
  }])
  .factory ('pocket', function ($rootScope) {
    console.log ("FACTORY invoked");
    var psocket = io.connect();
    return function (localscope) {
	var wrappedsocket = new wrappedSocket (psocket, localscope /* $rootScope */);
	localscope.$on ('$destroy', wrappedsocket.cleanUp.bind (wrappedsocket));
	return wrappedsocket;
      };
  });
  
/**
 * socket.io's "on" handler's can be stacked to enable multiple handlers to be invoked on the same event. 
 * This creates a problem for us when we specify socket.on handlers within a controller because Angular
 * invokes a controller anew each time a location-based route is visited anew. The trick is to use Angular's 
 * $on $destroy event which Angular kindly calls before it tears down a controller's scope. Upon receiving 
 * a $destroy, we remove only those event handlers on the socket that were queued up within that scope.
 */

function wrappedSocket (therealsocket, applyscope) {
    this.handlers = [];
    this.applyscope = applyscope;
    this.therealsocket = therealsocket;
}

wrappedSocket.prototype.on = function (event, fn) {
    console.log ('--> adding listener for event <' + event + '> Callback:\n' + fn.toString());
    var therealsocket = this.therealsocket
    var applyscope = this.applyscope;
    var commonwrapper = function (__varargs__) {
	var varargs = arguments;
        applyscope.$apply (function () {
            fn.apply (therealsocket, varargs);
          });
      };
    this.handlers.push ({event: event, fn: commonwrapper});	// To help get rid of it later
    therealsocket.on (event, commonwrapper);
}

wrappedSocket.prototype.cleanUp = function () {
    var therealsocket = this.therealsocket;
    this.handlers.forEach (function (h) {
	console.log ('    cleanup: removing handler for event <' + h.event + '> '); //  Callback:\n' + h.fn.toString());
        therealsocket.removeListener (h.event, h.fn);
      });
}

wrappedSocket.prototype.emit = function (event, data) {
    this.therealsocket.emit (event, data);
}


/* Services */
// Demonstrate how to register services
// In this case it is a simple value service.
/*
angular.module ('myServices', []).
  factory ('pocket', function ($rootScope) {
    console.log ("FACTORY invoked");
    var psocket = io.connect();
    return new wrappedSocket (psocket, $rootScope);
  });

*/ 

/**
 * MainCtrl: handles housekeeping functions, root scope management, and signing out
 * While we explicitly pass in $rootScope to the injector, we could just as well have
 * passed in $scope, since $scope === $rootScope at the root
 */
MainCtrl.$inject = ['$rootScope', '$location', 'pocket'];
function MainCtrl (rootscope, $location, wrappedsocket) {
console.log ("MainCtrl INVOKED");
  rootscope.error = [];		// No errors when we begin
  rootscope.user = null;	// No user when we begin

  var socket = wrappedsocket(rootscope);

  console.dir (socket);

  /**
   * Common handlers. The server sends out certain events across all views. The socket.io handlers for these events
   * need to be in place for all controllers. 
   */
  socket.on('info', function (data) {
      rootscope.site_title = data.site_title;
    });

  socket.on ('error', function (data) {
      console.log ("Got an error: [" + data.seqno + "] " + data.message);
      rootscope.error.push (data.message);
    });

  function commonSignInUp (u) {
    rootscope.SetUser (u);
    console.log ("signin_granted: User is " + u + " path is " + $location.path());
    if (-1 !== ['/', '/logout'].indexOf($location.path()))
      $location.path ((-1 === u.roles.indexOf ('admin')) ? '/develop' : '/administer');
  }
  socket.on ("signin_granted", commonSignInUp);
  socket.on ("signup_granted", commonSignInUp);

  /**
   * Common helpers. Other controllers invoke them via the rootScope 
   */
  rootscope.ClearErrors = function () {
      rootscope.error.length = 0;
  }

  rootscope.SetUser = function (u) {
    rootscope.user = u;
  };

  rootscope.UnsetUser = function () {
    delete rootscope.user;
  };

  /**
   * Signing out belongs here rather than in the Frontdoor controller because a user can sign out
   * from any point within the site.
   */
  rootscope.SignOut = function () {
    console.log ("SignOut called");
    rootscope.ClearErrors();
    rootscope.UnsetUser();
    socket.emit ("signout", {});
  }
}


/**
 * FrontDoorCtrl: handles authentication and sign up (for authorized users) but NOT sign out.
 */
FrontDoorCtrl.$inject = ['$scope', '$location', 'pocket', '$route', '$rootScope'];
function FrontDoorCtrl ($scope, $location, socket, $route, rootscope) {
  console.log ("FrontDoorCtrl INVOKED");

  if ($route.current.myaction === 'signout')
      rootscope.SignOut();

  $scope.SignIn = function () {
      rootscope.ClearErrors();
      socket.emit ("signin", {username: this.username, password: this.password});
  }

  $scope.SignUp = function () {
      rootscope.ClearErrors();
      socket.emit ("signup", {username: this.username, password: this.password, authcode: this.authcode});
  }
}


/**
 * AdministerCtrl: support for administering users
 */
AdministerCtrl.$inject = ['$scope', '$location', 'pocket', '$rootScope'];
function AdministerCtrl ($scope, $location, wrappedsocket, rootscope) {
console.log ("AdministerCtrl INVOKED");
  $scope.numuserstoactupon = 0;
  $scope.managedusers = null;
  var socket = wrappedsocket ($scope);

  socket.emit ("getuserlist", {});

  $scope.AddUser = function () {
      rootscope.ClearErrors();
      socket.emit ("adduser", {username: this.username});
  }

  $scope.UserSelected = function (applicabletoone, value) {
      if (applicabletoone) 
	  $scope.numuserstoactupon += value ? 1 : -1;
      else {
	  $scope.managedusers.forEach (function (u) {u.mustact = value;});
	  $scope.numuserstoactupon = value * $scope.managedusers.length;
      }
  }

  $scope.RegenerateAuthCode = function () {
      $scope.ClearErrors();
      $scope.managedusers.forEach (function (u) {
              if (u.mustact) {
                  socket.emit ("regenerateauthcode", {username: u.username});
	      }
          });
  }

  $scope.DeleteUser = function () {
      $scope.ClearErrors();
      $scope.managedusers.forEach (function (u) {
              if (u.mustact) {
                  socket.emit ("deleteuser", {username: u.username});
	      }
          });
  }

  socket.on ("getuserlist_granted", function (u) {
      console.log ("    Got a getuserlist_granted");
      $scope.managedusers = u;
    });

  socket.on ("adduser_granted", function (u) {
      console.log ('User authorized: ' + JSON.stringify(u));
    });
}

/**
 * DevelopCtrl: support for developers to work with projects
 */
DevelopCtrl.$inject = ['$scope', '$location', 'pocket', '$rootScope'];
function DevelopCtrl ($scope, $location, wrappedsocket, rootscope) {
  $scope.numprojectstoactupon = 0;
  console.log ("DevelopCtrl INVOKED");
  var socket = wrappedsocket ($scope);

  socket.emit ("getprojectlist", {});

  $scope.AddProject = function () {
    $scope.ClearErrors();
    socket.emit ("addproject", {projectname: this.projectname});
  }

  $scope.ProjectSelected = function (applicabletoone, value) {
    if (applicabletoone) 
      $scope.numprojectstoactupon += value ? 1 : -1;
    else {
      $scope.myprojects.forEach (function (u) {u.mustact = value;});
      $scope.numprojectstoactupon = value * $scope.myprojects.length;
    }
  }

  $scope.DeleteProject = function () {
    $scope.ClearErrors();
    $scope.myprojects.forEach (function (u) {
        if (u.mustact)
          socket.emit ("deleteproject", {projectname: u.projectname});
      });
  }
  console.log ("DevelopCtrl INVOKED2");

  socket.on ("getprojectlist_granted", function (u) {
      $scope.myprojects = u;
    });

  socket.on ("addproject_granted", function (u) {
      console.log ('Project added: ' + JSON.stringify(u));
    });
}
