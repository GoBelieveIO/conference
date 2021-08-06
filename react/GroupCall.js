
import React, {Component } from 'react';
import PropTypes from 'prop-types';
import {
    View,
    Text,
    TouchableHighlight,
    Platform,
    Dimensions,
} from 'react-native';

import {
    NativeModules,
    BackHandler
} from 'react-native';

import RoomClient, {
	ROOM_STATE_EVENT, 
	NEW_PEER_EVENT, 
	PEER_CLOSED_EVENT, 
	ADD_PRODUCER_EVENT, 
	REMOVE_PRODUCER_EVENT,
	PRODUCER_PAUSED_EVENT,
	PRODUCER_RESUMED_EVENT,
	REPLACE_PRODUCER_TRACK_EVENT,
	ADD_CONSUMER_EVENT,
	CONSUMER_CLOSED_EVENT,
	CONSUMER_PAUSED_EVENT,
	ACTIVE_SPEAKER_EVENT,
	CONSUMER_RESUMED_EVENT
} from "./RoomClient";

import randomName from './randomName';
import {RTCView} from 'react-native-webrtc';

import {request, check, PERMISSIONS, RESULTS} from 'react-native-permissions';

var native = (Platform.OS == 'android') ?
             NativeModules.GroupVOIPActivity :
             NativeModules.GroupVOIPViewController;

var ScreenWidth = Dimensions.get('window').width;

