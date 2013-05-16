#!/bin/bash

##
## load the system's configuration
##
. ./system.config

##
## Setup up SSL (https access)
##
if [ ! -d $SSLKEYDIR ]; then
    echo "You need to manually create /opt/keys and make it r/w by the user who will run the controller"
    exit 1
fi

if [ ! -e $SSLKEYDIR/cert.pem -o ! -e $SSLKEYDIR/root-ca.key ]; then
    echo "Setting up SSL certificates for https access"
    rm -f $SSLKEYDIR/cert.pem $SSLKEYDIR/root-ca.key
    openssl genrsa -out $SSLKEYDIR/root-ca.key
    openssl req -new -key $SSLKEYDIR/root-ca.key -out /tmp/csr.pem.$$ -subj \
    		"/C=$ssl_country/ST=$ssl_state/L=$ssl_locality/O=$ssl_organization/OU=$ssl_orgunit/CN=$ssl_name/emailAddress=$ssl_email"
    openssl x509 -req -days 9999 -in /tmp/csr.pem.$$ -signkey $SSLKEYDIR/root-ca.key -out $SSLKEYDIR/cert.pem
    rm -f /tmp/csr.pem.$$
fi

# ##
# ## Setup Mongo and start it
# ##
# mkdir -p $MONGODATABASEDIR	# In case this is the first time ever we are running this 
# 
# /etc/init.d/mongod status 2> /dev/null | grep --silent "^mongod (.*) is running..."
# if [ $? -ne 0 ]; then 
#     echo "Starting mongod ..."
#     rm -f $MONGOOUTFILE
#     mongod --smallfiles --dbpath $MONGODATABASEDIR --quiet >& $MONGOOUTFILE &
# fi


##
## Now run the HPC controller web server in a loop
## During development, the webserver code will be updated. A server-side hook
## has been set up (on the server repo) that will do a git pull of the code and 
## then request the webserver to exit (via an HTTP GET to /exitnow)

for ((i=2;i>=0;i--)); do
    j=$(($i+1))
    rm -f $WEBSERVEROUTFILE.$j
    mv $WEBSERVEROUTFILE.$i $WEBSERVEROUTFILE.$j
done
mv $WEBSERVEROUTFILE $WEBSERVEROUTFILE.0

cd $WEBSERVERDIR
make >& $WEBSERVEROUTFILE

