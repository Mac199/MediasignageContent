//
// Copyright © 2010-2013, Hughes Network Systems, LLC. All rights reserved.
//
// Description:
//
// This is the code that manages the portions of the digital sign
// that are driven by the MediaSignage play lists. Each play list is
// associated with a div in the html layout. The content of the div is
// dynamically change to display the content in the play list.
//
// It is simple to add play list content to a layout. Here is an example
// layout that has two play list, main and sidebar.
// <html>
// <head>
//     <meta charset="utf-8">
//     <title>MediaSignage Example</title>
//     <script type="text/javascript" src="signage_control.js"></script>
// </head>
//
// <body onload="javascript:StartMediaSignage();" >
//     <div layoutPlayList="main" style="position:absolute; left:37%; top:5%; width:60%; height:50%;">
//         <p>main playlist</p>
//     </div>
//     <div layoutPlayList="sidebar" style="position:absolute; left:3%; top:5%; width:31%; height:50%;">
//         <p>sidebar playlist</p>
//     </div>
// </body>
// </html>
//
// The signage control code is included in the <head> tag with a line like this.
//        <script type="text/javascript" src="signage_control.js"></script>
// After including the code it is started with
//      <body onload="javascript:StartMediaSignage();" >
//
// During startup the file html5_select.xml is read. This is how the MediaSignage
// control programs pass parametes to this code. This file contains the name of the
// currently active MediaSignage program and where to find the file containing
// play list information. The first item in each play list is read and displayed
// by changing the contains of each play list html div tag.
//
// In the background the content of each play list div is updated.
//

// For simulation: copy content folder from player to folder \inetpub\wwroot on PC,
// uncomment next line and open IE http://localhost/content/current.html
//var debugSimulateCgi = "playerParameters.json";

// To enable debug div uncomment next line
//var debugEnableDiv = true;

// The debug function can be used to display debug information during development.
var debug = function(str)
{
	var now = new Date();
	console.log(now.getMinutes() + ":" + now.getSeconds() + ": " + str);
	if (typeof debugEnableDiv != "undefined" && debugEnableDiv) {
		if (!this.debugDiv) {
			var div = document.createElement('div');
			this.debugDiv = div;
			div.setAttribute('style', 'font-size:14; color:white; background-color: rgba(0, 0, 0, 0.5); text-shadow: 0px 0px 4px black; -webkit-box-shadow: 3px 3px 15px #888; border-radius: 10px;');
			div.style.width = window.innerWidth / 2 - 20;
			div.style.height = window.innerHeight - 40;
			div.style.position = "absolute";
			div.style.top = 10;
			div.style.left = window.innerWidth / 2;
			document.documentElement.getElementsByTagName("body")[0].appendChild(this.debugDiv);
		}
		this.debugDiv.innerHTML += str + "<br/>";
	}
};

// comment out next line to enable debug output
debug = function() { };

//signageTraceLogOn = false;
signageTraceLogOn = true;

var signageProgramObject = null;

var signageBrowserInfo = null;

//---------------------------------------------------
var backgroundAudioObject = null;
var backgroundAudioPauseCount = 0;

function backgroundAudioPause()
{
	backgroundAudioPauseCount += 1;
	if (backgroundAudioObject) {
		backgroundAudioObject.audioElement.pause();
	}
}

function backgroundAudioResume()
{
	backgroundAudioPauseCount -= 1;
	if (backgroundAudioPauseCount <= 0) {
		backgroundAudioPauseCount = 0;
		if (backgroundAudioObject) {
			backgroundAudioObject.audioElement.play();
		}
	}
}


// @return [Float]
function SignageBrowserDetectMakeVersionNumber(versionString)
{
	var num = 0.0;
	if (/(\d+)[\._](\d+)[\._]*(\d*)/.test(versionString)) {
		var major  = parseInt(RegExp.$1);
		var minor  = parseInt(RegExp.$2);
		var bugFix = parseInt(RegExp.$3);
		num = major + (minor / 100.0) + (bugFix / 10000.0);
	}
	return num;
}

//---------------------------------------------------
function SignageBrowserDetect()
{
	debug(navigator.userAgent);
	this.versionNumber = 0.0;
	this.webKitName = "";
	this.webKitVersion = "";
	this.webKitVersionNumber = 0.0;
	this.osName = "";
	this.osVersion = "";
	this.osVersionNumber = 0.0;

	this.useVLC = false;
	this.endedWorkaround = false;

	if (/(\w*WebKit)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.webKitName = RegExp.$1;
		this.webKitVersion = RegExp.$2;
		this.webKitVersionNumber = SignageBrowserDetectMakeVersionNumber(this.webKitVersion);
	}
	if (/(Chromium)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);

		this.endedWorkaround = true;

	} else if (/(Chrome)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);

	} else if (/(Safari)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);

	} else if (/(Firefox)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);

		this.useVLC = true;

	} else if (/(Iceweasel)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);

		this.useVLC = true;
	} else if (/(MSIE)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = RegExp.$1;
		this.version = RegExp.$2;
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);
		this.webKitVersionNumber = 1.0;
	} else if (/(Mozilla)[\/\s]*([\d\.]*)/.test(navigator.userAgent)) {
		this.name = "MSIE";
		this.version = "";
		this.versionNumber = SignageBrowserDetectMakeVersionNumber(this.version);
		this.webKitVersionNumber = 1.0;
	}

	if (navigator.userAgent.toLowerCase().indexOf("windows nt") != -1) {
		this.osName = "Windows";
		this.useVLC = false;
		this.webKitVersionNumber = 1.0;
		if (/Windows NT ([^; ]*); ([^; ]*)[);]/.test(navigator.userAgent)) {
			this.osVersion = RegExp.$2;
			this.osVersionNumber = RegExp.$1;
		}
		if (this.osVersionNumber < 6.0) {
			this.useVLC = true;
		}
	}
	else {
		if (/.*\([^;]*;[^;]*;([^;]*)/.test(navigator.userAgent)) {
			this.osName = RegExp.$1;
			if (/Mac OS X ([\d_]+)/.test(this.osName)) {
				this.osVersion = RegExp.$1;
				this.osVersionNumber = SignageBrowserDetectMakeVersionNumber(this.osVersion);
				if (this.osVersionNumber < 10.06 && this.osVersionNumber > 10.0) {
					this.useVLC = true;
				}
			} else {
				this.useVLC = true;
			}
		}
	
		if (/.*\([^;]*;([^;\)]*)\)/.test(navigator.userAgent)) {
			this.osName = RegExp.$1;
			if (/Mac OS X ([\d_]+)/.test(this.osName)) {
				this.osVersion = RegExp.$1;
				this.osVersionNumber = SignageBrowserDetectMakeVersionNumber(this.osVersion);
				if (this.osVersionNumber < 10.06 && this.osVersionNumber > 10.0) {
					this.useVLC = true;
				}
			} else {
				this.useVLC = true;
			}
		}
	}
	this.endedWorkaround = true;

	debug("OS name:                " + this.osName);
	debug("OS version:             " + this.osVersion);
	debug("OS version number:      " + this.osVersionNumber);
	debug("Browser name:           " + this.name);
	debug("Browser version:        " + this.version);
	debug("Browser version number: " + this.versionNumber);
	debug("WebKit name:            " + this.webKitName);
	debug("WebKit version:         " + this.webKitVersion);
	debug("WebKit version number:  " + this.webKitVersionNumber);
	debug("VLC:                    " + this.useVLC);
}


//---------------------------------------------------
function getAttribute(doc, name, defaultValue)
{
	var attr = doc.attributes.getNamedItem(name);
	if (attr) {
		return attr.nodeValue;
	}
	return defaultValue;
}

//---------------------------------------------------
// Base content object which is inherited by the other content objects.
function Content()
{
	this.timerId = null;
	this.paused = 0;
	this.lastStartTime = new Date();
	this.playedSeconds = 0;
	this.reminder = 0;
}

Content.prototype.stop = function()
{
	SignageLogTrace("Content Stop: file=" + this.file + " id=" + this.id + " playlist=" + this.playList ? this.playList.name : "null");
	this.stopTimeout();
	if (this.playList) {
		this.playList.next();
	}
	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;
};

Content.prototype.pause = function()
{
	SignageLogTrace("Content Pause");
	this.stopTimeout();

	if (this.playList && this.playList.currentContainer && this.playList.currentContainer.div) {
		SignageLogTrace("Content Pause, cleanup");
		this.cleanup(this.playList.currentContainer);
	}
};

Content.prototype.resume = function()
{
	if (this.start) {
		SignageLogTrace("Content Resume");
		this.start();
	}
};

Content.prototype.startTimeout = function()
{
	this.stopTimeout();
	if (this.duration === undefined) {
		this.duration = 0;
		if (this.doc.attributes.getNamedItem('timeout')) {
			this.duration = this.doc.attributes.getNamedItem('timeout').nodeValue;
		}
		if (this.doc.attributes.getNamedItem('duration')) {
			this.duration = this.doc.attributes.getNamedItem('duration').nodeValue;
		}
	}
	if (this.duration && this.duration > 0) {
		this.timerId = setTimeout(this.callStop, this.duration * 1000);
	}
	this.lastStartTime = new Date();
};

Content.prototype.pauseTimeout = function()
{
	now = new Date();
	this.playedSeconds += (now.getTime() - this.lastStartTime.getTime()) / 1000;
	if(this.duration && this.duration > 0) {
		this.reminder = this.duration - this.playedSeconds + 1;
	}
	this.stopTimeout();
	this.paused = 1;
};

Content.prototype.resumeTimeout = function()
{
	this.stopTimeout();
	if (this.reminder && this.reminder > 0) {
		this.timerId = setTimeout(this.callStop, this.reminder * 1000);
		SignageLogTrace("Resume Timeout for " + this.reminder + " seconds");		
	}
	else if (this.duration && this.duration > 0) {
		this.timerId = setTimeout(this.callStop, this.duration * 1000);
		SignageLogTrace("Resume Timeout for " + this.duration + " seconds");		
	}
	this.paused = 0;	
	this.lastStartTime = new Date();
};

Content.prototype.stopTimeout = function()
{
	if (this.timerId) {
		clearTimeout(this.timerId);
		this.timerId = null;
	}
};

Content.prototype.cleanup = function(container)
{
	container.div.innerHTML = "";
};

