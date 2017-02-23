

BasicTransitionsNameList = 
new Array(
		  'dissolve', 'slideleft', 'slideright', 'slideup', 'slidedown', 
		  'zoomin', 'zoomout', 'scaleout', 'pop', 'drop', 
		  'spin', 'batspin', 'rolodex', 'fall', 'door' );

//---------------------------------------------------
function Transitions(div0, callBackObject)
{
	this.div0  = div0;
	this.callBackObject = callBackObject;
	this.list  = new Array;
	this.index = 0;
	
	var transitionNames = null;
	node = this.div0.attributes.getNamedItem("transition");
	if (node) {
		transitionNames = node.nodeValue;
	}
	
	this.duration = null;
	var node = this.div0.attributes.getNamedItem("transitionDuration");
	if (node) {
		this.duration = node.nodeValue;
	}
	if (this.duration == null) {
		this.duration = 1;
	}
	
	if (transitionNames != null) {
		var tranArray = transitionNames.replace(/^\s+|\s+$/g, '').split(/[\s,]+/g);
		var len1 = tranArray.length;
		for (var i = 0; i < len1; i++) {
			var tranName = tranArray[i].toLowerCase();
			var name = null;
			var len2 = BasicTransitionsNameList.length;
			for (var x = 0; x < len2; x++) {
				if (BasicTransitionsNameList[x] == tranName) {
					name = tranName;
					break;
				}
			}
			if (name != null) {
				this.list.push(new BasicTransition(this, name));
			}
		}
	} 
	if (this.list.length == 0) {
		this.list.push(new NoneTransition(this, 'none'));
		this.duration = 0.0;
	}
}

Transitions.prototype.start = function(outgoing, incoming)
{
	this.currentTransition = this.list[this.index];
	this.currentTransition.begin(outgoing, incoming);
	
	this.index += 1;
	if (this.index >= this.list.length) {
		this.index = 0;
	}
};

Transitions.prototype.checkAbort = function()
{
	if (this.currentTransition) {
		this.currentTransition.abort();
		this.currentTransition = null;
	}
};

//---------------------------------------------------
function NoneTransition(transition, transitionName)
{
	this.transition = transition;
	this.name = transitionName;
}

NoneTransition.prototype.begin = function(outgoing, incoming)
{
	var style = "position:absolute; top: 0%; left: 0%; width: 100%; height: 100%;";
	incoming.div.setAttribute('style', style);
	incoming.div.className = this.name + ' ' + 'display';
	outgoing.div.className = 'hide';
	this.transition.currentTransition = null;
	this.transition.callBackObject.transitionEnd(outgoing);
};

NoneTransition.prototype.abort = function()
{
};


//---------------------------------------------------
function BasicTransition(transition, transitionName)
{
	this.transition = transition;
	this.name       = transitionName;
	var self = this;
	this.callBeginAgain = function() { self.beginAgain(); };
	this.callEnd = function() { self.end(); };
	
	transition.div0.style.overflow = 'hidden';
}

BasicTransition.prototype.begin = function(outgoing, incoming)
{
	this.outgoing = outgoing;
	this.incoming = incoming;
	var style = "position:absolute; top: 0%; left: 0%; width: 100%; height: 100%; " +
	            "-webkit-transition-duration: " + this.transition.duration + "s; " +
	            "transition-duration: " + this.transition.duration + "s; " +
	            "-webkit-animation-duration: " + this.transition.duration + "s; " +
	            "animation-duration: " + this.transition.duration + "s;";

	incoming.div.setAttribute('style', style);
	
	incoming.div.className = this.name + ' ' + 'incoming';
	outgoing.div.className = this.name + ' ' + 'display';
	// delay to let things settle in before starting the transition.
	this.timerId = setTimeout(this.callBeginAgain, 100);
};

// After the begin style class has had a change to take effect
// put the transition in motion.
BasicTransition.prototype.beginAgain = function()
{
	this.incoming.div.className = this.name + ' ' + 'display';
	this.outgoing.div.className = this.name + ' ' + 'outgoing';
	this.timerId = setTimeout(this.callEnd, this.transition.duration * 1000);
};

BasicTransition.prototype.end = function()
{
	this.timerId = null;
	this.outgoing.div.className = "hide";
	this.transition.currentTransition = null;
	this.transition.callBackObject.transitionEnd(this.outgoing);
};

BasicTransition.prototype.abort = function()
{
	if (this.timerId) {
		clearTimeout(this.timerId);
		this.timerId = null;
	}
	this.end();
};



