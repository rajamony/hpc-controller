/*
 * Copyright 2013- IBM
 * All rights reserved
 *
 * Licensed under the Eclipse Public License, Version 1.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Capture and return the operating environment
 * Written by: Ram Rajamony, IBM Research, Austin, TX.
 *
 */

function returnEnv (server, port) {
    var operatingenv = {};
    if ((typeof process.env.SITE_SECRET === 'undefined') || (typeof process.env.ADMIN_PASSWORD === 'undefined') || (typeof process.env.PUBLIC_HOSTNAME === 'undefined')) {
        console.log ('SITE_SECRET, ADMIN_PASSWORD, and PUBLIC_HOSTNAME must be passed in as environment variables');
	process.exit (1);
    }
    operatingenv.SITE_SECRET = process.env.SITE_SECRET;
    operatingenv.adminpw = process.env.ADMIN_PASSWORD;
    operatingenv.protocol = server.hasOwnProperty('cert')?'https://':'http://';
    operatingenv.hostname = process.env.PUBLIC_HOSTNAME;
    operatingenv.githookurl = operatingenv.protocol + operatingenv.hostname + ':' + port + '/launchrun';
    return operatingenv;
}

module.exports = returnEnv;
