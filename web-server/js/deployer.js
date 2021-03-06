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


var HIBERNATIONTIME = 60;

var queue = [];
var active = null;
var daemons = [];
var done = [];
var spawn = require ('child_process').spawn;
var fs = require('fs');
var basetime = Date.now();

var mylogic = null;

function setLogic (logic) {
    mylogic = logic;
}

function printQueue() {
    queue.forEach(function(p) {
        console.log(JSON.stringify(p));
    });
}

function elapsedTime () {
    return (Date.now() - basetime) / 1000;
}

function setState (thejob, newstate) {
    console.log ('setState ' + thejob.repo + '@' + thejob.sha + ' ' + thejob.state + ' --> ' + newstate);
    mylogic.informAdmin ('jobstatusupdate', {attempts: thejob.attempts, repo: thejob.repo, sha: thejob.sha, oldstate: thejob.state, newstate: newstate, when: elapsedTime()});
    thejob.state = newstate;
}

function getNextJob () {
    for (var i = 0; i < queue.length; i++) {
        var j = queue[i];
	if (j.hibernatecount >= 0) {
	    queue.splice (i, 1);
	    return j;
	}
    }
    return null;
}

setInterval(function() {
    queue.forEach (function (j) {j.hibernatecount += 1;});
    if ((active == null) && (queue.length != 0)) {
        active = getNextJob(); // queue[0];
	if (active === null)
	    return;

        setState (active, 'active');
        active.attempts += 1;
    	console.log ('DATA> pending rm ' + active.repo + '@' + active.sha + ' ' + elapsedTime()); 
        console.log('trying: ' + active.repo + '@' + active.sha);

        var proc = spawn('./run.sh', [active.repo, active.sha], { detached : true });
        active.theproc = proc;
    	console.log ('DATA> active spawn ' + active.repo + '@' + active.sha + ' ' + elapsedTime()); 

        proc.stdout.on ('data', function (data) {
            var s = data.toString();
            console.log (s);
            active.out += s;
        });
        proc.stderr.on ('data', function (data) {
            var s = data.toString();
            console.log (s);
            active.err += s;
        });
        proc.on ('exit', function (code,signal) {
            console.log ("Got exit for <" + active.repo + " @ " + active.sha + "> with code " + code + " and signal " + signal);
	    fs.exists(active.sha + '/unhappy',function(ex) {
		if (ex) {
		    // unhapy, try again
		    setState (active, 'unhappy');
		    console.log ('DATA> active exitunhappy ' + active.repo + '@' + active.sha + ' ' + elapsedTime());
		    active.hibernatecount = 0 - HIBERNATIONTIME;
		    queue.push(active);
		    console.log ('DATA> pending add ' + active.repo + '@' + active.sha + ' ' + elapsedTime()); 
		} else {
		    if (code === 0) {
			// happy, done
			done.push(active);
			setState (active, 'done');
			console.log ('DATA> active exitdone ' + active.repo + '@' + active.sha + ' ' + elapsedTime());
		    } else {
			setState (active, 'failed');
			done.push(active);
			console.log ('DATA> active exitfailed ' + active.repo + '@' + active.sha + ' ' + elapsedTime());
		    }
		}
		active = null;
	    });
        });
    }
},1000);

function addDaemon(repo,sha) {

}

