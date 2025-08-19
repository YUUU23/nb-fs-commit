#!/bin/bash 

nbdir="nbdir"
if [ -f "$nbdir" ]; then 
    rm -rf $nbdir
    echo "Removed $nbdir, starting up notebook"
else
    echo "Cannot remove $nbdir, exiting.." 
fi
