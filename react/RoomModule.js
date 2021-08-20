import {
    Platform,
    NativeModules,
    DeviceEventEmitter,
    NativeEventEmitter,
    NativeAppEventEmitter
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

var native = NativeModules.RoomModule;
var Emitter;
if (Platform.OS === 'android') {
    Emitter = DeviceEventEmitter;
} else {
    Emitter = new NativeEventEmitter(native);
}
//? DeviceEventEmitter : NativeAppEventEmitter;



const WS_URL = 'ws://192.168.1.101:4444/';
function getProtooUrl({ roomId, peerId }) {
	return `${WS_URL}?roomId=${roomId}&peerId=${peerId}`;
}

export default class RoomModule {
    constructor() {
        this._roomClient = undefined;
        this._streams = new Map();

        this.onRoomState = this.onRoomState.bind(this);
		this.onNewPeer = this.onNewPeer.bind(this);
		this.onPeerClosed = this.onPeerClosed.bind(this);
		this.onAddProducer = this.onAddProducer.bind(this);
		this.onRemoveProducer = this.onRemoveProducer.bind(this);
        this.onProducerPaused = this.onProducerPaused.bind(this);
		this.onProducerResumed = this.onProducerResumed.bind(this);
		this.onReplaceProducerTrack = this.onReplaceProducerTrack.bind(this);
		this.onAddConsumer = this.onAddConsumer.bind(this);
		this.onConsumerClosed = this.onConsumerClosed.bind(this);
		this.onConsumerPaused = this.onConsumerPaused.bind(this);
		this.onConsumerResumed = this.onConsumerResumed.bind(this);

        Emitter.addListener("join_room", (options) => {
            this.joinRoom(options);
        });

        Emitter.addListener("leave_room", ({roomId}) => {
            console.log("leave room:", roomId);
            this.closeRoomClient();
        });

        Emitter.addListener("switch_camera", () => {
            console.log("switch camera");
            if (this._roomClient) {
                this._roomClient.switchCamera();
            }
        });

        Emitter.addListener("toggle_audio", ({audioMuted}) => {
            console.log("toggle audio:", audioMuted);
            if (this._roomClient) {
                if (audioMuted) {
                    this._roomClient.muteMic();
                } else {
                    this._roomClient.unmuteMic();
                }
            }
        });

        Emitter.addListener("toggle_video", ({videoMuted}) => {
            console.log("toggle video:", videoMuted);
            if (this._roomClient) {
                if (videoMuted) {
                    this._roomClient.disableWebcam();
                } else {
                    this._roomClient.enableWebcam();
                }
            }
        });
    }

    joinRoom({roomId,peerId,displayName}) {
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
        const protooUrl = getProtooUrl({ roomId, peerId });

        const options = {
            roomId: ""+roomId,
            peerId: ""+peerId,
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
        };

        this.createRoomClient(options);

        console.log("join room:", roomId, peerId);
        this._roomClient.join();
    }

    createRoomClient(options) {
        if (this._roomClient) {
            throw "can't create two room client";
        }
        console.log("create room client:", options);
        const roomClient = new RoomClient(options);

        roomClient.on(ROOM_STATE_EVENT, this.onRoomState);
		roomClient.on(NEW_PEER_EVENT, this.onNewPeer);
		roomClient.on(PEER_CLOSED_EVENT, this.onPeerClosed);
		roomClient.on(ADD_PRODUCER_EVENT, this.onAddProducer);
		roomClient.on(REMOVE_PRODUCER_EVENT, this.onRemoveProducer);
        roomClient.on(PRODUCER_PAUSED_EVENT, this.onProducerPaused);
		roomClient.on(PRODUCER_RESUMED_EVENT, this.onProducerResumed);
		roomClient.on(REPLACE_PRODUCER_TRACK_EVENT, this.onReplaceProducerTrack);
		roomClient.on(ADD_CONSUMER_EVENT, this.onAddConsumer);
		roomClient.on(CONSUMER_CLOSED_EVENT, this.onConsumerClosed);
		roomClient.on(CONSUMER_PAUSED_EVENT, this.onConsumerPaused);
		roomClient.on(CONSUMER_RESUMED_EVENT, this.onConsumerResumed);

        this._roomClient = roomClient;
    }

    closeRoomClient() {
        this._streams.forEach((stream) => {
            stream.release(false);
        })
        this._streams.clear();

        if (this._roomClient) {
            console.log("close room client");
            this._roomClient.close();
            this._roomClient = null;
        }
    }

    onRoomState(state) 
	{
		console.log("room state:", state);
        native.postRoomState(state);
	}

	onNewPeer(peer) 
	{
		console.log("new peer:", peer);
        native.postNewPeer(peer);
	}

	onPeerClosed(peerId) 
	{
		console.log("peer closed:", peerId);
        native.postPeerClosed(peerId);
	}

	onAddProducer(producer) 
	{
        const {
            id,          
            deviceLabel,
            type,
            paused,       
            track,        
            rtpParameters,
            codec         
        } = producer;

        var streamURL;
        if (track.kind == "video") {
            const stream = new MediaStream();
            stream.addTrack(track);
            streamURL = stream.toURL();
            this._streams.set(stream.id, stream);
        }
		console.log("add producer:", producer);
        //todo
        native.postAddProducer({
            id,
            deviceLabel,
            type,
            paused,
            streamURL,
            kind:track.kind,
            rtpParameters,
            codec
        });
	}

	onRemoveProducer(producerId) 
	{
		console.log("remove producer:", producerId);
        native.postRemoveProducer(producerId);
	}

    onProducerPaused(producerId) 
	{
		console.log("on producer paused:", producerId);
	}

	onProducerResumed(producerId)
    {
		console.log("on producer resumed:", producerId);
    }

	onReplaceProducerTrack(producerId, track) 
	{
		console.log("replace producer track", producerId, track);
	}

	onAddConsumer(consumer, peerId) 
	{
        const {
            id,
            type,
            locallyPaused,
            remotelyPaused,
            rtpParameters,
            spatialLayers,
            temporalLayers,
            preferredSpatialLayer,
            preferredTemporalLayer,
            priority,        
            codec,
            track,
            paused,
        } = consumer;

		console.log("on add consumer:", consumer, peerId);

        var streamURL;
        if (track.kind == "video") {
            const stream = new MediaStream();
            stream.addTrack(track);
            streamURL = stream.toURL();
            this._streams.set(stream.id, stream);
        }

        native.postAddConsumer({
            id,
            type,
            locallyPaused,
            remotelyPaused,
            rtpParameters,
            spatialLayers,
            temporalLayers,
            preferredSpatialLayer,
            preferredTemporalLayer,
            priority,
            codec,
            streamURL,
            kind:track.kind,
            paused,
        }, peerId);
	}

	onConsumerClosed(consumerId, peerId) 
	{
		console.log("on consumer closed:", consumerId, peerId);
        native.postConsumerClosed(consumerId, peerId);
	}

	onConsumerPaused(consumerId, peerId, originator) 
	{
		console.log("on consumer paused:", consumerId, peerId, originator);

        native.postConsumerPaused(consumerId, peerId, originator);
	}

	onConsumerResumed(consumerId, peerId, originator) 
	{
		console.log("on consumer resumed:", consumerId, peerId, originator);

        native.postConsumerResumed(consumerId, peerId, originator);
	}

}