function add(repo,sha,isDaemon) {

    if ((active != null) && (active.repo == repo) && active.sha == sha) {
        console.log('already active');
        return;
    }

    for(i in queue) {
        var p = queue[i];
        console.log('looking at: ' + p.repo + ' ' + p.sha);
        if ((p.repo == repo) && (p.sha == sha)) {
            console.log('already there');
            return;
        }
    }

    for(i in daemons) {
        var p = daemons[i];
        console.log('looking at: ' + p.repo + ' ' + p.sha);
        if ((p.repo == repo) && (p.sha == sha)) {
            console.log('already daemon');
            return;
        }
    }

    var job = { hibernatecount: 0, isDaemon : isDaemon, repo : repo, sha : sha, out : '', err : '', attempts : 0, state : 'new', theproc: null};

    if (isDaemon) {
        setState (job, 'active');
        job.attempts += 1;
        daemons.push (job);
        mylogic.informAdmin ('askforthejoblist', {});
        console.log('running daemon: ' + job.repo + '@' + job.sha);
        
        var proc = spawn('./run.sh', [job.repo, job.sha], { detached : true });
    	console.log ('DATA> daemon spawn ' + job.repo + '@' + job.sha + ' ' + elapsedTime()); 
        job.theproc = proc;

        proc.stdout.on ('data', function (data) {
            var s = data.toString();
            console.log (s);
            job.out += s;
        });
        proc.stderr.on ('data', function (data) {
            var s = data.toString();
            console.log (s);
            job.err += s;
        });
        proc.on ('exit', function (code,signal) {
            console.log ("Got exit for <" + job.repo + " @ " + job.sha + "> with code " + code + " and signal " + signal);
            if (code === 0) {
                console.log ('DATA> daemon exitdone ' + job.repo + '@' + job.sha + ' ' + elapsedTime());
                setState (job, 'done');
            } else {
            console.log ('DATA> daemon exitfailed ' + job.repo + '@' + job.sha + ' ' + elapsedTime());
                setState (job, 'failed');
            }
            done.push(job);
            daemons.splice(daemons.indexOf(job),1);

        });
    } else {
        queue.push(job);
        console.log ('DATA> pending add ' + job.repo + '@' + job.sha + ' ' + elapsedTime()); 
        console.log('added normal');
        mylogic.informAdmin ('askforthejoblist', {});
    }
}

function tryToKillJob (job, repo, sha) {
    if ((job.repo === repo) && (job.sha === sha)) {
        console.log ("tryToKillJob: Killing job repo <" + job.repo + " @ " + job.sha + ">");
        setState (job, 'killing');
        //job.theproc.kill ('SIGKILL');
        spawn("kill",["-9",-job.theproc.pid]);
    }
}

function kill (repo, sha) {
    if (active !== null)
       tryToKillJob (active, repo, sha);

    daemons.forEach (function (job) {
            tryToKillJob (job, repo, sha);
    });

    queue.forEach (function (job) {
	    if ((job.repo === repo) && (job.sha === sha)) {
		console.log ("kill: Removing unhappy job from queue");
		queue.splice(queue.indexOf(job),1);
	    }
	});
}

function killAll() {
    queue = [];

    if (active !== null)
        tryToKillJob(active, active.repo, active.sha);

    daemons.forEach (function (job) {
            tryToKillJob (job, job.repo, job.sha);
    });
}

function showOne(p,res) {
    res.write('<tr>');

    res.write('<td>');
    res.write(p.repo);
    res.write('</td>');

    res.write('<td>');
    res.write(p.sha);
    res.write('</td>');

    res.write('<td>');
    res.write('' + p.attempts);
    res.write('</td>');

    res.write('<td>');
    res.write(p.state);
    res.write('</td>');

    res.write('<td>');
    res.write(p.isDaemon);
    res.write('</td>');

    res.write('</tr>');
}

function dump(req,res) {
     res.writeHead(200, { 'Content-Type' : 'text/html'});
     res.write('<html>');
     res.write('<body>');
 
     res.write('<h1>');
     res.write('Status');
     res.write('</h1>');
     res.write('<table>');
 
     queue.forEach(function(p) { showOne(p,res); });
     daemons.forEach(function(p) { showOne(p,res); });
     if (active != null) {
         showOne(active,res);
     }
     done.forEach(function(p) { showOne(p,res); });
 
     res.write('</table>');
     res.write('</body>');
     res.write('</html>');
     res.end();
    
}

function status(/* req,res */) {
//     res.writeHead(200, { 'Content-Type' : 'text/html'});
//     res.write('<html>');
//     res.write('<body>');
// 
//     res.write('<h1>');
//     res.write('Status');
//     res.write('</h1>');
//     res.write('<table>');
// 
//     queue.forEach(function(p) { showOne(p,res); });
//     if (active != null) {
//         showOne(active,res);
//     }
//     done.forEach(function(p) { showOne(p,res); });
// 
//     res.write('</table>');
//     res.write('</body>');
//     res.write('</html>');
//     res.end();
    return {pending: queue, active: active === null ? [] : [ active ], daemons: daemons, done: done};
    // FIXME: The above is a crude, temporary fix so that I can test the rest of my code -rajamony
}

exports.add = add;
exports.status = status;
exports.dump = dump;
exports.kill = kill;
exports.killAll = killAll;
exports.setLogic = setLogic;

