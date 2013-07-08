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
 * Contributor(s): Ram Rajamony, IBM
 *
 ***************************************************************************/


// Create an X and Y axis with ticks and tick labels that can be animated. We will have as 
// many of these as there are jobs. 
//  var job1 = new Jobplot ({x1: 0, y1: 0,   x2: plot.width, y2: 250, gap: 40, numticks: 10, ticktime: 4, zerotick: 0, nowlinestart: 0, nowlineend: 36, color: 'red'});
function Jobplot (bbox) {
  if (! (this instanceof Jobplot))
      return new JobPlot (bbox);

  function stateToHeight (s) {
    switch (s) {
      case 'new':     return -15;
      case 'active':  return -90;
      case 'unhappy': return -15;
      case 'killing': return -50;
      case 'failed':  return 0;
    }
    return 0;
  }

  // job2.data.push ({t0: 25,  t1: 29, state: 'active'});
  this.addData = function (when, oldstate, newstate) {
    var valid = true, l = thisplot.data.length;
    if (l > 0) {
      if (thisplot.data[l-1].state === oldstate) // Retrieve the last entry in our data. The state had better match oldstate
	thisplot.data[l-1].t1 = when;
      else
        valid = false;
    }
    if (valid)
      thisplot.data.push ({t0: when, t1: -1, state: newstate});
    // console.log ("addData: Job state change from " + oldstate + " to " + newstate + " at " + when + " " + JSON.stringify(thisplot.data));
    return valid;
  }

  function MAX (a, b) { return (a > b) ? a : b; }
  function MIN (a, b) { return (a < b) ? a : b; }

  var thisplot = this, group = new Kinetic.Group(); 
  thisplot.data = [];
  thisplot.jobinfo = {group: new Kinetic.Group(), current: []};
  thisplot.layer = new Kinetic.Layer();
  // x1,y1 is at left top corner. x2,y2 is at bottom right corner
  group.add (new Kinetic.Rect({ x: bbox.dimensions.x1 + 3, y: bbox.dimensions.y1 + 3, width: bbox.dimensions.x2 - bbox.dimensions.x1 - 6, 
  							height: bbox.dimensions.y2 - bbox.dimensions.y1 - 6, stroke: 'blue', strokeWidth: 1 }));
  if (typeof bbox.dimensions.gap === "undefined")
      bbox.dimensions.gap = 40;

  if (typeof bbox.nowline === "undefined")
      bbox.nowline = {dt_zero_to_start: 0, dt_start_to_end: bbox.ticks.num * bbox.ticks.dt * 0.85};

  bbox.dimensions.x1 += bbox.dimensions.gap;
  bbox.dimensions.y1 += bbox.dimensions.gap;
  bbox.dimensions.x2 -= bbox.dimensions.gap;
  bbox.dimensions.y2 -= bbox.dimensions.gap;

  thisplot.layer.add (group);
  thisplot.layer.add (thisplot.jobinfo.group);

  var xaxis = new Kinetic.Line ({ points: [bbox.dimensions.x1, bbox.dimensions.y2, bbox.dimensions.x2, bbox.dimensions.y2], stroke: 'black', strokeWidth: 2, lineJoin: 'square' });
  var yaxis = new Kinetic.Line ({ points: [bbox.dimensions.x1, bbox.dimensions.y1, bbox.dimensions.x1, bbox.dimensions.y2], stroke: 'black', strokeWidth: 2, lineJoin: 'square' });
  group.add (xaxis);
  group.add (yaxis);
  xaxis.moveToTop();
  yaxis.moveToTop();

  var ticks = new Kinetic.Group();
  var tickmarks = new Kinetic.Group();
  var tgap = (bbox.dimensions.x2 - bbox.dimensions.x1) / bbox.ticks.num;
  for (var i = 0; i < bbox.ticks.num; i++) {
    var xpos = bbox.dimensions.x1 + (i+1)*tgap;
    ticks.add (new Kinetic.Line ({points: [xpos, bbox.dimensions.y2, xpos, bbox.dimensions.y2 + 5], stroke: 'black', strokeWidth: 2}));
    var tm = new Kinetic.Text ({x: xpos, y: bbox.dimensions.y2 + 8, text: bbox.ticks.zero + (i+1)*bbox.ticks.dt, fontFamily: 'Arial', fontSize: 14, padding: 0, fill: 'black'});
    tm.setX (xpos - tm.getTextWidth()/2);
    tickmarks.add (tm);
  }
  ticks.add (tickmarks);
  group.add (ticks);

  // Now add a temporary tick at time zero. We will remove this tick just prior to starting the axis movement
  var zerotick = new Kinetic.Group();
  zerotick.add (new Kinetic.Line ({points: [bbox.dimensions.x1, bbox.dimensions.y2, bbox.dimensions.x1, bbox.dimensions.y2 + 5], stroke: 'black', strokeWidth: 2}));
  var tm = new Kinetic.Text ({x: bbox.dimensions.x1, y: bbox.dimensions.y2 + 8, text: bbox.ticks.zero, fontFamily: 'Arial', fontSize: 14, padding: 0, fill: 'black'});
  tm.setX (bbox.dimensions.x1 - tm.getTextWidth()/2);
  zerotick.add (tm);
  group.add (zerotick);

  function timeToPixels (t) {
      return (bbox.dimensions.x2 - bbox.dimensions.x1) / (bbox.ticks.dt * bbox.ticks.num) * t;
  }
  // Next, we add the NOW line and a tag at the bottom of the line
  var nowpos = bbox.dimensions.x1 + timeToPixels (bbox.nowline.dt_zero_to_start);
  var nowline = new Kinetic.Line ({ points: [nowpos, bbox.dimensions.y1, nowpos, bbox.dimensions.y2], stroke: 'black', strokeWidth: 1, dashArray: [1, 1] });
  group.add (nowline);
  var tag = new Kinetic.Tag ({ fill: 'green', lineJoin: 'round', pointerDirection: 'up', pointerWidth: 15, pointerHeight: 7});
  var text = new Kinetic.Text({ text: 'Now', fontFamily: 'Calibri', fontSize: 14, padding: 3, fill: 'black' });
  var tooltip = new Kinetic.Label ({ x: nowpos, y: bbox.dimensions.y2, opacity: 0.75 });
  tooltip.add (tag);
  tooltip.add (text);
  group.add (tooltip);

  // Now we animate the different things. The NOW line moves first till it reaches the nowpos. Then, the axis moves left
// ##### var job1 = new Jobplot ({x1: 0, y1: 0, x2: 800, y2: 250, gap: 40, numticks: 10, ticktime: 1, zerotick: 0, nowlinestart: 0, nowlineend: 3.5});

  thisplot.prev_timeinthistick = 0;
  thisplot.tickatzero = bbox.ticks.zero;
  thisplot.movingaxisforfirsttime = true;
  thisplot.animateaxis = new Kinetic.Animation (function (frame) {
    removeInvisibleJobs ();
    renderCurrentJobs ();
    var now = frame.time, deltat = frame.timeDiff, fps = frame.frameRate;
    var timetomovenowline = 1000 * bbox.nowline.dt_start_to_end;
    if (now >= timetomovenowline) { // Move the Axis and ticks
	if (thisplot.movingaxisforfirsttime) {
          zerotick.remove();
	  thisplot.movingaxisforfirsttime = false;
	}
	now -= timetomovenowline;	// Now operate in delta T past when the now line is at
	thisplot.tickatzero = bbox.ticks.zero + now/1000;
	thisplot.nowlinetime = thisplot.tickatzero + (bbox.nowline.dt_zero_to_start + bbox.nowline.dt_start_to_end);
	var timeinthistick = now % (1000 * bbox.ticks.dt);
	ticks.setAbsolutePosition ({x: - timeToPixels (timeinthistick/1000), y: 0});
	// When timeinthistick changes from a small number to a large number, we switch the axis labeling
	if (timeinthistick < thisplot.prev_timeinthistick) {
	    if (thisplot.ppp1 < 10) {
	      console.log ("MUST RELABEL " + timeinthistick + " " + thisplot.prev_timeinthistick);
	      thisplot.ppp1++;
	    }
	    for (var i = 0; i < tickmarks.children.length; i++) {
	      var x = tickmarks.children[i];
	      var curr = parseInt (x.getText(), 10);
	      x.setText (bbox.ticks.dt + curr);
	      x.setX (bbox.dimensions.x1 + (i+1)*tgap - x.getTextWidth()/2);
	    }
	}
	thisplot.prev_timeinthistick = timeinthistick;
    }
    else {	// Move the now line complex
      var dt = now/1000 + bbox.nowline.dt_zero_to_start;
      var xpos = bbox.dimensions.x1 + timeToPixels (dt);
      var c = nowline.getPoints();
      nowline.setPoints ([{x: xpos, y: c[0].y}, {x: xpos, y: c[1].y}]);
      tooltip.setX (xpos);
      thisplot.nowlinetime = thisplot.tickatzero + dt;
    }
  }, thisplot.layer);

  function removeInvisibleJobs () {
    thisplot.jobinfo.current.forEach (function (job) {
        job.rect.remove();
      });
    thisplot.jobinfo.current = [];
  }

  function renderCurrentJobs () {
    // console.log ("renderCurrentJobs:  tickatzero = " + thisplot.tickatzero);
    thisplot.data.forEach (function (data) {
	  if (((data.t1 != -1) && (data.t1 < thisplot.tickatzero)) || (data.t0 > thisplot.nowlinetime))
	    return;
	  var starttime = MAX (data.t0, thisplot.tickatzero);
	  var endtime = (data.t1 == -1) ? thisplot.nowlinetime : MIN (data.t1, thisplot.nowlinetime);

	  var startx = bbox.dimensions.x1 + timeToPixels (starttime - thisplot.tickatzero);
	  var width = timeToPixels (endtime - starttime);
	  var h = stateToHeight (data.state);
	  if (h !== 0) {
	    var newjob = {rect: new Kinetic.Rect ({x: startx, y: bbox.dimensions.y2, width: width, height: h, fill: bbox.color})};
	    thisplot.jobinfo.current.push (newjob);
	    thisplot.jobinfo.group.add (newjob.rect);
	    newjob.rect.moveToBottom();
	    // console.log ("renderCurrentJobs: Drawing job from " + startx + " (" + starttime + ") to " + width + " (" + endtime - starttime + ")");
	  }
      });
  }

  return thisplot;
}