//---------------------------------------------------
// Content object for video content.
function Video(doc, playList)
{
	this.type      = "video";
	this.doc       = doc;
	this.playList  = playList;
	this.file      = getAttribute(doc, 'file', "");
	this.id        = getAttribute(doc, 'id', "0");
	this.startTime = new Date();
	this.currentTime = 0.0;
	this.stalledCount = 0;
	var str        = getAttribute(playList.div0, 'mute', 'false').toLowerCase();
	this.mute      = !(str == 'false' || str == 'off' || str == '0' || str == 'no');
	this.transitionDone = 0;

	var self = this;
	this.callStop = function() { self.stop(); };
	this.callEvent = function(evt) { self.event(evt); };
	this.callCheckEnded = function() { self.checkEnded(); };
}
Video.prototype = new Content();

Video.prototype.start = function()
{
	SignageLogTrace("Video Start: file=" + this.file + " id=" + this.id);
	this.container = this.playList.currentContainer;
	var video = this.container.videoElement;
	if (video === undefined) {
		// console.log("create video element");
		video = document.createElement('video');
		video.autoplay = false;
		video.style.position = 'relative';
		video.style.width = '100%';
		video.style.height = '100%';
		video.style.display = 'block';
		this.container.videoElement = video;
	}
	this.videoElement = video;
	this.playingFlag = true;
	this.currentTime = 0.0;
	this.stalledCount = 0;

	this.playList.playing(this.file);
	this.videoElement.src = this.file;
	this.videoElement.addEventListener('playing', this.callEvent, false);
	if (!signageBrowserInfo.endedWorkaround) {	
		this.videoElement.addEventListener('ended', this.callEvent, false);
	}
	this.videoElement.addEventListener('error', this.callEvent, false);
	this.videoElement.addEventListener('stalled', this.callEvent, false);
	this.container.div.appendChild(this.videoElement);
	
	if (this.mute && !this.fullScreenFlag) {
		this.videoElement.volume = 0.0;
	}

	this.startTimeout();

	if (this.file.toLowerCase().indexOf("nsnd") == -1) {
		this.audioPausedFlag = true;
		backgroundAudioPause();
	} else {
		this.audioPausedFlag = false;
	}
	this.startTime = new Date();
	if (signageBrowserInfo.endedWorkaround) {
		this.checkEndedTimerId = setTimeout(this.callCheckEnded, 2000);
	}
	this.videoElement.style.visibility = 'visible';
	this.videoElement.load();
	this.videoElement.play();
	if(signageBrowserInfo.name === "MSIE") {
		this.videoElement.style.visibility = 'hidden';
	}
	else {
		this.videoElement.style.visibility = 'visible';
	}
};

Video.prototype.event = function(evt)
{
	var type = evt.type;
	SignageLogTrace("Video Event: file=" + this.file + " id=" + this.id + " type=" + type);
	if(type === "playing") {
		this.videoElement.style.visibility = 'visible';
		if(signageBrowserInfo.name === "MSIE" && this.transitionDone === 0) {
			try {
				this.playList.transition.start(this.playList.lastContainer, this.playList.currentContainer);
			} catch(err) {
				SignageLogTrace("ERROR starting transition: '" + err + "'");
			}
			this.transitionDone = 1;
		}
		return;
	}
	if (this.checkEndedTimerId) {
		clearTimeout(this.checkEndedTimerId);
		this.checkEndedTimerId = null;
	}
	debug("Video Event: file=" + this.file + " id=" + this.id + " type=" + type);
	if (type === "error") {
		this.playList.errorLog("ERROR playing video " + this.file);
		this.playList.transitionEnd(this.playList.lastContainer);
	}
	if (this.playingFlag != true || !this.videoElement) {
		return;
	}
	this.stop();
};

Video.prototype.cleanup = function(container)
{
	SignageLogTrace("Video cleanup: file=" + this.file + " id=" + this.id + " videoElement=" + container.videoElement);
	if (container.videoElement) {
		container.videoElement.pause();
		if (container.div) {
			container.div.removeChild(container.videoElement);
			container.div.innerHTML = "";
		}
		container.videoElement.style.visibility = 'hidden';
	}
};

Video.prototype.pause = function()
{
	this.pauseTimeout();

	SignageLogTrace("Video Pause: file=" + this.file + " id=" + this.id + ", played seconds=" + this.playedSeconds + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.playList && this.playList.currentContainer && this.playList.currentContainer.div && this.playList.currentContainer.videoElement) {
		if (this.checkEndedTimerId) {
			clearTimeout(this.checkEndedTimerId);
			this.checkEndedTimerId = null;
		}
		this.playList.currentContainer.videoElement.pause();
		this.playList.currentContainer.videoElement.style.visibility = 'hidden';
	}
};

Video.prototype.resume = function()
{
	SignageLogTrace("Video Resume: file=" + this.file + " id=" + this.id + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.playList && this.playList.currentContainer && this.playList.currentContainer.div && this.playList.currentContainer.videoElement) {
		this.playList.currentContainer.videoElement.play();
		this.playList.currentContainer.videoElement.style.visibility = 'visible';
	}
	this.resumeTimeout();
	if (signageBrowserInfo.endedWorkaround) {
		this.checkEndedTimerId = setTimeout(this.callCheckEnded, 2000);
	}
};

Video.prototype.checkEnded = function()
{
	var remaining;
	var remaining2;
	var transitionDur;
	var now;
	var dif_seconds;

	now = new Date();
	remaining2 = 0.5;
	if (this.checkEndedTimerId == null || !this.videoElement) {
		SignageLogTrace("checkEnded ERROR: file=" + this.file + " id=" + this.id);
		return;
	}
	if (this.videoElement.duration && this.videoElement.currentTime) {
		remaining = this.videoElement.duration - this.videoElement.currentTime;
		transitionDur = 0;
		if (this.playList.transition && this.playList.transition.duration) {
			transitionDur = this.playList.transition.duration;
		}
		if (transitionDur && transitionDur > 0) {
			remaining -= transitionDur;
		}
	} else {
		remaining = 0.5;
	}
	if(this.currentTime !== this.videoElement.currentTime || this.currentTime === 0) {
		this.currentTime = this.videoElement.currentTime;
	}
	else {
		if(this.paused === 0) {
			this.stalledCount++;
		}
	}
	
	dif_seconds = this.playedSeconds + (now.getTime() - this.lastStartTime.getTime()) / 1000;
	remaining2 = this.videoElement.duration + 5 - dif_seconds;
	SignageLogTrace("checkEnded: file=" + this.file + 
					" id=" + this.id + ";" +
					" duration=" + this.videoElement.duration + ";" +
					" current = " + this.currentTime + ";" +
					" ended = " + this.videoElement.ended + ";" +
					" remaining = " + remaining + ";" +
					" remaining2 = " + remaining2 + ";"
					);
	if ((this.videoElement.ended == true) || (remaining < 0.001)) {
		this.stop();
	} else if (this.stalledCount > 1) {
		SignageLogTrace("checkEnded STALLED STOP: file=" + this.file + " id=" + this.id);
		this.stop();
	}
	else if(isNaN(remaining2)) {
		SignageLogTrace("checkEnded NaN STOP: file=" + this.file + " id=" + this.id);
		this.stop();
	}
	else if(remaining2 < 0) {
		SignageLogTrace("checkEnded TIMEOUT STOP: file=" + this.file + " id=" + this.id);
		this.stop();
	}
	else {
		this.checkEndedTimerId = setTimeout(this.callCheckEnded, remaining * 1000);
	}
};

Video.prototype.stop = function()
{
	SignageLogTrace("Video Stop: file=" + this.file + " id=" + this.id);
	this.playingFlag = false;
	this.startTime.setTime(0);
	if (this.checkEndedTimerId) {
		clearTimeout(this.checkEndedTimerId);
		this.checkEndedTimerId = null;
	}
	if (this.audioPausedFlag) {
		this.audioPausedFlag = false;
		backgroundAudioResume();
	}

	this.stopTimeout();
	if (this.videoElement) {
		this.videoElement.removeEventListener('playing', this.callEvent, false);
		this.videoElement.removeEventListener('ended', this.callEvent, false);
		this.videoElement.removeEventListener('error', this.callEvent, false);
		this.videoElement.removeEventListener('stalled', this.callEvent, false);
	}
	this.videoElement = null;
	this.currentTime = 0.0;
	this.stalledCount = 0;
	this.transitionDone = 0;
	
	// Parent objects
	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;
	
	if (this.playList) {
		this.playList.next();
	}
};


var VLCInUse = false;
var VLCDiv   = null;
var VLCEmbed = null;

//---------------------------------------------------
// Content object for video content using VLC.
function VideoVLC(doc, playList)
{
	this.type       = "videoVLC";
	this.doc        = doc;
	this.playList   = playList;
	this.file       = getAttribute(doc, 'file', "");
	this.id         = getAttribute(doc, 'id', "0");
	this.addr       = getAttribute(doc, 'addr', "");
	this.port       = getAttribute(doc, 'port', "");
	if (doc.tagName == 'stream') {
		this.stream = true;
		this.target = "udp://@" + this.addr + ":" + this.port;
		this.file   = this.target;
	} else {
		this.stream = false;
		this.target = this.file;
	}

	this.pollTime       = 200;
	this.streamEndDelay = 5123;
	this.vlcElement     = null;
	this.firstVLC       = false;

	var self = this;
	this.callStart = function() { self.start(); };
	this.callStop = function() { self.stop(); };
	this.callPoll = function() { self.poll(); };
	this.callNext = function() { self.next(); };
	this.callCreateWait = function() { self.createWait(); };
}
VideoVLC.prototype = new Content();

VideoVLC.prototype.createWait = function()
{
	VLCInUse = false;
	this.start();
};

