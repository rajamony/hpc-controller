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
 * Contributor(s): Ram Rajamony and Ahmed Gheith, IBM
 *
 ***************************************************************************/

function returnEnv () {
    var operatingenv = {};
    if ((typeof process.env.SITE_SECRET === 'undefined') || (typeof process.env.ADMIN_PASSWORD === 'undefined') || (typeof process.env.PUBLIC_HOSTNAME === 'undefined')) {
        console.log ('SITE_SECRET, ADMIN_PASSWORD, and PUBLIC_HOSTNAME must be passed in as environment variables');
	process.exit (1);
    }
    operatingenv.SITE_SECRET = process.env.SITE_SECRET;
    operatingenv.sslkeydir = process.env.SSLKEYDIR + '/';
    operatingenv.adminpw = process.env.ADMIN_PASSWORD;
    operatingenv.hostname = process.env.PUBLIC_HOSTNAME;
    operatingenv.outdir = '/' + (process.env.USER_DIRECTORY || 'userdata');
    console.log ("The outdir is <" + operatingenv.outdir + ">");
    return operatingenv;
}

module.exports = returnEnv;
