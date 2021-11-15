"use strict";

import {
    Platform,
    NativeModules,
    NativeEventEmitter,
} from 'react-native';

import RoomClient, {
    ROOM_STATE_EVENT,
    PEER_NEW_EVENT,
    PEER_CLOSED_EVENT,
    PEER_NEW_MESSAGE_EVENT,
    MEMBER_NEW_EVENT,
    MEMBER_LEFT_EVENT,
    PRODUCER_NEW_EVENT,
    PRODUCER_WILL_CLOSE_EVENT,
    PRODUCER_CLOSED_EVENT,
    PRODUCER_PAUSED_EVENT,
    PRODUCER_RESUMED_EVENT,
    PRODUCER_REPLACE_TRACK_EVENT,
    CONSUMER_NEW_EVENT,
    CONSUMER_WILL_CLOSE_EVENT,
    CONSUMER_CLOSED_EVENT,
    CONSUMER_PAUSED_EVENT,
    ACTIVE_SPEAKER_EVENT,
    CONSUMER_RESUMED_EVENT
} from "./RoomClient";
import {MEDIASOUP_URL} from "../config";

var native = NativeModules.RoomModule;
var Emitter = new NativeEventEmitter(Platform.OS === 'android' ? undefined : native);

const WS_URL = MEDIASOUP_URL;
function getProtooUrl({ roomId, peerId, mode }) {
    mode = mode || "";
    return `${WS_URL}?roomId=${roomId}&peerId=${peerId}&mode=${mode}`;
}

export default class RoomModule {
    constructor() {
        this._roomClient = undefined;
        this._producerTracks = new Map();

        this.onRoomState = this.onRoomState.bind(this);
        this.onNewPeer = this.onNewPeer.bind(this);
        this.onPeerClosed = this.onPeerClosed.bind(this);
        this.onNewPeerMessage = this.onNewPeerMessage.bind(this);
        this.onNewMember = this.onNewMember.bind(this);
        this.onMemberLeft = this.onMemberLeft.bind(this);
        this.onNewProducer = this.onNewProducer.bind(this);
        this.onProducerWillClose = this.onProducerWillClose.bind(this);
        this.onProducerClosed = this.onProducerClosed.bind(this);
        this.onProducerPaused = this.onProducerPaused.bind(this);
        this.onProducerResumed = this.onProducerResumed.bind(this);
        this.onReplaceProducerTrack = this.onReplaceProducerTrack.bind(this);
        this.onNewConsumer = this.onNewConsumer.bind(this);
        this.onConsumerWillClose = this.onConsumerWillClose.bind(this);
        this.onConsumerClosed = this.onConsumerClosed.bind(this);
        this.onConsumerPaused = this.onConsumerPaused.bind(this);
        this.onConsumerResumed = this.onConsumerResumed.bind(this);

        Emitter.addListener("join_room", (options) => {
            console.log("join room event");
            this.joinRoom(options);
        });

        Emitter.addListener("leave_room", ({roomId}) => {
            this.leaveRoom(roomId);
        });

        Emitter.addListener("switch_camera", () => {
            this.switchCamera();
        });

        Emitter.addListener("toggle_microphone", ({audioMuted}) => {
            this.toggleMicrophone(audioMuted);
        });

        Emitter.addListener("acquire_microphone", ({}) => {
            this._roomClient.acquireMicrophone();
        });

        Emitter.addListener("release_microphone", ({}) => {
            this._roomClient.releaseMicrophone();
        });

        Emitter.addListener("toggle_camera", ({videoMuted}) => {
           this.toggleCamera(videoMuted);
        });

        Emitter.addListener("enable_webcam", ({}) => {
            this._roomClient.enableWebcam();
        });

        Emitter.addListener("disable_webcam", ({}) => {
            this._roomClient.disableWebcam();
        });

        Emitter.addListener("enable_mic", ({}) => {
            this._roomClient.enableMic();
        });

        Emitter.addListener("disable_mic", ({}) => {
            this._roomClient.disableMic();
        });

        Emitter.addListener("mute_mic", ({remote}) => {
            this._roomClient.muteMic(remote);
        });

        Emitter.addListener("unmute_mic", ({remote}) => {
            this._roomClient.unmuteMic(remote);
        });

        Emitter.addListener("send_peer_message", (msg) => {
            this._roomClient.sendPeerMessage(msg);
        });
        
        Emitter.addListener("broadcast_message", (msg) => {
            this._roomClient.broadcastMessage(msg);
        });

        Emitter.addListener("join_conference", () => {
            this._roomClient.joinConference();
        });

        Emitter.addListener("leave_conference", () => {
            this._roomClient.leaveConference();
        });
    }