VideoVLC.prototype.start = function()
{
	var left;
	var top;
	var width;
	var height;
	var dHeight;

	// This is a work-around. Starting VLC too soon may cause problems on Linux chromium
	if (VLCDiv == null) {
		var now = new Date();
		var delta = now.getTime() - this.playList.program.programStartTime;
		var minDelayFromPageLoad = 1500;
		if (delta < minDelayFromPageLoad) {
			setTimeout(this.callStart, minDelayFromPageLoad - delta + 10);
			return;
		}
	}

	this.container = this.playList.currentContainer;
	if (this.fullScreenFlag) {
		left   = '0';
		top    = '0';
		width  = '100%';
		// On the Branch Server with iceweasel, using 100% here causes a scroll bar to appear.
		// This only happens with a screen that is 1280x720 or 1920x1080.
		height = '99.444444%';
		dHeight = '100%';

		if(signageBrowserInfo.name === "MSIE") {
			width  = window.innerWidth * 0.99;
			height = window.innerHeight * 0.99;
			dHeight = height;
		}
	} else {
		left   = this.playList.div0.style.left;
		top    = this.playList.div0.style.top;
		width  = this.playList.div0.offsetWidth;
		height = this.playList.div0.offsetHeight;
		if(signageBrowserInfo.name === "MSIE" && width > window.innerWidth * 0.99) {
			width  = window.innerWidth * 0.99;
		}
		if(signageBrowserInfo.name === "MSIE" && height > window.innerHeight * 0.99) {
			height = window.innerHeight * 0.99;
		}
		dHeight = height;
	}
	if (VLCDiv == null) {
		var div = document.createElement('div');
		if (div) {
			div.style.position = 'absolute';
			VLCDiv = div;
			VLCDiv.style.left   = left;
			VLCDiv.style.top    = top;
			VLCDiv.style.width  = width;
			VLCDiv.style.height = dHeight;
			VLCDiv.style.overflow = 'hidden';
			VLCDiv.style.backgroundColor = 'black';
			document.body.appendChild(VLCDiv);
			var str = "";
			if(signageBrowserInfo.name === "MSIE") {
				VLCDiv.style.zIndex = 10;
				str =	"<object\n" +
						"   classid='clsid:9BE31822-FDAD-461B-AD51-BE1D1C159921'\n" +
						"   id='_VLC_DivPlayer'\n" +
						"   name='vlc'\n" +
						"	width='" + width + "'\n" +
						"	height='" + height + "'\n" +
						"	style='left: 0px; top: 0px; width: " + width + "px; height: " + height + "px;'\n" +
						"   class='vlcPlayer'>\n" +
						"   <param name='Src' value='" + this.target + "' />\n" +
						"   <param name='ShowDisplay' value='False' />\n" +
						"   <param name='Toolbar' value='False' />\n" +
						"   <param name='AutoLoop' value='False' />\n" +
						"   <param name='AutoPlay' value='True' />\n" +
						"</object>\n";
			}
			else {
				str =	"<embed width='" + width + "px;'\n" +
						"   height='" + height + "px;'\n" +
						"	type='application/x-vlc-plugin'\n" +
						"	progid='VideoLAN.VLCPlugin.2'\n" +
						"	target='" + this.target + "'\n" +
						"	id='_VLC_DivPlayer'\n" +
						"	autoplay='yes'\n" +
						"	toolbar='false'\n" +
						"/>\n";
			}
			div.innerHTML = str;
			this.firstVLC = true;
			VLCInUse = true;
			setTimeout(this.callCreateWait, 20);
			return;
		}
	}
	if (VLCInUse) {
		// if VLC is already being used by another playlist
		// then skip this item.
		this.playList.errorLog("VLC In Use. Skipping " + this.target + " id=" + this.id);
		setTimeout(this.callNext, 100);
		return;
	}
	VLCInUse = true;

	if (VLCEmbed == null) {
		VLCEmbed = document.getElementById("_VLC_DivPlayer");
	}

	if (VLCDiv == null || VLCEmbed == null) {
		this.playList.errorLog("ERROR finding vlc elements");
		if (this.playList) {
			this.playList.next();
		}
		return;
	}

	var vlc = VLCEmbed;
	if (this.vlcElement == null) {
		this.vlcElement = vlc;
	}
	
	if(signageBrowserInfo.name === "MSIE") {
		vlc.style.left   = left;
		vlc.style.top    = top;
		vlc.style.width  = width + "px";
		vlc.style.height = height + "px";
	}
	
	debug("Video VLC start: " + this.target + " id=" + this.id + "pos=" + left + "," + top + ", size=" + width + "x" + height);

	if (!this.firstVLC) {
		VLCDiv.style.left   = left;
		VLCDiv.style.top    = top;
		VLCDiv.style.width  = width;
		VLCDiv.style.height = dHeight;
		vlc.style.width  = width;
		vlc.style.height = height;

		if (vlc.playlist) {
			if (vlc.playlist.items.count > 0) {
				vlc.playlist.items.clear();
				while (vlc.playlist.items.count > 0) {
					// clear() may return before the playlist has actually been cleared
					// just wait for it to finish its job
				}
			}
			var item = vlc.playlist.add(this.target);
			vlc.playlist.playItem(item);
		}
	} else {
		this.firstVLC = false;
	}
	this.playList.playing(this.target);

	try {
		if (this.playList.program.mainVolume != null) {
			vlc.audio.volume = this.playList.program.mainVolume;
		}
		debug("Volume " + vlc.audio.volume);
	} catch(err) {
		debug("ERROR setting volume: '" + err + "'");
	}

	VLCDiv.style.visibility = 'visible';
	VLCDiv.style.display    = 'block';

	this.endDelayFlag = false;
	this.startTimeout();
	this.pollTimerId = setTimeout(this.callPoll, this.pollTime);

	if (this.file.toLowerCase().indexOf("nsnd") == -1) {
		this.audioPausedFlag = true;
		backgroundAudioPause();
	} else {
		this.audioPausedFlag = false;
	}
};

VideoVLC.prototype.stop = function()
{
	debug("VideoVLC stop " + this.target);
	if (this.pollTimerId) {
		clearTimeout(this.pollTimerId);
		this.pollTimerId = null;
	}
	this.stopTimeout();

	if (VLCDiv) {
		VLCDiv.style.visibility = 'hidden';
		VLCDiv.style.display    = 'none';
	}
	if (this.vlcElement) {
		var vlc = this.vlcElement;
		if (vlc.playlist) {
			vlc.playlist.stop();
			if (vlc.playlist.items && vlc.playlist.items.count > 0) {
				vlc.playlist.items.clear();
				while (vlc.playlist.items.count > 0) {
					// clear() may return before the playlist has actually been cleared
					// just wait for it to finish its job
				}
			}
		}
		this.vlcElement = null;
	}
	VLCInUse = false;

	if (this.audioPausedFlag) {
		this.audioPausedFlag = false;
		backgroundAudioResume();
	}

	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;
	
	if (this.playList) {
		this.playList.next();
	}
};

