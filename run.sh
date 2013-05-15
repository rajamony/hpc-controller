#!/bin/bash

##
## Now run the inner run script in a loop.

while true; do
    starttime=`date +%s`
    for ((i=0;i<3;i++)); do
	now=`date`
	echo "Starting run-inner at $now"
	./run-inner.sh
    done
    endtime=`date +%s`
    if (( $endtime-$starttime < 15 )); then
        echo "Something has gone awry with the server. Forced sleep for 1 minute"
	sleep 60
	break
    fi
done
