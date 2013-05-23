#!/bin/bash -x

repo=$1
sha=$2

test -d $2 || git clone $1 $2
(cd $2; git checkout -f $2)

exit 0
