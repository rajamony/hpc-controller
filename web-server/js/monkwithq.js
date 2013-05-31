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

(function () {

module.exports = wrapMonk;

var Q = require('q');
var monk = require('monk');

// A helper that wraps calls with Q so that the calls now return promises
function WrapWithQ (coll) {
    // console.log ("WrapWithQ called for <" + coll + ">");
    if (typeof coll.Q !== "undefined") {
        console.error ("WrapWithQ: There is already an object named Q!");
	process.exit (1);
    }
    coll.Q = {};
    for (var m in coll) {
	// console.log ("Testing property " + m);
        // if (coll.hasOwnProperty(m)) 
  	if (typeof coll[m] === 'function') {
	    coll.Q[m] = Q.nbind (coll[m], coll);
	    // console.log ("Bound <Q." + m + "> with Q");
	}
    }
}

// Our constructor which just calls the monk constructor, also
// inheriting all the monk methods
function wrapMonk (__varargs__) {
    var realmonk = monk.apply ({}, arguments);
    var realget = realmonk.get;
    realmonk.get = function (x) {
	    // console.log ("The real get is being called with argument <" + x + ">");
    	    var coll = realget.call (realmonk, x);
	    WrapWithQ (coll);
	    return coll;
	};
    return realmonk;
}
wrapMonk.prototype.__proto__ = monk.prototype;

}());
