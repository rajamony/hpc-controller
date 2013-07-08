/****************************************************************************
 * Licensed Materials - Property of IBM 
 * Copyright (C) IBM Corp. 2013, All Rights Reserved
 * 
 * This program and the accompanying materials are made available under
 * the terms of the Eclipse Public License v1.0 which accompanies this
 * distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 * 
 * US Government Users Restricted Rights - Use, duplication or 
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 * 
 * Contributor(s): Ram Rajamony and Ahmed Gheith, IBM
 *
 ***************************************************************************/

'use strict';

var globsocket;

// Declare app level module which depends on filters, and services
var app = angular.module('myApp', ['ui.bootstrap'])
  .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $routeProvider.when('/administer',	                {templateUrl: '/html/admin.angular.html', 	  controller: AdministerCtrl});
    $routeProvider.when('/', 		                {templateUrl: '/html/login.angular.html', 	  controller: FrontDoorCtrl});
    $routeProvider.when('/develop', 	                {templateUrl: '/html/develop.angular.html', 	  controller: DevelopCtrl});
    $routeProvider.when('/settings', 	                {templateUrl: '/html/settings.angular.html',	  controller: SettingsCtrl});
    $routeProvider.when('/status', 	                {templateUrl: '/html/status.angular.html',	  controller: StatusCtrl});
    $routeProvider.when('/projectstatus/:projectname',  {templateUrl: '/html/projectstatus.angular.html', controller: ProjectStatusCtrl});
//  Access a property foo in the $routeProvider argument as $route.current.foo

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
  

function formattedtime (now) {
    function zeropad (n) { return ((n < 10) ? '0' : '') + n.toString(); }
    return now.getFullYear() + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()] + '-'
    		+ zeropad (now.getDate()) + ' '
      		+ zeropad (now.getHours()) + ':' + zeropad (now.getMinutes()) + ':' + zeropad (now.getSeconds()) + ' (local)';
}
 
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
    var therealsocket = this.therealsocket;
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

wrappedSocket.prototype.emit = function (event, data, fn) {
    var therealsocket = this.therealsocket;
    var applyscope = this.applyscope;
    var commonwrapper = function (__varargs__) {
	var varargs = arguments;
	if (typeof fn !== 'undefined')
	    applyscope.$apply (function () {
		fn.apply (therealsocket, varargs);
	      });
      };
    therealsocket.emit (event, data, commonwrapper);
}

wrappedSocket.prototype.cleanUp = function () {
    var therealsocket = this.therealsocket;
    this.handlers.forEach (function (h) {
        therealsocket.removeListener (h.event, h.fn);
      });
}

wrappedSocket.prototype.emit = function (event, data) {
    this.therealsocket.emit (event, data);
}


/**
 * MainCtrl: handles housekeeping functions, root scope management, and signing out
 * While we explicitly pass in $rootScope to the injector, we could just as well have
 * passed in $scope, since $scope === $rootScope at the root
 */
