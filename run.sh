#!/bin/bash

############################################################################
#  Licensed Materials - Property of IBM 
#  Copyright (C) IBM Corp. 2013, All Rights Reserved
#  
#  This program and the accompanying materials are made available under
#  the terms of the Eclipse Public License v1.0 which accompanies this
#  distribution, and is available at
#  http://www.eclipse.org/legal/epl-v10.html
#  
#  US Government Users Restricted Rights - Use, duplication or 
#  disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
#  
#  Contributor(s): Ram Rajamony and Ahmed Gheith, IBM
# 
############################################################################

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
    fi
done
