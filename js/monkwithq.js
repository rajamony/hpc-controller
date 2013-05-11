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
 * Wrap monk calls with Promises/A+-compliant Q library
 * Written by: Ram Rajamony, IBM Research, Austin, TX
 *
 */

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
