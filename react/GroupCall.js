
import React, { Component } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableHighlight,
    Image,
    Platform
} from 'react-native';

import {
    NativeModules,
    NativeAppEventEmitter,
    BackAndroid
} from 'react-native';

import {RTCView} from 'react-native-webrtc';

import Permissions from 'react-native-permissions';

var Sound = require('react-native-sound');

var Participant = require('./participant.js');

var WebRtcPeer = require('./WebRtcPeer.js');

/**
 * The groupvoip page of the application.
 */
class GroupCall extends Component {

    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);


        this._handleBack = this._handleBack.bind(this);
        this.onmessage = this.onmessage.bind(this);
        this.ping = this.ping.bind(this);
        
        this.state = {};
    
        this.name = "testios";
        this.room = "1001";
        this.participants = {};
    }


    onmessage(message) {
        var parsedMessage = JSON.parse(message.data);
        console.info('Received message: ' + message.data);

        switch (parsedMessage.id) {
	    case 'existingParticipants':
	        this.onExistingParticipants(parsedMessage);
	        break;
	    case 'newParticipantArrived':
	        this.onNewParticipant(parsedMessage);
	        break;
	    case 'participantLeft':
	        this.onParticipantLeft(parsedMessage);
	        break;
	    case 'receiveVideoAnswer':
	        this.receiveVideoResponse(parsedMessage);
	        break;
	    case 'iceCandidate':
	        this.participants[parsedMessage.name].rtcPeer.addIceCandidate(parsedMessage.candidate, function (error) {
	            if (error) {
		        console.error("Error adding candidate: " + error);
		        return;
	            } else {
                        console.log("add icecandidate success");
                    }
	        });
	        break;
	    default:
	        console.error('Unrecognized message', parsedMessage);
        }
        
    }

    /**
     * Inits new connection and conference when conference screen is entered.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentWillMount() {

        this.subscription = NativeAppEventEmitter.addListener(
            'onRemoteRefuse',
            (event) => {
                console.log("on remote refuse");
                this._onCancel();
            }
        );


        
        BackAndroid.addEventListener('hardwareBackPress', this._handleBack);
        Promise.resolve()
               .then(() => this.requestPermission('camera'))
               .then(() => this.requestPermission('microphone'))
               .then(() => {
                   var ws = new WebSocket('wss://' + "112.74.207.185:8443" + '/groupcall');
                   var participants = {};
                   var name;

                   var self = this;
                   this.ws = ws;                   
                   this.ws.onmessage = this.onmessage;
                   this.ws.onclose = function(e) {
                       console.log("websockets on close:", e.code, e.reason, e.wasClean);
                   }
                   this.ws.onerror = function() {
                       console.log("websockets on error");
                   }
                   
                   this.ws.onopen = function() {
                       console.log("websockets on open");
                       self.register();

                       self.pingTimer = setInterval(self.ping, 1000*10);
                   };
               });
    }

  
    componentDidMount() {
        
    }

    
    requestPermission(permission) {
        return Permissions.getPermissionStatus(permission)
                          .then(response => {
                              console.log("permission:" + permission + " " + response);
                              if (response == 'authorized') {
                                  
                              } else if (response == 'undetermined') {
                                  return response;
                              } else if (response == 'denied' || 
                                         response == 'restricted') {
                                  throw response;
                              }
                          })
                          .then(() => Permissions.requestPermission(permission))
                          .then((response) => {
                              console.log("permission:" + permission + " " + response);
                              if (response == 'authorized') {
                                  return response;
                              } else if (response == 'undetermined') {
                                  throw response;
                              } else if (response == 'denied' || 
                                         response == 'restricted') {
                                  throw response;
                              }                               
                          });        
    }


    /**
     * Destroys connection, conference and local tracks when conference screen
     * is left. Clears {@link #_toolbarTimeout} before the component unmounts.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentWillUnmount() {
        console.log("conference component will unmount");

        this.subscription.remove();

        BackAndroid.removeEventListener('hardwareBackPress', this._handleBack)

    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        console.log("local video url:", this.state.localVideoURL);
        console.log("remote video url:", this.state.remoteVideoURL);
        //var videoURL = this.state.remoteVideoURL || this.state.localVideoURL;
        //console.log("render video url:", videoURL);
      
        return (
            <View style={{flex:1}}>
                <RTCView style={{flex:1}} streamURL={this.state.localVideoURL}/>
                {this.state.remoteVideoURL ? <RTCView style={{flex:1}} streamURL={this.state.remoteVideoURL}/> : null}
            </View>
        );
    }
    
    
    _handleBack() {
        this.leaveRoom();
        return false;
    }

    register() {
        var message = {
	    id : 'joinRoom',
	    name : this.name,
	    room : this.room,
        }
        this.sendMessage(message);
    }

    ping() {
        var message = {
	    id : 'ping'
        }
        this.sendMessage(message);        
    }    

    onNewParticipant(request) {
        console.log("on new participant:", request.name);
        this.receiveVideo(request.name);
    }

    receiveVideoResponse(result) {
        this.participants[result.name].rtcPeer.processAnswer (result.sdpAnswer, function (error) {
	    if (error) return console.error (error);
        });
    }


    onExistingParticipants(msg) {
        var constraints = {
	    audio : true,
	    video : {
                facingMode: "user",                
	        mandatory : {
		    maxFrameRate : 15,
		    minFrameRate : 15
	        }
	    }
        };
        console.log(this.name + " registered in room " + this.room);
        
        var participant = new Participant(this.name, this.sendMessage.bind(this));
	this.participants[this.name] = participant;
	 
	var options = {
	    mediaConstraints: constraints,
	    onicecandidate: participant.onIceCandidate.bind(participant)
	}
	participant.rtcPeer = new WebRtcPeer.WebRtcPeerSendonly(options,
								function (error) {
								    if(error) {
									return console.error(error);
								    }
								    this.generateOffer (participant.offerToReceiveVideo.bind(participant));
								});
	 
	var self = this;
	participant.rtcPeer.on('localstream', function(stream) {
	    console.log("on local stream:", stream, stream.toURL());
	    self.setState({localVideoURL:stream.toURL()});
	});

        var data = msg.data.slice();
	data.forEach((p) => {
	    this.receiveVideo(p);		 
	})

    }

    leaveRoom() {
        console.log("leave room");
        this.sendMessage({
	    id : 'leaveRoom'
        });

        for ( var key in this.participants) {
	    this.participants[key].dispose();
        }


        this.ws.close();
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = 0;
        }
    }

    receiveVideo(sender) {
        var participant = new Participant(sender, this.sendMessage.bind(this));
        this.participants[sender] = participant;

        var options = {
            onicecandidate: participant.onIceCandidate.bind(participant)
        }

        participant.rtcPeer = new WebRtcPeer.WebRtcPeerRecvonly(options,
			                                        function (error) {
			                                            if(error) {
				                                        return console.error(error);
			                                            }
			                                            this.generateOffer (participant.offerToReceiveVideo.bind(participant));
	                                                        });
        participant.rtcPeer.on('remotestream', (stream) => {
            console.log("remote video url:", stream.toURL());
            this.setState({remoteVideoURL:stream.toURL()});
        });
    }

    onParticipantLeft(request) {
        console.log('Participant ' + request.name + ' left');
        var participant = this.participants[request.name];
        participant.dispose();
        delete this.participants[request.name];
        this.setState({remoteVideoURL:undefined});
    }


    sendMessage(message) {
        var jsonMessage = JSON.stringify(message);
        console.log('Senging message: ' + jsonMessage);
        this.ws.send(jsonMessage);
    }
}

export default GroupCall;



