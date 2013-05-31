#!/bin/bash -x

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

repo=$1
sha=$2

test -d $2 || git clone $1 $2
(cd $2; git checkout -f $2)

exit 0
