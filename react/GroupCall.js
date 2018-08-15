
import React, { Component } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableHighlight,
    Image,
    Platform,
    Dimensions,
    StyleSheet    
} from 'react-native';

import {
    NativeModules,
    NativeAppEventEmitter,
    BackAndroid
} from 'react-native';

import {RTCView} from 'react-native-webrtc';

import Permissions from 'react-native-permissions';
var native = (Platform.OS == 'android') ?
             NativeModules.GroupVOIPActivity :
             NativeModules.GroupVOIPViewController;


var Participant = require('./participant.js');

var WebRtcPeer = require('./WebRtcPeer.js');

var ScreenWidth = Dimensions.get('window').width;

const WS_URL = 'wss://jitsi.gobelieve.io/groupcall';

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
        this._toggleAudio = this._toggleAudio.bind(this);
        this._toggleVideo = this._toggleVideo.bind(this);
        
        this.onmessage = this.onmessage.bind(this);
        this.ping = this.ping.bind(this);
        
        this.state = {
            participants:[],
            audioMuted:false,
            videoMuted:true,
            duration:0
        };
        
        this.name = this.props.name;
        this.room = this.props.room;
        this.token = this.props.token;
        
        this.connectFailCount = 0;
        this.closeTimestamp = 0;
        
        console.log("name:", this.name, " room:", this.room, " token:", this.token);
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
                this.onIceCandidate(parsedMessage);
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
                   this.pingTimer = setInterval(this.ping, 1000);
                   this.connect();
               });
    }

    
    componentDidMount() {
        
    }

    requestPermission(permission) {
        return Permissions.check(permission)
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
                          .then(() => Permissions.request(permission))
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
                          })
                          .catch((err) => {
                              console.log("request permission:", permission, " err:", err);
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

    formatDuration(duration) {
        //00:00
        var m = Math.floor(duration/60);
        var s = duration%60;

        var t = ""
        if (m >= 10) {
            t += m;
        } else {
            t += "0" + m;
        }
        t += ":";
        if (s >= 10) {
            t += s;
        } else {
            t += "0" + s;
        }
        return t;
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        var videoMuted = this.state.videoMuted;
        var audioMuted = this.state.audioMuted;

        var duration = this.formatDuration(this.state.duration);

        
        var remoteViews = [];
        participants = this.state.participants;
        console.log("participants:", participants.length);

        var h = ScreenWidth*0.5;
        var w = ScreenWidth*0.5;
        for (var i = 0; i < participants.length; i+= 2) {
            if (i + 1 < participants.length) {
                var participant1 = participants[i];
                var participant2 = participants[i+1];
                var videoURL1 = participant1.videoURL;
                var videoURL2 = participant2.videoURL;
                remoteViews.push((
                    <View style={{height:h, flex:1, flexDirection:"row"}} key={i} >
                        <RTCView style={{height:h, width:w}} objectFit="cover" streamURL={videoURL1}/>
                        <RTCView style={{height:h, width:w}} objectFit="cover" streamURL={videoURL2}/>
                    </View>
                ));
            } else {
                var participant = participants[i];
                var videoURL = participant.videoURL;
                
                remoteViews.push((
                    <View style={{height:h, flex:1, flexDirection:"row", justifyContent:"center"}} key={i}>
                        <RTCView style={{height:h, width:w}} objectFit="cover" streamURL={videoURL}/>
                    </View>
                ))
            }
        }

        return (
            <View style={{flex:1, backgroundColor:'rgb(36,37,42)'}}>
                <View style={{flex:0.7}}>
                    { remoteViews }
                </View>
                <View style={{flex:0.3, flexDirection:"column", alignItems:"center"}}>
                    <Text style={{color:"white", fontSize:20}}>
                        {duration}
                    </Text>
                    
                
                    <View style={{height:40,
                                  width:"100%",
                                  marginTop:40,
                                  flexDirection:"row",
                                  justifyContent:"space-around"}}>
                        
                        <TouchableHighlight onPress={this._toggleAudio}
                                            style = {{ borderRadius: 35,
                                                       padding:16,
                                                       backgroundColor:"white",
                                                       justifyContent: 'center'}}
                                            underlayColor="aliceblue">
                            <View>
                                <Text>静音</Text>
                                {audioMuted ? 
                                 <View style={{top:-8,
                                               height:1,
                                               backgroundColor:"black",
                                               transform: [{ rotate: '25deg'}]}}/> :
                                 null}
                            </View>
                        </TouchableHighlight>

                        
                        <TouchableHighlight onPress={this._handleBack}
                                            style = {{
                                                borderRadius: 35,
                                                padding:16,                                                
                                                backgroundColor:"red",
                                                justifyContent: 'center'
                                            }}
                                            underlayColor="crimson" >
                            <Text>挂断</Text>
                        </TouchableHighlight>
                        
                        <TouchableHighlight onPress={this._toggleVideo}
                                            style = {{borderRadius: 35,
                                                      padding:16,                         
                                                      backgroundColor:"white", 
                                                      justifyContent: 'center'}}
                                            underlayColor="aliceblue">
                            <Text>{videoMuted ? "打开摄像头" : "关闭摄像头" }</Text>
                        </TouchableHighlight>

                    </View>
                </View>
            </View>
        );
    }
 
    _toggleAudio() {
        console.log("toggle audio");
        var name = this.name;
        var participants = this.state.participants;
        var participant = participants.find(function(p) {
            return p.name == name;
        });

        if (!participant) {
            return;
        }
        
        var audioMuted = !this.state.audioMuted;
        participant.rtcPeer.audioEnabled = !audioMuted;
        
        this.setState({audioMuted:audioMuted});
    }

    _toggleVideo() {
        console.log("toggle video");
        var name = this.name;
        var participants = this.state.participants;
        var participant = participants.find(function(p) {
            return p.name == name;
        });

        if (!participant) {
            return;
        }
        
        var videoMuted = !this.state.videoMuted;
        participant.rtcPeer.videoEnabled = !videoMuted;
        this.setState({videoMuted:videoMuted})
    }
    
    _handleBack() {
        console.log("hangup...");
        this.finished = true;
        this.leaveRoom();
        native.dismiss();
        return false;
    }

    connect() {
        var ws = new WebSocket(WS_URL);
        var self = this;
        this.ws = ws;                   
        this.ws.onmessage = this.onmessage;
        this.ws.onclose = function(e) {
            console.log("websockets on close:", e.code, e.reason, e.wasClean);
            self.connectFailCount += 1;
            var now = new Date().getTime()
            self.closeTimestamp = Math.floor(now/1000);

            self.state.participants.forEach((p) => {
                p.dispose();
            })

            self.setState({participants:[]});
        }
        
        this.ws.onerror = function() {
            console.log("websockets on error");
        }
        
        this.ws.onopen = function() {
            console.log("websockets on open");
            this.connectFailCount = 0;
            self.register();
        };        
    }
    
    register() {
        var message = {
	    id : 'joinRoom',
	    name : this.name,
	    room : this.room,
            token: this.token,
        }
        this.sendMessage(message);
    }

    ping() {
        //更新通话时间
        var duration = this.state.duration;
        duration += 1;
       
        this.setState({duration:duration});

        //检查链接是否断开
        if (!this.ws || this.ws.readyState == WebSocket.CLOSED) {
            var now = new Date().getTime();
            now = Math.floor(now/1000);

            //失败次数越多，重连间隔的时间越长
            if (now - this.closeTimestamp > this.connectFailCount ||
                now - this.closeTimestamp > 60) {
                this.connect();                
            }
            return;
        }

        if (duration%10 == 0) {
            //10s发一次ping
            var message = {
	        id : 'ping'
            }
            this.sendMessage(message);              
        }
    }

    onIceCandidate(request) {
        var participants = this.state.participants;
        var participant = participants.find(function(p) {
            return p.name == request.name
        });

        if (!participant) {
            return;
        }
        
        participant.rtcPeer.addIceCandidate(request.candidate, function (error) {
	    if (error) {
		console.error("Error adding candidate: " + error);
		return;
	    } else {
                console.log("add icecandidate success");
            }
	});        
    }
    
    onNewParticipant(request) {
        console.log("on new participant:", request.name);
        this.receiveVideo(request.name);
    }

    receiveVideoResponse(result) {
        var participants = this.state.participants;
        var participant = participants.find(function(p) {
            return p.name == result.name
        });

        if (!participant) {
            return;
        }
        participant.rtcPeer.processAnswer (result.sdpAnswer, function (error) {
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
        var participants = this.state.participants;
        participants.push(participant);
	
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
	    console.log("on local stream:", stream.toURL());
            participant.videoURL = stream.toURL();

            if (self.state.videoMuted) {
                console.log("disable video");
                participant.rtcPeer.videoEnabled = false;
            }

            if (self.state.audioMuted) {
                console.log("disable audio");
                participant.rtcPeer.audioEnabled = false;
            }

            self.forceUpdate();            
	});

        this.setState({participants:participants});
        
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

        this.state.participants.forEach((p) => {
            p.dispose();
        })

        this.setState({participants:[]});

        if (this.ws) {
            this.ws.close();
        }
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = 0;
        }
    }

    receiveVideo(sender) {
        var participants = this.state.participants;
        var participant = participants.find(function(p) {
            p.name == sender;
        });

        if (participant) {
            console.log("participant:", sender, " exists");
            return;
        }

        
        participant = new Participant(sender, this.sendMessage.bind(this));
        participants.push(participant);

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
            participant.videoURL = stream.toURL();
            this.forceUpdate();
        });
        this.setState({participants:participants});
    }

    onParticipantLeft(request) {
        console.log('Participant ' + request.name + ' left');

        var participants = this.state.participants;
        var index = participants.findIndex(function(p) {
            return p.name == request.name
        });

        if (!index == -1) {
            return;
        }
        
        var participant = participants[index];
        participant.dispose();
        participants.splice(index, 1);
        this.setState({participants:participants});
    }

    sendMessage(message) {
        if (!this.ws || this.ws.readyState != WebSocket.OPEN) {
            return;
        }
        
        var jsonMessage = JSON.stringify(message);
        console.log('Senging message: ' + jsonMessage);
        this.ws.send(jsonMessage);
    }
}


export default GroupCall;



