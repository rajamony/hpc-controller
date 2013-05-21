#!/bin/bash

. ../system.config

OUTDIR=./$USER_DIRECTORY/$1

mkdir -p $OUTDIR
touch $OUTDIR/status.txt

echo "Called on repository $2" >> $OUTDIR/status.txt
echo "Called on branch $3" >> $OUTDIR/status.txt