VideoVLC.prototype.pause = function()
{
	this.pauseTimeout();

	SignageLogTrace("VideoVLC Pause: file=" + this.file + " id=" + this.id + ", played seconds=" + this.playedSeconds + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (VLCDiv && VLCEmbed) {
		try {
			VLCEmbed.audio.mute = true;
		} catch(err) {
			debug("ERROR setting mute: '" + err + "'");
		}
		VLCDiv.style.visibility = 'hidden';
		VLCDiv.style.display    = 'none';
	}
};

VideoVLC.prototype.resume = function()
{
	SignageLogTrace("VideoVLC Resume: file=" + this.file + " id=" + this.id + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (VLCDiv && VLCEmbed) {
		try {
			VLCEmbed.audio.mute = false;
		} catch(err) {
			debug("ERROR setting unmute: '" + err + "'");
		}
		VLCDiv.style.visibility = 'visible';
		VLCDiv.style.display    = 'block';
	}
	this.resumeTimeout();
};

VideoVLC.prototype.next = function(div)
{
	if (this.playList) {
		this.playList.next();
	}
};

VideoVLC.prototype.cleanup = function(container)
{
};

// Detect when the VLC movie has ended.
VideoVLC.prototype.poll = function()
{
	var vlc = this.vlcElement;
	if (!vlc || !vlc.playlist) {
		this.playList.errorLog("ERROR: vlc object not valid while playing " + this.target);
		this.playList.program.setStatus('fatalError', (new Date()));
		this.playList.program.sendStatus(null);
		this.playList.program.fatalError = true;
		this.stop();
		return;
	}
	if (vlc.playlist) {
		if (! vlc.playlist.isPlaying) {
			if (this.stream && (! this.endDelayFlag)) {
				this.endDelayFlag = true;
				this.pollTimerId = setTimeout(this.callPoll, this.streamEndDelay);
			} else {
				this.endDelayFlag = false;
				this.stop();
			}
			return;
		}
	}

	this.pollTimerId = setTimeout(this.callPoll, this.pollTime);
};


//---------------------------------------------------
// Content object for still content.
function Still(doc, playList)
{
	this.type     = "still";
	this.doc      = doc;
	this.playList = playList;
	this.file     = getAttribute(doc, 'file', "");
	this.id       = getAttribute(doc, 'id', "0");
	var self = this;
	this.callStop = function() { self.stop(); };
	this.callError = function() { self.error(); };
}
Still.prototype = new Content();

Still.prototype.start = function()
{
	debug("Still start: file=" + this.file + " id=" + this.id);
	var now = new Date();

	this.playList.playing(this.file);
	var img = document.createElement('img');
	img.src = this.file + "?_=" + now.getTime();
	img.style.position = 'relative';
	img.style.width = 'auto';
	img.style.height = '100%';
	img.style.display = 'block';
	img.style.margin = '0 auto';
	this.playList.currentContainer.div.appendChild(img);

	this.imgElement = img;
	this.playList.currentContainer.imgElement = img;
	this.imgElement.addEventListener('error', this.callError, false);
	this.startTimeout();
};

Still.prototype.cleanup = function(container)
{
	if (container.imgElement) {
		container.imgElement.removeEventListener('error', this.callError, false);
		if (container.div) {
			container.div.removeChild(container.imgElement);
			container.div.innerHTML = "";
		}
		container.imgElement = null;
	}
};

Still.prototype.pause = function()
{
	this.pauseTimeout();
	SignageLogTrace("Still Pause: file=" + this.file + " id=" + this.id + ", played seconds=" + this.playedSeconds + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.imgElement) {
		this.imgElement.style.visibility = 'hidden';
	}
};

Still.prototype.resume = function()
{
	SignageLogTrace("Still Resume: file=" + this.file + " id=" + this.id + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.imgElement) {
		this.imgElement.style.visibility = 'visible';
	}
	this.resumeTimeout();
};

Still.prototype.error = function()
{
	this.playList.errorLog("ERROR displaying image " + this.file);
	this.stop();
};


//---------------------------------------------------
// Content object for Flash content.
function Flash(doc, playList)
{
	this.type     = "flash";
	this.doc      = doc;
	this.playList = playList;
	this.pollTime = 400;
	this.file     = getAttribute(doc, 'file', "");
	this.id       = getAttribute(doc, 'id', "0");
	var self = this;
	this.callStop = function() { self.stop(); };
	this.callPoll = function() { self.poll(); };
}
Flash.prototype = new Content();

Flash.prototype.start = function()
{
	debug("Flash start: file=" + this.file + " id=" + this.id);
	var scaleOption = "";
	var scale = this.doc.attributes.getNamedItem('scale');
	if (scale) {
		if (scale.nodeValue.toLowerCase() == "tofit") {
			scaleOption = " scale='exactfit'";
		}
	}
	this.playList.playing(this.file);
	this.flashPlayerName = "FlashPlayer" + this.id;
	this.playList.currentContainer.div.innerHTML = "<embed width='100%' height='100%'" +
		" type='application/x-shockwave-flash'" +
		" src='" + this.file + "'" +
		" swliveconnect='true'" +
		" loop='false'" +
		" quality='high'" +
		" play='true'" +
		" bgcolor='#000000'" +
		scaleOption +
		" name='" + this.flashPlayerName + "'" +
		" id='" + this.flashPlayerName + "'" +
		" > " +
		"</embed>";

	this.pollTimerId = setTimeout(this.callPoll, this.pollTime);
	this.startTimeout();
};

Flash.prototype.stop = function()
{
	this.stopTimeout();

	this.flashPlayer = null;
	if (this.pollTimerId) {
		clearTimeout(this.pollTimerId);
		this.pollTimerId = null;
	}

	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;

	this.playList.currentContainer.div.innerHTML = "";
	this.playList.next();
};

// Detect when the flash file has ended.
Flash.prototype.poll = function()
{
	if (this.duration != 0) {
		// Note: If duration is non-zero then disable end-detection. This forces
		// play time to be the time set by duration. This is needed because
		// end-detection does not work for all flash files.
		return;
	}
	if (!this.flashPlayer) {
		this.flashPlayer = document.getElementById(this.flashPlayerName);
	}
	if (!this.flashPlayer) {
		return;
	}
	if (!this.frameLast) {
		this.frameLast  = this.flashPlayer.TGetPropertyAsNumber("/", 4);
	}
	if (!this.frameTotal) {
		this.frameTotal = this.flashPlayer.TGetPropertyAsNumber("/", 5);
	}
	var currentFrame = this.flashPlayer.TGetPropertyAsNumber("/", 4);
	if (this.flashPlayer.IsPlaying() == false ||
		currentFrame < (this.frameLast - 1) ||
		currentFrame > this.frameTotal)
	{
		this.frameLast = null;
		this.frameTotal = null;
		this.stop();
	} else {
		this.frameLast = currentFrame;
		this.pollTimerId = setTimeout(this.callPoll, this.pollTime);
	}
};

Flash.prototype.pause = function()
{
	this.stopTimeout();

	if (this.playList && this.playList.currentContainer && this.playList.currentContainer.div) {
		this.cleanup(this.playList.currentContainer);
	}

	if (this.flashPlayer) {
		this.flashPlayer = null;
	}

	if (this.pollTimerId) {
		clearTimeout(this.pollTimerId);
		this.pollTimerId = null;
	}
};


//---------------------------------------------------
// Content object for HTML content.
function HtmlPage(doc, playList)
{
	this.type     = "html";
	this.doc      = doc;
	this.playList = playList;
	this.file     = getAttribute(doc, 'file', "");
	this.id       = getAttribute(doc, 'id', "0");
	var self = this;
	this.callStop = function() { self.stop(); };
}
HtmlPage.prototype = new Content();

HtmlPage.prototype.start = function()
{
	SignageLogTrace("HTML page start: file=" + this.file + " id=" + this.id);
	this.playList.playing(this.file);
	url = this.file;
	this.playList.currentContainer.div.innerHTML = "<iframe src='" + url + "' frameborder='0' scrolling='no' " +
		"style='background-color:white; width:100%; height:100%; overflow: hidden;' > ---- </iframe>";
	this.startTimeout();
};

HtmlPage.prototype.pause = function()
{
	this.pauseTimeout();
	SignageLogTrace("HtmlPage Pause: file=" + this.file + " id=" + this.id + ", played seconds=" + this.playedSeconds + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.playList.currentContainer.div) {
		this.playList.currentContainer.div.style.visibility = 'hidden';
	}
};

HtmlPage.prototype.resume = function()
{
	SignageLogTrace("HtmlPage Resume: file=" + this.file + " id=" + this.id + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.playList.currentContainer.div) {
		this.playList.currentContainer.div.style.visibility = 'visible';
	}
	this.resumeTimeout();
};


//---------------------------------------------------
// Content object for audio content.
function Audio(doc, playList)
{
	this.type     = "audio";
	this.doc      = doc;
	this.playList = playList;
	this.file     = getAttribute(doc, 'file', "");
	this.id       = getAttribute(doc, 'id', "0");
	var self = this;
	this.callStop = function() { self.stop(); };
	this.callError = function() { self.error(); };
}
Audio.prototype = new Content();

Audio.prototype.start = function()
{
	if (backgroundAudioObject && this.playList) {
		this.playList.next();
		return;
	}
	backgroundAudioObject = this;
	SignageLogTrace("Audio Start: file=" + this.file + " id=" + this.id);

	var audio = this.playList.currentContainer.audio;
	this.container = this.playList.currentContainer;
	if (this.playList.currentContainer.audio === undefined) {
		audio = document.createElement('audio');
		this.playList.currentContainer.audio = audio;
		audio.autoplay = false;
		audio.style.position = 'relative';
		audio.style.width = '100%';
		audio.style.height = '100%';
		audio.style.display = 'block';
	}
	this.audioElement = audio;
	this.container.div.appendChild(audio);
	this.container.audioElement = audio;
	audio.src = this.file;
	this.playList.playing(this.file);

	this.audioElement.addEventListener('ended', this.callStop, false);
	this.audioElement.addEventListener('error', this.callStop, false);
	this.startTimeout();
	if (backgroundAudioPauseCount <= 0) {
		this.audioElement.play();
	}
};

Audio.prototype.stop = function()
{
	SignageLogTrace("Audio Stop: file=" + this.file + " id=" + this.id);

	this.stopTimeout();
	backgroundAudioObject = null;
	
	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;
	
	if (this.playList) {
		this.playList.next();
	}
};

Audio.prototype.pause = function()
{
};

Audio.prototype.resume = function()
{
};

Audio.prototype.cleanup = function(container)
{
	if (container.audioElement) {
		container.audioElement.removeEventListener('ended', this.callStop, false);
		container.audioElement.removeEventListener('error', this.callStop, false);
		if (container.div) {
			container.div.removeChild(container.audioElement);
			container.div.innerHTML = "";
		}
	}
};

Audio.prototype.error = function()
{
	this.playList.errorLog("ERROR playing audio " + this.file);
	this.stop();
};


//---------------------------------------------------
function PlaceHolder(doc, playList)
{
	this.type     = "placeHolder";
	this.placeHolderFlag = true;
	this.doc      = doc;
	this.playList = playList;
	this.id       = getAttribute(doc, 'id', "1");
	this.slot     = getAttribute(doc, 'slot', "");
	this.limit    = getAttribute(doc, 'limit', "0");
	this.file     = "placeHolder";
	if (this.slot == "") {
		this.slot = this.id;
	}
	var re = /true|yes|on|1/i;
	this.fullScreenFlag = re.test(getAttribute(this.doc, 'fullscreen', "false"));

	this.count = 0;
	this.timeoutFired = false;

	var self = this;
	this.callStop = function() { self.stop(); };

	this.playList.currentContainer.div.innerHTML = "";
	this.playList.startDelay = 700;

}
PlaceHolder.prototype = new Content();

PlaceHolder.prototype.start = function()
{
	debug("Starting local content");
	this.currentContent = this.playList.localContent.getNext();
	if (this.currentContent) {
		this.count += 1;
		this.currentContent.start();
		if (this.count == 1) {
			this.startTimeout();
		}
	} else {
		setTimeout(this.callStop, 20);
	}
};

PlaceHolder.prototype.stop = function()
{
	this.stopTimeout();
	this.timeoutFired = true;

	if (this.currentContent) {
		this.currentContent.stop();
	} else if (this.playList) {
		this.playList.next();
	}
	
	this.paused = 0;
	this.playedSeconds = 0;
	this.reminder = 0;
};

PlaceHolder.prototype.pause = function()
{
	this.pauseTimeout();
	SignageLogTrace("PlaceHolder Pause:  id=" + this.id + ", played seconds=" + this.playedSeconds + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.currentContent) {
		this.currentContent.pause();
	}
};

PlaceHolder.prototype.resume = function()
{
	
	SignageLogTrace("PlaceHolder Resume: id=" + this.id + ", " + (this.reminder > 0 ? this.reminder : "?") + " seconds left");
	if (this.currentContent) {
		this.currentContent.resume();
	}
	this.resumeTimeout();
};

PlaceHolder.prototype.reachedLimit = function() {
	var limit = this.limit;
	if (limit == 0) {
		limit = this.playList.program.config['placeholderlimit'];
	}
	if ((limit && limit > 0 &&  limit <= this.count) || this.timeoutFired) {
		this.count = 0;
		this.timeoutFired = false;
		return true;
	}
	return false;
};



//---------------------------------------------------
function LocalContentList(playList)
{
	this.playList = playList;
	this.id       = "1";
	this.slot     = this.id;

	this.index = -1;
	this.list  = [];
	this.rap   = false;
}

LocalContentList.prototype.readList = function()
{
	var now = new Date();
	signageAjax({
		url: "localcontent/" + this.slot + "/description.xml" + "?_=" + now.getTime(),
		type: "get",
		dataType: "xml",
		context: this,
		success: this.descriptionCallBack,
		error: function(xhr, msg, err) {
			this.playList.errorLog("ERROR reading local content description file ");
		}
	});
};

LocalContentList.prototype.descriptionCallBack = function(description)
{
	if (!description) {
		return;
	}
	var element = description.getElementsByTagName('localPlayList')[0];
	if (!element) {
		this.playList.errorLog("ERROR: invalid local content description file.");
		return;
	}

	this.index  = -1;
	this.list   = [];

	var items = element.getElementsByTagName('item');
	for (var i = 0; i < items.length; i += 1) {
		var fileAttr = items[i].attributes.getNamedItem('file');
		if (!fileAttr) {
			continue;
		}
		fileAttr.nodeValue = "localcontent/" + this.slot + "/" + fileAttr.nodeValue;

		var attr = items[i].attributes.getNamedItem('duration');
		if (attr == null) {
			attr = document.createAttribute('duration');
			attr.nodeValue = '0';
			items[i].setAttributeNode(attr);
		}

		var now = new Date();
		// honor end and start dates if present
		if (items[i].attributes.getNamedItem('end')) {
			var endStr = items[i].attributes.getNamedItem('end').nodeValue;
			if (endStr) {
				var end = new Date(endStr);
				if (!isNaN(end.valueOf())) {
					if (now > end) {
						continue;
					}
				}
			}
		}
		if (items[i].attributes.getNamedItem('start')) {
			var startStr = items[i].attributes.getNamedItem('start').nodeValue;
			if (startStr) {
				var start = new Date(startStr);
				if (!isNaN(start.valueOf())) {
					if (now < start) {
						continue;
					}
				}
			}
		}

		var content = null;
		var type = getAttribute(items[i], 'type', "invalid");
		switch (type) {
			case "video":
				if (signageBrowserInfo.useVLC) {
					content = new VideoVLC(items[i], this.playList);
				} else {
					content = new Video(items[i], this.playList);
				}
				break;
			case "still":
				content = new Still(items[i], this.playList);
				break;
			case "flash":
				content = new Flash(items[i], this.playList);
				break;
			case "html":
				content = new HtmlPage(items[i], this.playList);
				break;
			default:
				this.playList.errorLog("Unknown local content type: " + type);
				break;
		}
		if (content) {
			this.list.push(content);
		}
	}
};

LocalContentList.prototype.getNext = function()
{
	var len = this.list.length;
	if (this.index < len) {
		this.index += 1;
	}
	if (this.index >= len) {
		if (this.rap) {
			this.index = 0;
			this.rap = false;
		}
	}
	if (this.index >= len) {
		return null;
	}
	return this.list[this.index];
};

LocalContentList.prototype.beginPlayList = function()
{
	if (((this.index + 1) >= this.list.length) || (this.index == -1)) {
		this.index = -1;
		this.rap = false;
	} else {
		this.rap = true;
	}
};

LocalContentList.prototype.reachedEnd = function()
{
	return (((this.index + 1) >= this.list.length) && !this.rap);
};



//---------------------------------------------------
function DefaultNullTransitions(div0, callBackObject)
{
	this.div0  = div0;
	this.callBackObject = callBackObject;
	this.duration = 1;
}

DefaultNullTransitions.prototype.start = function(outgoing, incoming)
{
	var style;
	style = "position:absolute; top: 0%; left: 0%; width: 100%; height: 100%; opacity: 1; visibility:visible;";
	incoming.div.setAttribute('style', style);
	style = "position:absolute; top: 0%; left: 0%; width: 100%; height: 100%; opacity: 0; visibility:hidden;";
	outgoing.div.setAttribute('style', style);
	this.callBackObject.transitionEnd(outgoing);
};

DefaultNullTransitions.prototype.checkAbort = function()
{
};



//---------------------------------------------------
// Search all of the div tags looking for one the has
// a layoutPlayList attribute that matches layoutPlayList.
function GetPlayListDiv(layoutPlayList)
{
	var divList = document.getElementsByTagName('div');
	var div = null;
	for (var i = 0; i < divList.length; i++) {
		var node = divList[i].attributes.getNamedItem("layoutPlayList");
		if (node) {
			var name = node.nodeValue;
			if (name == layoutPlayList) {
				div = divList[i];
				break;
			}
		}
	}
	return div;
}

//---------------------------------------------------
function Container()
{
	this.div = document.createElement('div');
}

//---------------------------------------------------
/**
 * Object for start/stop parameters of the Smart play list
 * Parses "time" element of the smart playlist element.
 * Negative value of this.start means error in parameters.
 * @param {Object} obj - child element "time" of the of the element "smart"
 */
function SmartParams(obj) {
	var end;

	this.start = -1;		// time from the argument start of the element time. Negative value means error in parsing or absence of that attribute
	this.play_count = 0;	// play count from the argument play_count of the element time. 0 value means error in parsing or absence of that attribute
	this.duration;			// Duration of the playlist with these parameters. For case with defined play_count instead of end we use previous end time of that play list. 

	// Parse attribute full_screen with false as a default value.
	var val = /true|yes|on|1/i;
	this.fullScreenFlag = val.test(getAttribute(obj, 'full_screen', "false"));

	// Parse attribute end.
	val = obj.attributes.getNamedItem("end");
	if (val) {
		// exit on error in parsing
		end = this.strToTime(val.nodeValue);
		if (end < 0)
			return;
	} else {
		// There is not attribute end. Then attribute play_count must exist. Parse it and exit on error.
		val = obj.attributes.getNamedItem("play_count");
		if (!val)
			return;
		this.play_count = parseInt(val.nodeValue);
		if (this.play_count == 0)
			return;
		// play_count exists. Use current time as end to be able to start correctly that play list first time after page start.
		end = new Date();
		end = (end.getHours() * 3600) + (end.getMinutes() * 60) + end.getSeconds();
	}

	// Attribute start must exist. Parse it and return on error.
	val = obj.attributes.getNamedItem("start");
	if (!val)
		return;
	this.start = this.strToTime(val.nodeValue);

	// if we parsed all parameters successfully then calulate duration - time from start till end.
	// We will need it to detect when to start or stop that play list.
	if (this.start >= 0) {
		this.duration = this.calcIntervalFromStart(end);
	}
}

/**
 * Sets duration of the SmartParams object with non-0 play_count to mark it as ended at current time
 */
SmartParams.prototype.resetPlayCount = function () {
	if (this.play_count > 0) {
		var now = new Date();
		now = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
		this.duration = this.calcIntervalFromStart(now);
	}

}

/**
 * Calculates interval in seconds passed from start till specific time
 * 
 * @param {Number} time - integer value of the current time of the day in seconds
 *
 * @returns {Number} The interval in seconds passed from the start till time
 */
SmartParams.prototype.calcIntervalFromStart = function (time) {
	var interval = time - this.start;
	if (interval < 0)
		interval += 3600 * 24;
	return interval;
}

/**
 * Converts time string to integer value of seconds passed since midnight
 *
 * @oaram {String} str - String representation of the time in format hh:mm:ss
 *
 * @returns {Number} Seconds passed since midnight: hh*3600+mm*60+ss
 */
SmartParams.prototype.strToTime = function (str) {
	var ret = -1;
	var re = /(\d\d):(\d\d):(\d\d)/;
	val = re.exec(str);
	if (val.length == 4
		&& val[1] >= 0 && val[1] <= 23
		&& val[2] >= 0 && val[2] <= 59
		&& val[3] >= 0 && val[3] <= 59) {
		val[1] = parseInt(val[1]);
		val[2] = parseInt(val[2]);
		val[3] = parseInt(val[3]);
		ret = (val[1] * 3600) + (val[2] * 60) + val[3];
	}
	return ret;
}

/**
 * Checks parameters of the object to check if it should be running at current time.
 * @parama {Number} currentTime - Current time of the day in seconds.
 *
 * @returns {Boolean} true is this playlist should be running at that time (currentTime)
 */
SmartParams.prototype.shouldBeRunning = function (currentTime) {
	var interval = this.calcIntervalFromStart(currentTime);
	return interval < this.duration;
}

//---------------------------------------------------
// Play list object
// Manages each play list.
function Playlist(doc, program)
{
	this.doc = doc;
	this.program = program;
	this.index = 0;
	this.fullScreenActive = false;
	this.startDelay = 10;
	this.smart_params = [];					// Array of SmartParams objects created for that playlist from elements "time". It is empty for non-smart playlist.
	this.smart_target_playlist = null;		// Playlist which has to be replaced by this smart playlist during its playing.
	this.smart_play_count = 0;				// Remaining cont to play cycles of the smart playlist. 0 means don't stop playlist by play_count.
	this.smart_stopped = false;				// true if playlist is stopped by smart playlist or if it is stopped smart playlist

	var self = this;
	this.callStart = function() { self.start(); };
	this.callLocalPlayListTimeout = function() { self.localPlayListTimeout(); };

	this.localContent = new LocalContentList(this);

	var node = doc.attributes.getNamedItem("name");
	// if no name attribute then it can be smart play list
	if (!node) {
		// parent should me "smart"
		var parent = doc.parentNode;
		if (parent.tagName == "smart") {
			// it must contain name in the attribute "playlist"
			var playListName = parent.attributes.getNamedItem("playlist");
			if (playListName) {
				// go through each "time" element and create SmartParams object
				var timeElements = parent.getElementsByTagName("time");
				for (i = 0; i < timeElements.length; i++) {
					var smartParamsItem = new SmartParams(timeElements[i]);
					// If something wrong in attributes of the element "time" then ignore that playlist
					if (smartParamsItem.start < 0)
						return;
					// Otherwise remember that object.
					if (smartParamsItem.start >= 0)
						this.smart_params.push(smartParamsItem);
				}
				//// if that smart playlist has at least one "time" element then proceed with that name
				//if (this.smart_params.length > 0)
					node = playListName;
			}
		}
	}
	if (!node) {
		return;
	}

	// if it is not smart playlist or it is smart playlist without "time" elements
	if (this.smart_params.length == 0) {
		// if any already parsed playlist targeted to the same div then ignore that playlist
		var j;
		for (j = 0; j < program.playlists.length; j++) {
			if (node.nodeValue === program.playlists[j].name)
				return;
		}
	}
	this.name = node.nodeValue;
	this.contentList = [];
	this.div0 = GetPlayListDiv(this.name);
	if (!this.div0) {
		return;
	}
	// don't create containers for smart playlist. We will use them from the replacing normal playlist
	if (this.smart_params.length == 0) {
		this.div0.innerHTML = "";

		this.containerA = new Container;
		this.div0.appendChild(this.containerA.div);
		this.containerB = new Container;
		this.div0.appendChild(this.containerB.div);
	} else {
		this.containerA = null;
		this.containerB = null;
	}
	this.currentContainer = this.containerA;
	this.lastContainer = this.containerB;

	try {
		if (signageBrowserInfo.webKitVersionNumber > 0.0) {
			this.transition = new Transitions(this.div0, this);
		} else {
			throw "Transitions not supported by browser";
		}
	} catch (err) {
		debug(err);
		this.transition = new DefaultNullTransitions(this.div0, this);
	}

	var now = new Date();
	var m;
	var re = /(\d\d\d\d)-(\d+)-(\d+)/;
	var placeHolderCount = 0;
	var contentDocs = doc.childNodes;
	for (var i = 0; i < contentDocs.length; i++) {
		if (contentDocs[i].nodeType == 1) {
			// honor expire and start dates if present
			if (contentDocs[i].attributes.getNamedItem('expire')) {
				m = re.exec(contentDocs[i].attributes.getNamedItem('expire').nodeValue);
				if (m) {
					var expire = new Date(m[1], m[2] - 1, m[3], 23, 59, 59);
					if (now > expire) {
						continue;
					}
				}
			}
			if (contentDocs[i].attributes.getNamedItem('start')) {
				m = re.exec(contentDocs[i].attributes.getNamedItem('start').nodeValue);
				if (m) {
					var start = new Date(m[1], m[2] - 1, m[3], 0, 0, 0);
					if (now < start) {
						continue;
					}
				}
			}
			var content = null;
			switch (contentDocs[i].tagName) {
				case "video":
					if (signageBrowserInfo.useVLC) {
						content = new VideoVLC(contentDocs[i], this);
					} else {
						content = new Video(contentDocs[i], this);
					}
					break;
				case "still":
					content = new Still(contentDocs[i], this);
					break;
				case "flash":
					content = new Flash(contentDocs[i], this);
					break;
				case "html":
					content = new HtmlPage(contentDocs[i], this);
					break;
				case "stream":
					content = new VideoVLC(contentDocs[i], this);
					break;
				case "audio":
					content = new Audio(contentDocs[i], this);
					break;
				case "placeholder":
				case "localcontent":
					content = new PlaceHolder(contentDocs[i], this);
					placeHolderCount += 1;
					break;
				default:
					this.errorLog("Unknown content type: " + contentDocs[i].tagName);
					break;
			}
			if (content) {
				var reTrue = /true|yes|on|1/i;
				content.fullScreenFlag = reTrue.test(getAttribute(contentDocs[i], 'fullscreen', "false"));
				this.contentList.push(content);
			}
		}
	}
	if (this.contentList.length <= 0) {
		this.errorLog("ERROR: empty playlist");
	}
	if (placeHolderCount) {
		this.localContent.readList();
	}
}

Playlist.prototype.start = function ()
{
	SignageLogTrace("Playlist start startDelay=" + this.startDelay  + " name=" + this.name);
	if (this.startDelay > 0) {
		this.startDelay -= 50;
		setTimeout(this.callStart, 50);
		return;
	}

	if (this.program.fullScreenPlaylist && this.program.fullScreenPlaylist !== this
		&& !this.program.fullScreenPlaylist.smart_stopped) {
		SignageLogTrace("Another playlist is in fullscreen mode, do not start, try later");
		// if another playlist is in fullscreen mode and it is not stopped smart playlist and not playlist stopped by smart playlist
		// do not start, try later.
		setTimeout(this.callStart, 1000);
		return;
	}
	var content = this.contentList[this.index];
	if (content.fullScreenFlag) {
		SignageLogTrace("Content fullscreen");	
		if (this.lastFullScreenContainer == this.program.fullScreenContainerA) {
			this.currentContainer = this.program.fullScreenContainerB;
		} else {
			this.currentContainer = this.program.fullScreenContainerA;
		}
		this.lastFullScreenContainer = this.currentContainer;
		var div = this.currentContainer.div;
		div.style.position = 'absolute';
		div.style.top = '0';
		div.style.left = '0';
		div.style.width = '100%';
		div.style.height = '100%';
		if (!this.fullScreenActive) {
			this.fullScreenActive = true;
			// if it is smart playlist then mark target playlist as full screen before calling pause() 
			if (this.smart_target_playlist)
				this.smart_target_playlist.fullScreenActive = true;
			this.program.fullScreenPlaylist = this;
			this.program.fullScreenDiv.style.display = 'block';
			SignageLogTrace("Content fullscreen, pause program");
			this.program.pause();
		}
	} else {
		if (this.fullScreenActive) {
			SignageLogTrace("Resume program");
			this.program.resume();
			this.fullScreenActive = false;
			// if it is smart playlist then unmark target playlist as full screen after calling resume()
			if (this.smart_target_playlist)
				this.smart_target_playlist.fullScreenActive = false;
			this.program.fullScreenPlaylist = null;
			this.program.fullScreenDiv.style.display = 'none';
		}
	}
	this.startTime = new Date();
	this.transition.checkAbort();
	SignageLogTrace("Calling content.start");
	content.start();
	this.currentContainer.myContent = content;
	if(signageBrowserInfo.name !== "MSIE" || content.type !== "video") {
		this.transition.start(this.lastContainer, this.currentContainer);
	}
	if (this.fullScreenActive) {
		this.currentContainer.div.style.backgroundColor = 'black';
	}
};

Playlist.prototype.next = function()
{
	var content = this.contentList[this.index];

	if (!(content && content.placeHolderFlag && !(content.reachedLimit() || this.localContent.reachedEnd()))) {
		if (content.placeHolderFlag) {
			content.stopTimeout();
			content.count = 0;
			if ((this.program.config['placeholderlimit'] === undefined) && (content.limit == 0)) {
				if (!this.smart_stopped)
					this.localContent.beginPlayList();
			}
		}
		this.index += 1;
	}
	if (this.index >= this.contentList.length) {
		this.index = 0;
		if (this.smart_play_count > 0) {
			if (--this.smart_play_count == 0) {
				// Mark playlist as stopped by play_count
				this.smart_stopped = true;
				// restart smart playlist poll timer with small timeout (10ms) to stop smart playlist from there
				if (signageProgramObject.smartPlaylistTimerId)
					clearTimeout(signageProgramObject.smartPlaylistTimerId);
				signageProgramObject.smartPlaylistTimerId = setTimeout(signageProgramObject.callSmartPlaylistTimerCb, 10);
			}
		}
		if (!this.smart_stopped)
			this.localContent.beginPlayList();
	}
	this.lastContainer = this.currentContainer;
	if (this.currentContainer == this.containerA) {
		this.currentContainer = this.containerB;
	} else {
		this.currentContainer = this.containerA;
	}

	if (content && content.placeHolderFlag) {
		content = content.currentContent;
	}
	var now = new Date();
	var playedFile  = 'unknown';
	var playedStart = this.startTime;
	var playedEnd   = now;
	var playedId    = '0';

	if (content) {
		playedFile = content.file;
		playedId   = content.id;
	}

	// Don't start playlist if it is stopping
	if (this.smart_stopped)
		SignageLogTrace("Playlist.next: don't start stopping replaced or smart playlist " + this.name);
	else
		this.start();

	if (content) {
		this.program.playReport(playedFile, playedStart, playedEnd, playedId, this.name, this.program.name);
	}
};

Playlist.prototype.transitionEnd = function(container)
{
	if (container && container.myContent) {
		SignageLogTrace("Playlist transitionEnd - Cleanup name=" + this.name);
		container.myContent.cleanup(container);
	}
};

Playlist.prototype.pause = function()
{
	if (!this.fullScreenActive && this.contentList[this.index]) {
		SignageLogTrace("Pause content playlist name=" + this.name);
		this.contentList[this.index].pause();
	}
};

Playlist.prototype.resume = function()
{
	if (!this.fullScreenActive && this.contentList[this.index]) {
		SignageLogTrace("Resume content playlist name=" + this.name);
		this.contentList[this.index].resume();
	}
};

Playlist.prototype.playing = function(file)
{
	this.playingFile = file;
};

Playlist.prototype.errorLog = function(message)
{
	this.program.errorLog("[" + this.name + "] " + message);
};

Playlist.prototype.traceLog = function(message)
{
	if (!signageTraceLogOn) { return; }
	this.program.traceLog("[" + this.name + "] " + message);
};


//---------------------------------------------------
//---------------------------------------------------
// The Program object manages the active MediaSignage program.
function Program()
{
	var mySelf = this;
	this.callSendStatus = function() { mySelf.sendStatus(null); };

	this.smartPlaylistTimerId = null;
	this.callSmartPlaylistTimerCb = function () { mySelf.smartPlaylistTimerCb(null); };

	this.sendStatusTimerId  = null;
	this.playlists          = [];
	this.smartPlaylists     = [];
	this.sendStatusQueue	= [];
	this.statusData         = {};
	this.fullScreenPlaylist = null;
	this.version            = 'first time';


	this.setStatus('errorMessageLast', "");
	this.setStatus('errorMessageTime', "");
	this.burstErrorCount   = 0;
	this.burstErrorTime    = new Date(0);
	this.fatalError        = false;
	this.programStartTime  = new Date();
	this.mainVolume        = null;

	if (!signageBrowserInfo) {
		signageBrowserInfo = new SignageBrowserDetect();
	}

	this.config = {};

	this.uri = window.location;
	if (this.uri.protocol == "file:") {
		this.host = "localhost";
	} else {
		this.host = this.uri.host;
	}
	this.setStatus('signageDir', this.uri.pathname.replace((new RegExp("/[^/]+/[^/]+$")), ""));

	this.fullScreenDiv = document.createElement('div');
	this.fullScreenContainerA = new Container;
	this.fullScreenDiv.appendChild(this.fullScreenContainerA.div);
	this.fullScreenContainerB = new Container;
	this.fullScreenDiv.appendChild(this.fullScreenContainerB.div);
	this.lastFullScreenContainer = this.fullScreenContainerA;

	this.fullScreenDiv.style.overflow = 'hidden';
	this.fullScreenDiv.style.position = 'absolute';
	this.fullScreenDiv.style.top      = '0%';
	this.fullScreenDiv.style.left     = '0%';
	this.fullScreenDiv.style.width    = '100%';
	this.fullScreenDiv.style.height   = '100%';
	this.fullScreenDiv.style.display  = 'none';
	document.body.appendChild(this.fullScreenDiv);
	this.sendStatus(null);
}

Program.prototype.start = function()
{
	var i;
	// start the play lists
	for (i = 0; i < this.playlists.length; i++) {
		this.playlists[i].start();
	}

	debug("components");
	// start the layout components
	var divList = document.getElementsByTagName('div');
	for (i = 0; i < divList.length; i++) {
		var node = divList[i].attributes.getNamedItem("layoutComponent");
		if (node) {
			debug(node.nodeValue);
			var obj = eval(node.nodeValue);
			if (obj) {
				obj(divList[i]);
			}
		}
	}
	debug("-- components");
};

Program.prototype.pause = function()
{
	// pause all play lists
	for (var i = 0; i < this.playlists.length; i++) {
		this.playlists[i].pause();
	}
};

Program.prototype.resume = function()
{
	// resume all play lists
	for (var i = 0; i < this.playlists.length; i++) {
		this.playlists[i].resume();
	}
};

Program.prototype.setStatus = function(name, value)
{
	var val = value;
	if (val instanceof Date) {
		val = this.dateToRFC3339(value);
	}
	this.statusData[name] = val;
};

/**
 * Check the status of smart play lists and stop or start them in accordance with configuration.
 */
Program.prototype.smartPlaylistStartStop = function () {
	var idxPlayList, idxParams, smartPlaylist, targetPlaylist;

	// Clear smart lists poll timer if it is running
	if (this.smartPlaylistTimerId)
		clearTimeout(this.smartPlaylistTimerId);
	this.smartPlaylistTimerId = 0;

	// get current time of the day in seconds
	var now = new Date();
	var currentTime = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

	// Go through each smart playlist
	for (idxPlayList = 0; idxPlayList < this.smartPlaylists.length; idxPlayList++) {
		smartPlaylist = this.smartPlaylists[idxPlayList];
		targetPlaylist = smartPlaylist.smart_target_playlist;
		// check if current smart playlist should be running
		var shouldBeRunning = false;
		// if smart playlist is running and exhousted its play_count
		if (smartPlaylist.containerA != null && smartPlaylist.smart_stopped)
			debug("smartPlaylistStartStop: exhousted play_count " + idxPlayList);
		else {
			// go through each item related to each element "time" in the current smart playlist
			for (idxParams = 0; idxParams < smartPlaylist.smart_params.length; idxParams++) {
				// exit loop if the current play list should be running in accordance with the current params
				if (smartPlaylist.smart_params[idxParams].shouldBeRunning(currentTime)) {
					shouldBeRunning = true;
					break;
				}
			}
		}
		// if current smart playlist should be running
		if (shouldBeRunning) {
			// if it is running then do nothing, Otherwise start it.
			if (smartPlaylist.containerA)
				debug("smartPlaylistStartStop: ignore running playlist " + idxPlayList);
			// Ignore that smart playlist if target playlist is ocupied by other smartplaylist
			else if (targetPlaylist.smart_stopped)
				debug("smartPlaylistStartStop: cann't start playlist " + idxPlayList);
			else {
				debug("smartPlaylistStartStop: start playlist " + idxPlayList);
				// mark target playlist as replaced by this smart playlist
				targetPlaylist.smart_stopped = true;
				smartPlaylist.smart_stopped = false;
				// stop target playlist
				if (targetPlaylist.contentList[targetPlaylist.index])
					targetPlaylist.contentList[targetPlaylist.index].stop();
				else
					debug("smartPlaylistStartStop: target playlist is not running");
				// Initialize play cycles count
				smartPlaylist.smart_play_count = smartPlaylist.smart_params[idxParams].play_count;
				// get containers from the target playlist
				smartPlaylist.containerA = targetPlaylist.containerA;
				smartPlaylist.containerB = targetPlaylist.containerB;
				smartPlaylist.currentContainer = targetPlaylist.currentContainer;
				smartPlaylist.lastContainer = targetPlaylist.lastContainer;

				for (var i = 0; i < smartPlaylist.contentList.length; i++) {
					smartPlaylist.contentList[i].fullScreenFlag = smartPlaylist.smart_params[idxParams].fullScreenFlag;
				}
				// start smart playlist
				smartPlaylist.start();
			}
		} else {
			// current smart playlist should not be running
			// if it is not running then do nothing.
			if (!smartPlaylist.containerA)
				debug("smartPlaylistStartStop: ignore stopped playlist " + idxPlayList);
			else {
				// current smart playlist is running but it should not
				debug("smartPlaylistStartStop: stop playlist " + idxPlayList);
				// mark original (replaced) playlist as starting
				targetPlaylist.smart_stopped = false;
				// stop smart playlist if it was not stopped by play_count
				if (!smartPlaylist.smart_stopped) {
					smartPlaylist.smart_stopped = true;
					if (smartPlaylist.contentList[smartPlaylist.index])
						smartPlaylist.contentList[smartPlaylist.index].stop();
					else
						debug("smartPlaylistStartStop: smart playlist is not running");
				}

				// reset duration of the each smartParams item with play_count
				for (idxParams = 0; idxParams < smartPlaylist.smart_params.length; idxParams++) {
					smartPlaylist.smart_params[idxParams].resetPlayCount();
				}

				// return containers to the target playlist
				targetPlaylist.containerA = smartPlaylist.containerA;
				targetPlaylist.containerB = smartPlaylist.containerB;
				targetPlaylist.currentContainer = smartPlaylist.currentContainer;
				targetPlaylist.lastContainer = smartPlaylist.lastContainer;
				smartPlaylist.containerA = null;
				smartPlaylist.containerB = null;
				smartPlaylist.currentContainer = null;
				smartPlaylist.lastContainer = null;
				// start target playlist from stopped position
				targetPlaylist.start();
			}
		}
	}
	// restart smart playlist poll timer
	this.smartPlaylistTimerId = setTimeout(this.callSmartPlaylistTimerCb, 2000);
}

/**
 * Callback function called by timer to check the status of smart play lists and stop or start them in accordance with nconfiguration.
 * @param data - not used
 */
Program.prototype.smartPlaylistTimerCb = function (data)
{
	this.smartPlaylistTimerId = 0;
	this.smartPlaylistStartStop();
}

// Send status and check for new parameters
Program.prototype.sendStatus = function(data)
{
	if (this.fatalError) {
		// After a fatal error stop sending status to force a hang.
		return;
	}
	if (data || (this.sendStatusQueue.length <= 0)) {
		this.sendStatusQueue.push(this.gatherStatus(data));
	}
	if (this.sendStatusActive) {
		return;
	}
	if (this.sendStatusTimerId) {
		clearTimeout(this.sendStatusTimerId);
		this.sendStatusTimerId = null;
	}
	var sData = this.sendStatusQueue.shift();
	this.sendStatusActive = true;

	if (typeof debugSimulateCgi === "undefined") {
		signageAjax({
			url: "http://" + this.host + "/cgi-bin/signageTunnel.cgi",
			type: "POST",
			dataType: "json",
			data: sData,
			context: this,
			success: this.gotParameters,
			error: function(err) {
				this.sendStatusActive = false;
			}
		});
	} else {
		var now = new Date();
		signageAjax({
			url: debugSimulateCgi + "?_=" + now.getTime(),
			type: "GET",
			dataType: "json",
			context: this,
			success: this.gotParameters,
			error: function (err) {
				this.sendStatusActive = false;
			}
		});
	}
	// in local debug mode don't send status again
	if (typeof debugSimulateCgi === "undefined") {
		this.sendStatusTimerId = setTimeout(this.callSendStatus, 10000);
	}
};

//---------------------------------------------------
Program.prototype.gatherStatus = function(data)
{
	var stat;
	if (data) {
		stat = data;
	} else {
		stat = {};
	}

	this.setStatus('timePlayer', (new Date()));

	// copy status data
	var obj = this.statusData;
	for (var property in obj) {
		if (obj.hasOwnProperty(property)) {
			stat[property] = obj[property];
		}
	}

	// get all the files that are currently playing
	var playingFiles = "";
	var playlists = this.playlists;
	for (var i = 0; i < playlists.length; i++) {
		if (playingFiles != "") {
			playingFiles = playingFiles + "," + playlists[i].playingFile;
		} else {
			playingFiles = playlists[i].playingFile;
		}
		stat['currentlyPlaying-' + playlists[i].name] = playlists[i].playingFile;
	}
	stat['currentlyPlayingFiles'] = playingFiles;

	return (stat);
};

Program.prototype.numPad = function(num)
{
	return num < 10 ? '0' + num : num;
};

Program.prototype.numPad3 = function(num)
{
	return num < 10 ? '00' + num : num < 100 ? '0' + num : num;
};

Program.prototype.dateToRFC3339 = function(date)
{
	var offset = date.getTimezoneOffset();
	var sign = '-';
	if (offset < 0) {
		sign = '+';
		offset = -offset;
	}
	var offsetHours = Math.floor(offset / 60);

	return date.getFullYear() + '-'
			+ this.numPad(date.getMonth() + 1) + '-'
			+ this.numPad(date.getDate()) + 'T'
			+ this.numPad(date.getHours()) + ':'
			+ this.numPad(date.getMinutes()) + ':'
			+ this.numPad(date.getSeconds()) + '.'
			+ this.numPad3(date.getMilliseconds()) + sign
			+ this.numPad(offsetHours) + ':'
			+ this.numPad(Math.floor(offset - (offsetHours * 60)));
};


//---------------------------------------------------
// Process the schedule file. It contains program info. Each program conains
// the play lists for the display.
Program.prototype.gotSchedule = function(sched)
{
	var i, j;

	if (!sched) {
		this.errorLog("ERROR Invalid schedule format");
		return;
	}

	// Clear smart lists poll timer if it is running
	if (this.smartPlaylistTimerId)
		clearTimeout(this.smartPlaylistTimerId);
	this.smartPlaylistTimerId = 0;

	this.scheduleXml = sched;
	this.playlists = [];

	var programName = this.parameters.program;
	var programDoc = null;
	var programList = sched.getElementsByTagName("programs")[0].getElementsByTagName("program");
	for (i = 0; i < programList.length; i++) {
		var name = programList[i].attributes.getNamedItem("name").nodeValue;
		if (name == programName) {
			programDoc = programList[i];
			break;
		}
	}
	if (programDoc == null) {
		return;
	}
	this.name = "";
	if (programDoc.attributes && programDoc.attributes.getNamedItem("name")) {
		this.name = programDoc.attributes.getNamedItem("name").nodeValue;
	}
	this.setStatus('programName', this.name);

	var playlistsDoc = programDoc.getElementsByTagName("playlist");
	for (i = 0; i < playlistsDoc.length; i++) {
		var pl = new Playlist(playlistsDoc[i], this);
		if (pl && pl.div0 && pl.contentList && pl.contentList.length > 0) {
			// Place smart playlist to special array smartPlaylists
			if (pl.smart_params.length > 0)
				this.smartPlaylists.push(pl);
			else
				this.playlists.push(pl);
		}
	}

	// Find target playlist for each smart playlist
	for (i = 0; i < this.smartPlaylists.length; i++) {
		for (j = 0; j < this.playlists.length; j++) {
			if (this.smartPlaylists[i].name === this.playlists[j].name)
				break;
		}
		// if found then do assignment. Otherwise delete this smart playlist from the array
		if (j < this.playlists.length)
			this.smartPlaylists[i].smart_target_playlist = this.playlists[j];
		else
			this.smartPlaylists.splice(i--, 1);
	}
	// if we have at least one smart playlist then start smart list poll timer
	if (this.smartPlaylists.length > 0)
		this.smartPlaylistTimerId = setTimeout(this.callSmartPlaylistTimerCb, 2000);

	this.start();
};

//---------------------------------------------------
// Process new parameters.
// If the parameter version has changed reload the page with the new version number.
// This will start everything anew without needing to restart the browser.
// The new play list will be read and the screen will be updated with a new layout and program.
Program.prototype.gotParameters = function(param)
{
	this.parameters = param;
	this.sendStatusActive = false;
	if (!param) {
		return;
	}

	var vol = param.volume;
	if (vol) {
		this.mainVolume = parseFloat(vol);
	} else {
		this.mainVolume = null;
	}
	var newVersion = param.version;
	if (!newVersion) {
		newVersion = '-2';
	} else {
		newVersion = newVersion.replace(/\s/g, '');
	}

	if (window.location.search.indexOf("version=" + newVersion) == -1) {
		if (this.version == 'first time') {
			window.location.search = ("version=" + newVersion);
		} else {
			window.location.reload(true);
		}
	} else {
		if (this.version != newVersion) {
			var now = new Date();
			signageAjax({
				url: param.schedule + "?_=" + now.getTime(),
				type: "GET",
				dataType: "xml",
				context: this,
				success: this.gotSchedule,
				error: function(xhr, msg, err) {
					this.errorLog("ERROR reading schedule " + this.parameters.schedule);
				}
			});
			signageAjax({
				url: "../config.xml" + "?_=" + now.getTime(),
				type: "GET",
				dataType: "xml",
				context: this,
				success: this.gotConfig,
				error: function (xhr, msg, err) {
					this.errorLog("ERROR reading config.xml");
				}
			});
			this.version = newVersion;
		}
		if (this.sendStatusQueue.length > 0) {
			this.sendStatus(null);
		}
	}
};

//---------------------------------------------------
Program.prototype.gotConfig = function(data)
{
	var conf = data.getElementsByTagName("configuration")[0];
	if (!conf) { return; }
	var configList = conf.getElementsByTagName("parameter");
	for (var i = 0; i < configList.length; i++) {
		var attr  = configList[i].attributes;
		var name  = attr.getNamedItem("name").nodeValue;
		var value = attr.getNamedItem("value").nodeValue;
		if (name && value) {
			this.config[name.toLowerCase()] = value;
		}
	}
};

Program.prototype.errorLog = function(message)
{
	var now = new Date();
	var errorLogTime = this.dateToRFC3339(now);
	this.setStatus('errorMessageLast', message);
	this.setStatus('errorMessageTime', errorLogTime);
	this.burstErrorLimit = 10;
	if ((now - this.burstErrorTime) < 20000) {     // time diff in milliseconds
		if (this.burstErrorCount <= this.burstErrorLimit) {
			if (this.burstErrorCount == this.burstErrorLimit) {
				message = "Signage player errors are happening too fast. Pausing logging for 20 seconds";
			}
			debug(message);
			// in local debug mode don't send status to MGS
			if (typeof debugSimulateCgi == "undefined") {
				this.sendStatus({ errorLog: message });
			}
		}
		this.burstErrorCount += 1;
	} else {
		this.burstErrorCount = 0;
		this.burstErrorTime = now;
		debug(message);
		// in local debug mode don't send status to MGS
		if (typeof debugSimulateCgi == "undefined") {
			this.sendStatus({ errorLog: message, errorLogTime: errorLogTime });
		}
	}
};

Program.prototype.traceLog = function(message)
{
	if (!signageTraceLogOn) { return; }

	var now = new Date();
	var traceLogTime = this.dateToRFC3339(now);
	this.setStatus('traceMessageLast', message);
	this.setStatus('traceMessageTime', traceLogTime);
	this.burstTraceLimit = 40;
	if ((now - this.burstTraceTime) < 20000) {     // time diff in milliseconds
		if (this.burstTraceCount <= this.burstTraceLimit) {
			if (this.burstTraceCount == this.burstTraceLimit) {
				message = "Signage player traces are happening too fast. Pausing logging for 20 seconds";
			}
			debug(message);
			this.sendStatus({traceLog: message});
		}
		this.burstTraceCount += 1;
	} else {
		this.burstTraceCount = 0;
		this.burstTraceTime = now;
		debug(message);
		this.sendStatus({traceLog: message, traceLogTime: traceLogTime});
	}
};

Program.prototype.playReport = function(file, start, stop, id, playlistName, programName)
{
	this.setStatus('playedFile',     file);
	this.setStatus('playedStart',    start);
	this.setStatus('playedEnd',      stop);
	this.setStatus('playedId',       id);
	this.setStatus('playedPlaylist', playlistName);
	this.setStatus('programName',    programName);

	// in local debug mode don't send status to MGS
	if (typeof debugSimulateCgi != "undefined")
		return;
	if ((stop - start) > 1800) {
		this.sendStatus({
			reportPlayed: '1'
			});
	}
};


//---------------------------------------------------
// Read and xml file parse it and put it in the DOM.
// This is done asynchronously. After the file has been read and parsed
// the callback function is called with the DOM xlm doc as a parameter.
function GetXmlDocAsync(url, callback)
{
	try {
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.myCallback = callback;
		xmlHttp.open("GET", url, true);
		xmlHttp.onreadystatechange = GetXmlDocAsyncReady;
		xmlHttp.send(null);
	} catch(err) {
		debug("ERR:'" + err + "' reading '" + url + "'");
		callback(null);
	}
}

function GetXmlDocAsyncReady()
{
	// wait for DONE state
	if (this.readyState != 4) {
		return;
	}
	if (this.myCallback) {
		this.myCallback(this.responseXML);
	}
}


//---------------------------------------------------
// signageAjax is used to get files using XMLHttpRequest
var signageAjaxUniqueCounter = 1;
function signageAjax(parameters)
{
	var xhr;

	try {
		var urlPlus = parameters.url;
		debug("signageAjax: url: " + urlPlus);
		if (! parameters.context) {
			parameters.context = parameters;
		}

		if (parameters.dataType == "jsonp") {
			var callBackName = "myTmpCallBack" + signageAjaxUniqueCounter;
			signageAjaxUniqueCounter += 1;
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
					myParam.success.call(myParam.context, data);
				}
				delete window.callBackName;
			};
			var script = document.createElement("script");
			script.src = urlPlus;
			document.body.appendChild(script);
		} else {
			xhr = new XMLHttpRequest();
			xhr.myParameters = parameters;
			var serializedData = null;
			if (parameters.data) {
				for (var key in parameters.data) {
					if (parameters.data.hasOwnProperty(key)) {
						var str = encodeURIComponent(key) + '=' + encodeURIComponent(parameters.data[key]);
						if (serializedData === null) {
							serializedData = str;
						} else {
							serializedData += '&' + str;
						}
					}
				}
			}

			if (parameters.type == undefined) {
				parameters.type = "GET";
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
					try {
						if (params && params.success) {
							var response = null;
							if (params.dataType == "json") {
								response = JSON.parse(this.responseText);
							} else if (params.dataType == "xml") {
								response = this.responseXML;
							} else {
								response = this.responseText;
							}
							if (params.error && (! response)) {
								params.error.call(params.context, this, "ERROR", "ERROR");
								return;
							}
							if (parameters.success) {
								params.success.call(params.context, response);
							}
						}
					} catch(err) {
						if (params.error) {
							params.error.call(params.context, xhr, "Exception in signageAjax parsing", "" + err);
						}
					}
				}
			};
			if (parameters.contentType == undefined) {
				parameters.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
			}
			xhr.setRequestHeader("Content-Type", parameters.contentType);
			xhr.send(serializedData);
		}

	} catch(err) {
		if (parameters.error) {
			parameters.error.call(parameters.context, xhr, "Exception in signageAjax", "" + err);
		}
	}
}

//---------------------------------------------------
// Log signage error messages. This can be called by
// signage layout components.
function SignageLogError(message)
{
	if (signageProgramObject) {
		signageProgramObject.errorLog(message);
	}
}

//---------------------------------------------------
// Log signage error messages. This can be called by
// signage layout components.
function SignageLogTrace(message)
{
	// in local debug mode just print trace without sending log to MGS
	if (typeof debugSimulateCgi != "undefined") {
		debug(message);
		return;
	}
	if (signageProgramObject) {
		signageProgramObject.traceLog(message);
	}
}

//---------------------------------------------------
// Change status information. This can be called by
// signage layout components.
function SignageSetStatus(name, value)
{
	if (signageProgramObject) {
		signageProgramObject.setStatus(name, value);
	}
}

//---------------------------------------------------
// StartMediaSignage does what it's name implies,
// it starts MediaSignage play lists.
function StartMediaSignage()
{
	if (! signageProgramObject) {
		signageProgramObject = new Program();
	}
}



