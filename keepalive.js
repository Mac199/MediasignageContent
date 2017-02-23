//
// Copyright (c) 2013, Hughes Network Systems, LLC. All rights reserved.
//
// Description:
//
// Looks for updates to signage content and reloads the page if needed.
// Informs the signage control process that the player is still running. If
// keepalive is not used then signage control will detect this and
// restart the browser.
//
// Usage:
//
// Include this file in any signage page that does not include signage_control.js.
// Put a line like this in the <head> section
//     <script type="text/javascript" src="keepalive.js"></script>
// or like this if the page is in the layouts directory
//     <script type="text/javascript" src="../keepalive.js"></script>
// Call KeepAlive() once on page load. For example this can be done like this:
//     <body onload="javascript:KeepAlive()" >
//

var keepAliveObject = null;

//---------------------------------------------------
//---------------------------------------------------
function keepAliveCode()
{
	var mySelf = this;
	this.callSendStatus = function() { mySelf.sendStatus(null) };

	this.signageAjaxUniqueCounter = 1;

	this.sendStatus(null);
}

// Send minimal status to let them know that we are alive.
keepAliveCode.prototype.sendStatus = function(data)
{
	var statusData = this.gatherStatus(data);
	this.sendStatusActive = true;
	this.signageAjax({
		url: "http://localhost/cgi-bin/signageTunnel.cgi",
		type: "POST",
		dataType: "json",
		data: statusData,
		context: this,
		success: this.gotParameters
	});
	this.sendStatusTimerId = setTimeout(this.callSendStatus, 5000);
}

//---------------------------------------------------
keepAliveCode.prototype.gatherStatus = function(data)
{
	var stat;
	if (data) {
		stat = data;
	} else {
		stat = new Object();
	}

	stat['currentlyPlayingFiles'] = '';
	stat['syslogMessageLast']     = '';
	stat['syslogMessageTime']     = '';
	stat['errorMessageLast']      = '';
	stat['errorMessageTime']      = '';

	var now = new Date();
	stat['time'] = now.toISOString();
	
	return (stat);
}

//---------------------------------------------------
// Process new parameters.
// If the parameter version has changed reload the page with the new version number.
// This will start everything anew without needing to restart the browser.
// The new play list will be read and the screen will be updated with a new layout and program.
keepAliveCode.prototype.gotParameters = function(param)
{
	if (!param) {
		return;
	}
	this.parameters = param
	this.sendStatusActive = false;

	var version = param.version;
	if (!version) {
		version = '-2'
	} else {
		version = version.replace(/\s/g, '');
	}

	if (window.location.href.indexOf("version=" + version) == -1) {
		window.location = window.location.href.replace(/\?.*/, "") + "?version=" + version;
	}
}

//---------------------------------------------------
keepAliveCode.prototype.signageAjax = function(parameters)
{
	try {
		var urlPlus = parameters.url;

		if (parameters.dataType == "jsonp") {
		    var callBackName = "myTmpCallBack" + this.signageAjaxUniqueCounter;
		    this.signageAjaxUniqueCounter += 1;
			var now = new Date();
			var urlExtra = "callback=" + callBackName + "&_=" + now.getTime();

			if (urlPlus.indexOf('?') >= 0) {
				urlPlus = urlPlus.concat("&" + urlExtra);
			} else {
				urlPlus = urlPlus.concat("?" + urlExtra);
			}

			var myParam = parameters;
		    window[callBackName] = function(data) {
		    	if (myParam.success) {
					if (myParam.context) {
						myParam.success.call(myParam.context, data);
					} else {
						myParam.success(data);
					}
				}
		    	delete window.callBackName;
		    };
		    var script = document.createElement("script");
			script.src = urlPlus;
			document.body.appendChild(script);
		} else {
			var xhr = new XMLHttpRequest();
			xhr.myParameters = parameters;
			var serializedData = null;
			if (parameters.data) {
				for (var key in parameters.data) {
					if (parameters.data.hasOwnProperty(key)) {
						var str = escape(key) + '=' + escape(parameters.data[key]);
						if (serializedData === null) {
							serializedData = str;
						} else {
							serializedData += '&' + str;
						}
					}
				}
			}

			if (parameters.type == undefined) {
				parameters.type = "GET"
			}
			if ((parameters.type.toLowerCase() == "get") && (serializedData)) {
				if (urlPlus.indexOf('?') >= 0) {
					urlPlus = urlPlus.concat("&" + serializedData);
				} else {
					urlPlus = urlPlus.concat("?" + serializedData);
				}
				serializedData = null;
			}

			xhr.open(parameters.type, urlPlus, true);
			xhr.onreadystatechange = function() {
				// wait for DONE state
				if (this.readyState == 4) {
					var params = this.myParameters;
					if (params && params.success) {
						var response = null;
						if (params.dataType == "json") {
							response = JSON.parse(this.responseText);
						} else if (params.dataType == "xml") {
							response = this.responseXML;
						} else {
							response = this.responseText;
						}
						if (params.context) {
							params.success.call(params.context, response);
						} else {
							params.success(response);
						}
					}
				}
			}
			if (parameters.contentType == undefined) {
				parameters.contentType = 'application/x-www-form-urlencoded; charset=UTF-8'
			}
			xhr.setRequestHeader("Content-Type", parameters.contentType);
			xhr.send(serializedData);
		}

	} catch(err) {
		if (parameters.error) {
			parameters.error(xhr, "Exception in signageAjax", "" + err);
		}
	}
}



//---------------------------------------------------
// Tell the Signage control processes that we are still alive.
// Use this if the normal Signage control JavaScript is not being used.
function KeepAlive()
{
	if (! keepAliveObject) {
		keepAliveObject = new keepAliveCode();
	}
}