    joinRoom({roomId, peerId, token, displayName, cameraOn, microphoneOn, mode}) {
        const device = {
            flag : 'rn',
            name    : "rn",
            version : '0.64.0'
        };

        const useSimulcast = false;
        const useSharingSimulcast = false;
        const forceTcp = false;
        const produce = true;
        const produceVideo = cameraOn;
        const produceAudio = microphoneOn;
        const consume = true;
        const forceH264 = false;
        const forceVP9 = false;
        const svc = undefined;
        const datachannel = false;
        const externalVideo = false;
        const e2eKey = undefined;
        const hack = false;
        const protooUrl = getProtooUrl({ roomId, peerId, mode });

        const options = {
            roomId: ""+roomId,
            peerId: ""+peerId,
            token,
            displayName,
            device,
            protooUrl,
            handlerName: undefined,
            useSimulcast,
            useSharingSimulcast,
            forceTcp,
            produce,
            produceVideo,
            produceAudio,
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

    leaveRoom(roomId) {
        console.log("leave room:", roomId);
        this.closeRoomClient();
    }

    switchCamera() {
        console.log("switch camera");
        if (this._roomClient) {
            this._roomClient.switchCamera();
        }
    }

    toggleMicrophone(audioMuted) {
        console.log("toggle audio:", audioMuted);
        if (this._roomClient) {
            const remote = false;
            if (audioMuted) {
                this._roomClient.muteMic(remote);
            } else {
                this._roomClient.unmuteMic(remote);
            }
        }
    }

    toggleCamera(videoMuted) {
        console.log("toggle video:", videoMuted);
        if (this._roomClient) {
            if (videoMuted) {
                this._roomClient.disableWebcam();
            } else {
                this._roomClient.enableWebcam();
            }
        }
    }

    createRoomClient(options) {
        if (this._roomClient) {
            throw "can't create two room client";
        }
        console.log("create room client:", options);
        const roomClient = new RoomClient(options);

        roomClient.on(ROOM_STATE_EVENT, this.onRoomState);
        roomClient.on(PEER_NEW_EVENT, this.onNewPeer);
        roomClient.on(PEER_CLOSED_EVENT, this.onPeerClosed);
        roomClient.on(PEER_NEW_MESSAGE_EVENT, this.onNewPeerMessage);
        roomClient.on(MEMBER_NEW_EVENT, this.onNewMember);
        roomClient.on(MEMBER_LEFT_EVENT, this.onMemberLeft);
        roomClient.on(PRODUCER_NEW_EVENT, this.onNewProducer);
        roomClient.on(PRODUCER_WILL_CLOSE_EVENT, this.onProducerWillClose);
        roomClient.on(PRODUCER_CLOSED_EVENT, this.onProducerClosed);
        roomClient.on(PRODUCER_PAUSED_EVENT, this.onProducerPaused);
        roomClient.on(PRODUCER_RESUMED_EVENT, this.onProducerResumed);
        roomClient.on(PRODUCER_REPLACE_TRACK_EVENT, this.onReplaceProducerTrack);
        roomClient.on(CONSUMER_NEW_EVENT, this.onNewConsumer);
        roomClient.on(CONSUMER_WILL_CLOSE_EVENT, this.onConsumerWillClose);
        roomClient.on(CONSUMER_CLOSED_EVENT, this.onConsumerClosed);
        roomClient.on(CONSUMER_PAUSED_EVENT, this.onConsumerPaused);
        roomClient.on(CONSUMER_RESUMED_EVENT, this.onConsumerResumed);

        this._roomClient = roomClient;
    }

    closeRoomClient() {
        if (this._roomClient) {
            console.log("close room client");
            this._roomClient.close();
            this._roomClient = null;
        }

        const tracks = this._producerTracks;
        this._producerTracks = new Map();
        //等待close过程完全结束，释放track
        console.log("release producer tracks:", tracks.size);
        tracks.forEach((track) => {
            track.release();
        });
    }

    onRoomState(state) {
        console.log("room state:", state);
        native.postRoomState(state);
    }

    onNewPeer(peer) {
        console.log("new peer:", peer);
        peer.present = peer.present || false;
        native.postNewPeer(peer);
    }

    onPeerClosed(peerId) {
        console.log("peer closed:", peerId);
        native.postPeerClosed(peerId);
    }

    onNewPeerMessage(msg) {
        native.postNewPeerMessage(msg);
    }

    onNewMember(peerId) {
        native.postNewMember(peerId);
    }

    onMemberLeft(peerId) {
        native.postMemberLeft(peerId);
    }

    onNewProducer(producer) {
        const {
            id,          
            deviceLabel,
            type,
            paused,       
            track,        
            rtpParameters,
            codec         
        } = producer;

        this._producerTracks.set(track.id, track);

        console.log("on new producer:", producer);
        //todo
        native.postNewProducer({
            id,
            deviceLabel,
            type,
            paused,
            trackId:track.id,
            kind:track.kind,
            rtpParameters,
            codec
        });
    }

    onProducerWillClose(producerId) {
        console.log("producer will close:", producerId);
        native.postProducerWillClose(producerId);
    }

    onProducerClosed(producerId) {
        console.log("remove producer:", producerId);

        native.postProducerClosed(producerId);
    }

    onProducerPaused(producerId) {
        console.log("on producer paused:", producerId);
    }

    onProducerResumed(producerId) {
        console.log("on producer resumed:", producerId);
    }

    onReplaceProducerTrack(producerId, track) {
        console.log("replace producer track", producerId, track);
    }

    onNewConsumer(consumer, peerId) {
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

        native.postNewConsumer({
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
            trackId:track.id,
            kind:track.kind,
            paused,
        }, peerId);
    }

    onConsumerWillClose(consumerId, peerId) {
        console.log("on consumer will close:", consumerId, peerId);
        native.postConsumerWillClose(consumerId, peerId);
    }

    onConsumerClosed(consumerId, peerId) {
        console.log("on consumer closed:", consumerId, peerId);
        native.postConsumerClosed(consumerId, peerId);
    }

    onConsumerPaused(consumerId, peerId, originator) {
        console.log("on consumer paused:", consumerId, peerId, originator);
        native.postConsumerPaused(consumerId, peerId, originator);
    }

    onConsumerResumed(consumerId, peerId, originator) {
        console.log("on consumer resumed:", consumerId, peerId, originator);
        native.postConsumerResumed(consumerId, peerId, originator);
    }
}
