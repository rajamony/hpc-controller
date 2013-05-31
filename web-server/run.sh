#!/bin/bash -x

repo=$1
sha=$2

test -d $2 || (git clone $1 $2 && (cd $2; git checkout -f $2; make all))

rm -f $2/unhappy

(cd $2 ;make run)
