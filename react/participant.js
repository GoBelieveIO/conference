/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

function Participant(name, sendMessage) {
    console.log("participant name:", name);
    this.name = name;
    
    this.offerToReceiveVideo = function(error, offerSdp, wp){
	if (error) return console.error ("sdp offer error")
	console.log('Invoking SDP offer callback function');
	var msg =  { id : "receiveVideoFrom",
		     sender : name,
		     sdpOffer : offerSdp
	};
	sendMessage(msg);
    }


    this.onIceCandidate = function (candidate, wp) {
	console.log("Local candidate" + JSON.stringify(candidate));

	var message = {
	    id: 'onIceCandidate',
	    candidate: candidate,
	    name: name
	};
	sendMessage(message);
    }

    Object.defineProperty(this, 'rtcPeer', { writable: true});

    this.dispose = function() {
	console.log('Disposing participant ' + this.name);
	this.rtcPeer.dispose();
    };
}

module.exports = Participant;