MainCtrl.$inject = ['$rootScope', '$location', 'pocket', '$window'];
function MainCtrl (rootscope, $location, wrappedsocket, thewindow) {
console.log ("MainCtrl INVOKED");
  rootscope.error = [];		// No errors when we begin
  rootscope.user = null;	// No user when we begin
  rootscope.projectactivity = [];	// So its available even we move around
  rootscope.alreadygotaninfo = false;	// To keep track of server reboots

  var socket = wrappedsocket(rootscope);

  /**
   * Common handlers. The server sends out certain events across all views. The socket.io handlers for these events
   * need to be in place for all controllers. 
   */
  function commonSignInUp (u) {
    rootscope.SetUser (u);
    console.log ("signin_granted: User is " + u + " path is " + $location.path());
    if (-1 !== ['/', '/logout'].indexOf($location.path()))
      $location.path ((-1 === u.roles.indexOf ('admin')) ? '/develop' : '/administer');
  }

  socket.on ("signin_granted", commonSignInUp);

  socket.on ("signup_granted", commonSignInUp);

  socket.on('info', function (data) {
      if (rootscope.alreadygotaninfo)
          thewindow.location.reload();	// The second time we get an info, we reload the page since the client pages may also have changed
      rootscope.site_title = data.site_title;
      rootscope.site_hostname = data.site_hostname;
      rootscope.serverstarttime = formattedtime (new Date(data.serverstarttime));
      rootscope.statusplotstarttime = Date.now() - data.runningfortime;
      console.log ("Zero time on statut plot is " + (Date.now() - rootscope.statusplotstarttime)/1000 + " right NOW");
      rootscope.alreadygotaninfo = true;
    });

  socket.on ('error', function (data) {
      console.log ("Got an error: [" + data.seqno + "] " + data.message);
      rootscope.error.push (data.message);
    });

  socket.on ('forced_logout', function () {
      console.log ("You've logged out elsewhere. Kicking you out here too");
      rootscope.ClearErrors();
      rootscope.UnsetUser();
      $location.path ('/');
    });

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
function FrontDoorCtrl ($scope, $location, wrappedsocket, $route, rootscope) {

  var socket = wrappedsocket ($scope);

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
      $scope.allselected = false;
      $scope.ClearErrors();
      $scope.managedusers.forEach (function (u) {
              if (u.mustact) {
                  socket.emit ("deleteuser", {username: u.username});
	      }
          });
  }

  socket.on ("getuserlist_granted", function (u) {
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
  var socket = wrappedsocket ($scope);

  socket.emit ("getprojectlist", {});
  socket.emit ("getallprojectupdates", {});

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

  socket.on ("addproject_granted", function (u) {
      console.log ('Project added: ' + JSON.stringify(u));
      // socket.emit ("getallprojectupdates", {});		// If the project list is changed, refresh the project update view
    });
  socket.on ("deleteproject_granted", function () {
      socket.emit ("getallprojectupdates", {});		// If the project list is changed, refresh the project update view
    });


  socket.on ("getprojectlist_granted", function (p) {
      $scope.myprojects = p;
      console.log ('myprojects:');
      console.dir (p);
    });

  function addToProjectUpdate (u) {
    var update = {name: u.projectname, outdir: u.outdir, 
    			statusmsg: 'Project <' + u.projectname + '> updated on branch <' + u.updatebranch + '> by ' + u.updater + ' at ' + u.updatetime};
    $scope.projectactivity.unshift (update); 
    console.log ('Project update: ' + update.statusmsg + update.outdir);
  }

  socket.on ('getallprojectupdates_granted', function (updates) {
      $scope.projectactivity = [];
      updates.forEach (function (u) {addToProjectUpdate (u);});
    });

  socket.on ('projectupdate', function (u) { addToProjectUpdate (u);});
}

/**
 * SettingsCtrl: allowing users to change their settings
 */
SettingsCtrl.$inject = ['$scope', '$location', 'pocket', '$rootScope'];
function SettingsCtrl ($scope, $location, wrappedsocket, rootscope) {
}

/**
 * ProjectStatusCtrl: support for developers to work with a specific project update.
 * Here is where I expect a developer to spend the brunt of their time
 */
ProjectStatusCtrl.$inject = ['$scope', '$location', 'pocket', '$rootScope', '$routeParams'];
function ProjectStatusCtrl ($scope, $location, wrappedsocket, rootscope, routeparams) {
  $scope.projectname = routeparams.projectname;
  var socket = wrappedsocket ($scope);

  socket.emit ("getprojectstatus", {projectname: $scope.projectname});
}

/**
 * StatusCtrl: support for displaying job status
 */
StatusCtrl.$inject = ['$scope', '$location', 'pocket', '$rootScope'];
function StatusCtrl ($scope, $location, wrappedsocket, rootscope) {
  $scope.numjobstoactupon = 0;
  $scope.joblog = [];
  $scope.joblist = [];
  $scope.unplottedjobs = [];
  rootscope.ClearErrors();
  var socket = wrappedsocket ($scope);
  var plotcolors = ['red', 'green', 'blue', 'yellow', 'aqua', 'purple', 'lime'];

  socket.emit ("getjoblist", {});

  $scope.KillJobs = function () {
    $scope.ClearErrors();
    $scope.joblist.forEach (function (u) {
        if (u.mustact) {
	  var killit = {repo: u.repo, sha: u.sha};
          socket.emit ("killjob", killit);
	  console.log ("Sending killjob for ");
	  console.dir (killit);
        }
      });
  }

  $scope.KillAllJobs = function () {
    $scope.ClearErrors();
    socket.emit ("killalljobs", {});
  }

  $scope.JobSelected = function (applicabletoone, value) {
    if (applicabletoone) 
      $scope.numjobstoactupon += value ? 1 : -1;
    else {
      $scope.joblist.forEach (function (u) {u.mustact = value;});
      var killablejobs = 0;
      $scope.joblist.forEach (function (u) {killablejobs += (u.state != "done");});
      $scope.numjobstoactupon = value * killablejobs;
    }
  }

  socket.on ("killjob_granted", function () {
      socket.emit ("getjoblist", {});		// If the job list changes, refresh the job view
    });

  socket.on ("askforthejoblist", function () { socket.emit ("getjoblist", {}); });

  var plot = { height: 0 /* Height of the enclosing div */, width: 960 /* Width of the enclosing div */ };

  function makeStageAndPlots (numjobs) {
    console.log ("Making stage for " + numjobs + " plots");
    plot.height = 150;
    var stage = new Kinetic.Stage({ container: 'jobstatusplot', width: plot.width, height: numjobs * plot.height });
    var outline = new Kinetic.Layer();
    outline.add (new Kinetic.Rect({ x: 0, y: 0, width: plot.width, height: numjobs * plot.height, stroke: 'black', strokeWidth: 2 }));
    stage.add (outline);

    var z = parseInt ((Date.now() - rootscope.statusplotstarttime)/1000);
    for (var i = 0; i < numjobs; i++) {
      $scope.joblist[i].plot = new Jobplot ({dimensions: {x1: 0, x2: plot.width, y1: i*plot.height, y2: (i+1)*plot.height}, ticks: {zero: z, num: 10, dt: 10}, color: plotcolors[i % plotcolors.length]});
      console.log ("New plot: " + plotcolors[i % plotcolors.length] + ", dimension: " + i*plot.height + " - " + (i+1)*plot.height);
      $scope.joblist[i].plot.animateaxis.start();
      stage.add ($scope.joblist[i].plot.layer);

      // Now add this job's status to the plot. Go through the joblog to find the most recent update for this job 
      var gotit = false;
      for (var k = 0; k < $scope.joblog.length; k++) {	// joblog has most recent at the front
        var jobupdate = $scope.joblog[k];
	if ((jobupdate.sha === $scope.joblist[i].sha) && (jobupdate.repo === $scope.joblist[i].repo)) {
	  gotit = true;
	  if (isPlottableState (jobupdate.newstate) || (typeof $scope.joblist[i].plot !== 'undefined')) 	// Plottable job OR we are already plotting it
	    $scope.joblist[i].plot.addData (jobupdate.when, jobupdate.oldstate, jobupdate.newstate); // Add this status update to the plot
	  break;
	}
      }
      if (gotit === false)
	$scope.joblist[i].plot.addData (z, 'new', $scope.joblist[i].state); // Add this status update to the plot
    }
    $scope.stage = stage;
    // return stage;
  }

  function isPlottableState (state) {
      return (state !== 'failed' && state !== 'done');
  }

  socket.on ("getjoblist_granted", function (p) {
      $scope.joblist = p;
      console.log ('joblist:');
      console.dir (p);
      // Make the stage anew because the number of jobs has likely changed
      if (typeof $scope.stage !== 'undefined')
	$scope.stage.remove();

      var num = 0;
      $scope.joblist.forEach (function (j) { num += isPlottableState (j.state); });
      var num = $scope.joblist.length;
      if (num)
	makeStageAndPlots (num);

      $scope.unplottedjobs.forEach (plotJob);
      $scope.unplottedjobs = [];
    });

  function plotJob (job) {
    for (var i = 0; i < $scope.joblist.length; i++) {
      if (($scope.joblist[i].repo === job.repo) && ($scope.joblist[i].sha === job.sha)) {
	$scope.joblist[i].state = job.newstate;
	$scope.joblist[i].attempts = job.attempts;
	if (isPlottableState (job.newstate) || (typeof $scope.joblist[i].plot !== 'undefined')) {	// Plottable job OR we are already plotting it
	  if (! $scope.joblist[i].plot.addData (job.when, job.oldstate, job.newstate)) { // Add this status update to the plot
	    rootscope.error.push ("Could not process job status update");
	    console.log ("ERROR: status update " + JSON.stringify (job) + " could not be processed");
	  }
	}
        return true;
      }
    }
    return false;
  }

  socket.on ('jobstatusupdate', function (job) {
      var j = job;
      j.trimmedsha = j.sha.substring (0, 5) + "...";
      console.log ("jobstatusupdate " + JSON.stringify (job));
      var spacing = ['  ', ' '];
      j.when = j.when.toFixed(2);
      j.when = ((j.when.length <= 5) ? spacing[j.when.length - 4] : '') + j.when;
      $scope.joblog.unshift (j);
      if (! plotJob (job)) {
	$scope.unplottedjobs.push (job);
	console.log ("jobstatusupdate: Pending find job corresponding to " + j.trimmedsha);
      }
    });
}

// TODO: In the Deployer, when removing an unhappy job, send a status notification to the client UI. Done. Needs testing
