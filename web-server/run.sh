#!/bin/bash -x

repo=$1
sha=$2

rm -f $2/unhappy

(cd $2; make run)
