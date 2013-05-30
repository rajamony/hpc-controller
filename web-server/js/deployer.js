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


var queue = [];
var active = null;
var daemons = [];
var done = [];
var spawn = require ('child_process').spawn;
var fs = require('fs');

function printQueue() {
	queue.forEach(function(p) {
        console.log(JSON.stringify(p));
	});
}


setInterval(function() {
    if ((active == null) && (queue.length != 0)) {
    	active = queue[0];
    	active.state = 'active';
    	active.attempts += 1;
    	queue.splice(0,1);
    	console.log('trying: ' + active.repo + '@' + active.sha);
        

    	var proc = spawn('./run.sh', [active.repo, active.sha]);

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
			if (code === 0) {
	        	if (fs.exists(active.sha + '/unhappy',function(ex) {
	        		if (ex) {
	        			// unhapy, try again
	        			queue.push(active);
	        			active.state = 'unhappy';
	        			active = null;
	        		} else {
	        			// happy, done
	        			done.push(active);
	        			active.state = 'done';
	        			active = null;
	        		}
	        	}));
	    	} else {
	    		done.push(active);
	    		done.state = 'failed';
	    		active = null;
	    	}
		});

    }  
},1000)

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

	var job = { isDaemon : isDaemon, repo : repo, sha : sha, out : '', err : '', attempts : 0, state : 'new'};

	if (isDaemon) {
		job.state = 'active';
    	job.attempts += 1;
    	console.log('running daemon: ' + job.repo + '@' + job.sha);
        
    	var proc = spawn('./run.sh', [job.repo, job.sha]);

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
			if (code === 0) {
				job.state = 'done';
	    	} else {
	    		done.state = 'failed';
	    	}
	    	done.push(job);
	    	daemons.splice(daemons.indexOf(job),1);

		});
	} else {
		queue.push(job);
		console.log('added normal');
	}
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
// 	res.writeHead(200, { 'Content-Type' : 'text/html'});
// 	res.write('<html>');
// 	res.write('<body>');
// 
// 	res.write('<h1>');
// 	res.write('Status');
// 	res.write('</h1>');
// 	res.write('<table>');
// 
// 	queue.forEach(function(p) { showOne(p,res); });
// 	if (active != null) {
// 		showOne(active,res);
// 	}
// 	done.forEach(function(p) { showOne(p,res); });
// 
// 	res.write('</table>');
// 	res.write('</body>');
// 	res.write('</html>');
// 	res.end();
    return {pending: queue, active: active === null ? [] : [ active ], daemons: daemons, done: done};
    // FIXME: The above is a crude, temporary fix so that I can test the rest of my code -rajamony
}

exports.add = add;
exports.status = status;
exports.dump = dump;