const WS_URL = 'ws://192.168.1.101:4444/';
function getProtooUrl({ roomId, peerId }) {
	return `${WS_URL}?roomId=${roomId}&peerId=${peerId}`;
}

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

        this.onRoomState = this.onRoomState.bind(this);
		this.onNewPeer = this.onNewPeer.bind(this);
		this.onPeerClosed = this.onPeerClosed.bind(this);
		this.onAddProducer = this.onAddProducer.bind(this);
		this.onRemoveProducer = this.onRemoveProducer.bind(this);
		this.onReplaceProducerTrack = this.onReplaceProducerTrack.bind(this);
		this.onAddConsumer = this.onAddConsumer.bind(this);
		this.onConsumerClosed = this.onConsumerClosed.bind(this);
		this.onConsumerPaused = this.onConsumerPaused.bind(this);
		this.onConsumerResumed = this.onConsumerResumed.bind(this);

        
        console.log(typeof(this.props.room), typeof(this.props.name));

        this.name = this.props.name;
        this.room = this.props.room;
        this.token = this.props.token;
        
        this.connectFailCount = 0;
        this.closeTimestamp = 0;
        
        console.log("name:", this.name, " room:", this.room, " token:", this.token);

        console.log("navigator:", navigator, navigator.userAgent);
        const displayName = randomName(); 

        const device = {
            flag : 'rn',
            name    : "rn",
            version : '0.64.0'
        };

        const useSimulcast = false;
        const useSharingSimulcast = false;
        const forceTcp = false;
        const produce = true;
        const consume = true;
        const forceH264 = false;
        const forceVP9 = false;
        const svc = undefined;
        const datachannel = false;
        const externalVideo = false;
        const e2eKey = undefined;
        const hack = false;
		const protooUrl = getProtooUrl({ roomId:this.props.room, peerId:this.props.name });

		console.log("protoo url:", protooUrl);

        const roomClient = new RoomClient({
            roomId: this.props.room,
            peerId: this.props.name,
            displayName,
            device,
            protooUrl,
            handlerName: undefined,
            useSimulcast,
            useSharingSimulcast,
            forceTcp,
            produce,
            consume,
            forceH264,
            forceVP9,
            svc,
            datachannel,
            externalVideo,
            e2eKey,
            hack
        });

        this.state = {
            roomClient: roomClient,
            producers : [],
			peers     : [],

            audioMuted: false,
            videoMuted: false,
            duration: 0
        };
    }

    
    componentDidMount() {
        const roomClient = this.state.roomClient;
        roomClient.on(ROOM_STATE_EVENT, this.onRoomState);
		roomClient.on(NEW_PEER_EVENT, this.onNewPeer);
		roomClient.on(PEER_CLOSED_EVENT, this.onPeerClosed);
		roomClient.on(ADD_PRODUCER_EVENT, this.onAddProducer);
		roomClient.on(REMOVE_PRODUCER_EVENT, this.onRemoveProducer);
		roomClient.on(REPLACE_PRODUCER_TRACK_EVENT, this.onReplaceProducerTrack);
		roomClient.on(ADD_CONSUMER_EVENT, this.onAddConsumer);
		roomClient.on(CONSUMER_CLOSED_EVENT, this.onConsumerClosed);
		roomClient.on(CONSUMER_PAUSED_EVENT, this.onConsumerPaused);
		roomClient.on(CONSUMER_RESUMED_EVENT, this.onConsumerResumed);

         
        BackHandler.addEventListener('hardwareBackPress', this._handleBack);
        const camera = Platform.OS == "android"  ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA;
        const microphone = Platform.OS == "android"  ? PERMISSIONS.ANDROID.RECORD_AUDIO : PERMISSIONS.IOS.MICROPHONE;
        Promise.resolve()
               .then(() => this.requestPermission(camera))
               .then(() => this.requestPermission(microphone))
               .then(() => {
                   roomClient.join();
               }, (err) => {
                   console.log("request permission err:", err);
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

        BackHandler.removeEventListener('hardwareBackPress', this._handleBack)

        this.state.roomClient.close();
    }

    requestPermission(permission) {
        return check(permission)
            .then((result) => {
                switch (result) {
                    case RESULTS.GRANTED:
                        return result;
                    default:
                        return request(permission);
                }
            })
            .then((result) => {
                if (result == RESULTS.GRANTED) {
                    return result;
                } else {
                    throw result;
                }
            });
    }


    onRoomState(state) 
	{
		console.log("room state:", state);

		if (state == 'closed') 
		{
			this.setState({ peers:[], producers:[] });
		}
	}

	onNewPeer(peer) 
	{
		console.log("new peer:", peer);

		const old = this.state.peers.find(function(p) 
		{
			return (p.id == peer.id);
		});

		if (old) 
		{
			return;
		}

		this.state.peers.push(peer);
		this.setState({});
	}

	onPeerClosed(peerId) 
	{
		console.log("peer closed:", peerId);
		const index = this.state.peers.findIndex(function(p) 
		{
			return (p.id == peerId);
		});

		if (index == -1)
		{
			return;
		}

		this.state.peers.splice(index, 1);
		this.setState({});
	}

	onAddProducer(producer) 
	{
		console.log("add producer:", producer);
        if (producer.track.kind == "video") {
            const stream = new MediaStream();
            stream.addTrack(producer.track);
            producer.stream = stream;
        }
		this.state.producers.push(producer);
		this.setState({});
	}

	onRemoveProducer(producerId) 
	{
		console.log("remove producer:", producerId);

		const index = this.state.producers.findIndex(function(p) 
		{
			return p.id == producerId;
		});

		if (index == -1) 
		{
			return -1;
		}

		this.state.producers.splice(index, 1);
		this.setState({});
	}

	onReplaceProducerTrack(producerId, track) 
	{
		console.log("replace producer track", producerId, track);

		const index = this.state.producers.findIndex(function(p) 
		{
			return p.id == producerId;
		});

		if (index == -1) 
		{
			return -1;
		}

		const producer = this.state.producers[index];

		producer.track = track;
		this.setState({});
	}

	onAddConsumer(consumer, peerId) 
	{
		console.log("on add consumer:", consumer, peerId);

		const peer = this.state.peers.find(function(p)
		{
			return (p.id == peerId);
		});

		if (!peer) 
		{
			return;
		}

        if (consumer.track.kind == "video" ) {
            var stream = new MediaStream();
            stream.addTrack(consumer.track);
            consumer.stream = stream;
        }

		peer.consumers.push(consumer);
		this.setState({});
	}

	onConsumerClosed(consumerId, peerId) 
	{
		console.log("on consumer closed:", consumerId);

		const peer = this.state.peers.find(function(p)
		{
			return (p.id == peerId);
		});

		if (!peer) 
		{
			return;
		}

		const index = peer.consumers.findIndex(function(c) 
		{
			return (c.id == consumerId);
		});

		if (index == -1) 
		{
			return;
		}

		peer.consumers.splice(index, 1);
		this.setState({});
	}

	onConsumerPaused(consumerId, peerId, originator) 
	{
		console.log("on consumer paused:", consumerId, originator);

		const peer = this.state.peers.find(function(p)
		{
			return (p.id == peerId);
		});

		if (!peer) 
		{
			return;
		}

		const index = peer.consumers.findIndex(function(c) 
		{
			return (c.id == consumerId);
		});

		if (index == -1) 
		{
			return;
		}

		peer.consumers[index].paused = true;
		this.setState({});
	}

	onConsumerResumed(consumerId, peerId, originator) 
	{
		console.log("on consumer resumed:", consumerId, originator);

		const peer = this.state.peers.find(function(p)
		{
			return (p.id == peerId);
		});

		if (!peer) 
		{
			return;
		}

		const index = peer.consumers.findIndex(function(c) 
		{
			return (c.id == consumerId);
		});

		if (index == -1) 
		{
			return;
		}

		peer.consumers[index].paused = false;
		this.setState({});
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

 
    _toggleAudio() {
        if (this.state.roomClient.state != "connected") {
            return;
        }

        console.log("toggle audio");

        var audioMuted = !this.state.audioMuted;
        if (audioMuted) {
            this.state.roomClient.muteMic();
        } else {
            this.state.roomClient.unmuteMic();
        }
        this.setState({audioMuted:audioMuted});
    }

    _toggleVideo() {
        if (this.state.roomClient.state != "connected") {
            return;
        }

        console.log("toggle video");

        var videoMuted = !this.state.videoMuted;

        if (videoMuted) {
            this.state.roomClient.disableWebcam();
        } else {
            this.state.roomClient.enableWebcam();
        }
        this.setState({videoMuted:videoMuted})
    }
    
    _handleBack() {
        console.log("hangup...");
        this.finished = true;
        this.leaveRoom();
        native.dismiss();
        return false;
    }

    leaveRoom() {
        this.state.roomClient.close();
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
     render() {

        const audioProducer = this.state.producers.find(function(p)
		{
			return p.track.kind == "audio";
		});

		const videoProducer = this.state.producers.find(function(p)
		{
			return p.track.kind == "video";
		});


        var videoMuted = this.state.videoMuted;
        var audioMuted = this.state.audioMuted;

        var duration = this.formatDuration(this.state.duration);

        var remoteViews = [];
        var h = ScreenWidth*0.5;
        var w = ScreenWidth*0.5;

        var participants = [];
        if (videoProducer && videoProducer.stream) {
            participants.push({id:this.name, stream:videoProducer.stream});
        } else {
            participants.push({id:this.name});
        }

        this.state.peers.forEach((peer) => {
            const consumersArray = peer.consumers;
            const videoConsumer =
                consumersArray.find((consumer) => consumer.track.kind === 'video');
            if (videoConsumer && videoConsumer.stream) {
                participants.push({id:peer.id, stream:videoConsumer.stream});
            } else {
                participants.push({id:peer.id});
            }
        });
        
        for (var i = 0; i < participants.length; i+= 2) {
            if (i + 1 < participants.length) {
                var participant1 = participants[i];
                var participant2 = participants[i+1];
                var videoURL1 = participant1.stream ? participant1.stream.toURL() : undefined;
                var videoURL2 = participant2.stream ? participant2.stream.toURL() : undefined;
                remoteViews.push((
                    <View style={{height:h, flex:1, flexDirection:"row"}} key={participant1.id} >
                        <RTCView style={{height:h, width:w}} 
                            objectFit="cover" 
                            mirror={participant1.id==this.props.name}  
                            streamURL={videoURL1}/>
                        <RTCView style={{height:h, width:w}} 
                            objectFit="cover"     
                            mirror={participant2.id==this.props.name}  
                            streamURL={videoURL2}/>
                    </View>
                ));
            } else {
                var participant = participants[i];
                var videoURL = participant.stream ? participant.stream.toURL() : undefined;
                remoteViews.push((
                    <View style={{height:h, flex:1, flexDirection:"row", justifyContent:"center"}} key={participant.id}>
                        <RTCView style={{height:h, width:w}} 
                            objectFit="cover" 
                            mirror={participant.id==this.props.name} 
                            streamURL={videoURL}/>
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
                                                       paddingLeft:16,
                                                       paddingRight:16,   
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
                                                paddingLeft:16,
                                                paddingRight:16,                                               
                                                backgroundColor:"red",
                                                justifyContent: 'center'
                                            }}
                                            underlayColor="crimson" >
                            <Text>挂断</Text>
                        </TouchableHighlight>
                        
                        <TouchableHighlight onPress={this._toggleVideo}
                                            style = {{borderRadius: 35,
                                                      paddingLeft:16,
                                                      paddingRight:16,                     
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
}

GroupCall.propTypes = {
    name: PropTypes.string.isRequired,
    room: PropTypes.string.isRequired,
    token: PropTypes.string.isRequired,
}
export default GroupCall;



