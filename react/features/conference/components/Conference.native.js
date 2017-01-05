import React, { Component } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableHighlight,
    Image,
    Platform
} from 'react-native';

import { connect as reactReduxConnect } from 'react-redux';
import Permissions from 'react-native-permissions';

import { ColorPalette } from '../../base/styles';
import { Icon } from '../../base/fontIcons';


var Sound = require('react-native-sound');

import {
    connect,
    disconnect
} from '../../base/connection';

import {
    MEDIA_TYPE,
    toggleCameraFacingMode,
    toggleAudioMuted,
    toggleVideoMuted
} from '../../base/media';

import {
    localParticipantJoined,
    localParticipantLeft
} from '../../base/participants';


import {
    changeParticipantEmail,
    dominantSpeakerChanged,
    participantJoined,
    participantLeft,
    participantRoleChanged
} from '../../base/participants';


import {
    createLocalTracks,
    destroyLocalTracks,
    trackAdded,
    trackRemoved
} from "../../base/tracks";

import {
    getDomain,
    setDomain,
    EMAIL_COMMAND
} from '../../base/connection';

import {
    setRoom,
    createConference,
    conferenceJoined,
    conferenceLeft,
    conferenceWillLeave,
    _addLocalTracksToConference,
} from '../../base/conference';


import {
    loadConfig,
    setConfig,
    initLib,
    disposeLib    
} from '../../base/lib-jitsi-meet';


import {
    _getRoomAndDomainFromUrlString,
} from '../../app/functions';


import JitsiMeetJS from '../../base/lib-jitsi-meet';
const JitsiConferenceEvents = JitsiMeetJS.events.conference;


import { Container } from '../../base/react';
import { FilmStrip } from '../../filmStrip';
import { LargeVideo } from '../../largeVideo';
import { Toolbar, ToolbarButton } from '../../toolbar';

import { styles } from './styles';

import { NativeModules, NativeAppEventEmitter, BackAndroid } from 'react-native';
var IsAndroid = (Platform.OS == 'android');
var native;
if (IsAndroid) {
    native = NativeModules.ConferenceActivity;
} else {
    native = NativeModules.ConferenceViewController;
}


/**
 * The timeout in milliseconds after which the toolbar will be hidden.
 */
const TOOLBAR_TIMEOUT_MS = 5000;

const SESSION_DIAL = "dial";
const SESSION_ACCEPT = "accept";
const SESSION_CONNECTED = "connected";

/**
 * The conference page of the application.
 */
class Conference extends Component {

    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);

        console.log("is initiator:", this.props.isInitiator);
        console.log("conference id:", this.props.conferenceID);
        
        var sessionState = this.props.isInitiator ? SESSION_DIAL : SESSION_ACCEPT;
        this.state = { toolbarVisible: false, sessionState:sessionState };

        this.canceled = false;
        this.hangup = false;
        
        /**
         * The numerical ID of the timeout in milliseconds after which the
         * toolbar will be hidden. To be used with
         * {@link WindowTimers#clearTimeout()}.
         *
         * @private
         */
        this._toolbarTimeout = undefined;

        // Bind event handlers so they are only bound once for every instance.
        this._onClick = this._onClick.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onRefuse = this._onRefuse.bind(this);
        this._onAccept = this._onAccept.bind(this);

        this._onHangup = this._onHangup.bind(this);
        this._toggleAudio = this._toggleAudio.bind(this);
        this._toggleVideo = this._toggleVideo.bind(this);
        this._toggleCameraFacingMode = this._toggleCameraFacingMode.bind(this);

        this._handleBack = this._handleBack.bind(this);
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
        
        
        if (!this.props.isInitiator) {
            this.play("call.mp3");

            
            //60s timeout
            this.timer = setTimeout(
                () => {
                    if (this.whoosh) {
                        this.whoosh.stop();
                        this.whoosh.release();
                        this.whoosh = null;
                    }
                    native.dismiss();
                },
                60*1000
            );
        } else {
            this.play("start.mp3");
            this.startConference();

            //60s timeout
            this.timer = setTimeout(
                () => {
                    if (this.whoosh) {
                        this.whoosh.stop();
                        this.whoosh.release();
                        this.whoosh = null;
                    }

                    var dispatch = this.props.dispatch;
                    dispatch(localParticipantLeft());

                    dispatch(disconnect())
                        .then(() => dispatch(destroyLocalTracks()))
                        .then(() => dispatch(disposeLib()))
                        .then(() => native.dismiss());
                },
                60*1000
            );
        }
    }

    componentDidMount() {
        
    }

    startConference() {
        var url = 'https://jitsi.gobelieve.io/' + this.props.channelID;
        const { domain, room } = _getRoomAndDomainFromUrlString(url);
        
        var dispatch = this.props.dispatch;
        // Update domain without waiting for config to be loaded to prevent
        // race conditions when we will start to load config multiple times.
        dispatch(setDomain(domain));
        this.props.dispatch(localParticipantJoined());
        
        // If domain has changed, that means we need to load new config
        // for that new domain and set it, and only after that we can
        // navigate to different route.
        return loadConfig(`https://${domain}`)
            .then(config => {
                // We set room name only here to prevent race conditions on
                // app start to not make app re-render conference page for
                // two times.
                dispatch(setRoom(room));
                dispatch(setConfig(config));
                
                console.log("set domain:", domain);
                console.log("set room:", room);
                console.log("set config:", config);
            })
            .then(() => this.requestPermission('camera'))
            .then(() => this.requestPermission('microphone'))
            .then(() => dispatch(initLib()))
            .then(() => dispatch(connect()))
            .then(() => this.createConference())
            .then((conference) => this._setupConferenceListeners(conference));
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
        this._clearToolbarTimeout();
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

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
        console.log("session state:", this.state.sessionState);
        
        if (this.state.sessionState == SESSION_DIAL) {
            return this.renderDial();
        } else if (this.state.sessionState == SESSION_ACCEPT) {
            return this.renderAccept();
        } else if (this.state.sessionState == SESSION_CONNECTED) {
            return this.renderConference();
        }
        return null;
    }

    //通话界面
    renderConference() {
        console.log("render conference");
        const toolbarVisible = this.state.toolbarVisible;
        
        if (IsAndroid && toolbarVisible) {
            //!!!!android bug toolbar无法正常显示
            //使用不同的树结构，webrtcview完全重新构造，这会导致界面闪烁
            var component = (
                <View style={{flex:1}}>
                    <Container
                        onClick = { this._onClick }
                        style = { styles.conference }
                        touchFeedback = { false }>

                        <LargeVideo />
                        <Toolbar visible = { toolbarVisible }
                                 toggleCameraFacingMode={this._toggleCameraFacingMode}
                                 toggleAudio = {this._toggleAudio}
                                 toggleVideo = {this._toggleVideo}
                                 onHangup = {this._onHangup} />
                        <FilmStrip visible = { !toolbarVisible } />
                    </Container>
                </View>
            );
            return component;
        }
        
        var component = (
            <Container
                onClick = { this._onClick }
                style = { styles.conference }
                touchFeedback = { false }>

                <LargeVideo />
                <Toolbar visible = { toolbarVisible }
                         toggleCameraFacingMode={this._toggleCameraFacingMode}
                         toggleAudio = {this._toggleAudio}
                         toggleVideo = {this._toggleVideo}
                         onHangup = {this._onHangup} />
                <FilmStrip visible = { !toolbarVisible } />
            </Container>
        );
        return component;
    }
    
    //呼叫界面
    renderDial() {
        console.log("render dial");
        return (
            <View style={{flex:1, backgroundColor:"white"}}>
                <View style={{flex:1}} >
                    <ScrollView
                        contentContainerStyle = {{flex:1,
                                                  justifyContent:"center",
                                                  alignItems:"center"}}
                        style={{flex:1}}
                        horizontal = { true }
                        showsHorizontalScrollIndicator = { false }
                        showsVerticalScrollIndicator = { false } >
                        {this.props.partipants.map(p => {
                             return <Image
                                        style = {{resizeMode:"stretch", width:120, height:120}}
                                        key = { p.uid }
                                        source = {p.avatar ? {uri:p.avatar} : require('../../../../img/avatar_contact.png') } />})
                        }
                    </ScrollView>
                </View>
                <View style={{
                    flex:1,
                    flexDirection:"row",
                    justifyContent:'center',
                    alignItems: 'center'}}>
                    
                    <TouchableHighlight onPress={this._onCancel}
                                        style = {{
                                            backgroundColor:"blue",
                                            borderRadius: 35,
                                            height:60,
                                            width: 60,
                                            justifyContent: 'center'
                                            }}
                                        underlayColor="red" >
                        
                        <Image source={{uri: 'Call_hangup'}}
                               style={{width: 60, height: 60}} />
                    </TouchableHighlight>
                </View>
            </View>
        );
    }

    //接听界面
    renderAccept() {
        console.log("render accept");

        var p = this.props.partipants.find(p => p.uid == this.props.initiator);

        if (!p) {
            return;
        }
        
        return (
            <View style={{flex:1, backgroundColor:"white"}}>
                <View style={{
                    flex:1,
                    justifyContent:"center",
                    alignItems:"center"}}>
                    <Image
                        style = {{resizeMode:"stretch", width:120, height:120}}
                        key = { p.uid }
                        source = {p.avatar ? {uri:p.avatar} : require('../../../../img/avatar_contact.png') } />
                    <Text style={{fontSize:32}}>{p.name}</Text>
                    <Text style={{fontSize:12}}>邀请你进行语音通话</Text>
                </View>
                <View style={{flex:1}}>
                    <View style={{alignItems: 'center'}}>
                        <Text>
                            通话成员
                        </Text>
                        <View style={{
                            flex:1,
                            flexDirection:"row",
                            justifyContent:"center"}}>
                            {this.props.partipants.map(p => {
                                 return <Image
                                            style = {{resizeMode:"stretch", width:32, height:32}}
                                            key = { p.uid }
                                            source = {p.avatar ? {uri:p.avatar} : require('../../../../img/avatar_contact.png') } />})
                            }
                        </View>
                    </View>
                    <View style={{
                        flex:1,
                        flexDirection:"row",
                        justifyContent:'space-around',
                        alignItems: 'center' }}>
                        <TouchableHighlight onPress={this._onRefuse}
                                            style = {{
                                                backgroundColor:"blue",
                                                borderRadius: 35,
                                                height:60,
                                                width: 60,
                                                justifyContent: 'center'
                                            }}
                                            underlayColor="red">

                            <Image source={{uri: 'Call_hangup'}}
                                   style={{alignSelf: 'center', width: 60, height: 60}} />
                            
                        </TouchableHighlight>
                        

                        <TouchableHighlight onPress={this._onAccept}
                                            style = {{
                                                backgroundColor:"blue",
                                                borderRadius: 35,
                                                height:60,
                                                width: 60,
                                                justifyContent: 'center'
                                            }} >
                            <Image source={{uri: 'Call_Ans'}}
                                   style={{alignSelf: 'center', width: 60, height: 60}} />
                        </TouchableHighlight>
                    </View>
                </View>
            </View>
        );        
    }

    _handleBack() {
        console.log("session state:", this.state.sessionState);
        
        if (this.state.sessionState == SESSION_DIAL) {
            this._onCancel();
        } else if (this.state.sessionState == SESSION_ACCEPT) {
            this._onRefuse();
        } else if (this.state.sessionState == SESSION_CONNECTED) {
            this._onHangup();
        }

        //不立刻退出界面
        return true;
    }
    _onCancel() {
        if (this.canceled) {
            return;
        }

        this.canceled = true;
        console.log("cancel...");
        if (this.whoosh) {
            this.whoosh.stop();
            this.whoosh.release();
            this.whoosh = null;
        }

        var dispatch = this.props.dispatch;
        dispatch(localParticipantLeft());
        dispatch(disconnect())
            .then(() => dispatch(disposeLib()))
            .then(() => native.dismiss());
    }

    _onAccept() {
        console.log("accept...");

        native.accept();
        if (this.whoosh) {
            this.whoosh.stop();
            this.whoosh.release();
            this.whoosh = null;
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        this.setState({sessionState:SESSION_CONNECTED});
        
        var dispatch = this.props.dispatch;
        var p = this.startConference();
        p.then(() => dispatch(createLocalTracks()));
    }

    _onRefuse() {
        console.log("refuse...");
        
        native.refuse();
        if (this.whoosh) {
            this.whoosh.stop();
            this.whoosh.release();
            this.whoosh = null;
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        native.dismiss();
    }
    
    _onHangup() {
        if (this.hangup) {
            return;
        }
        this.hangup = true;
        console.log("on hangup...");
        var dispatch = this.props.dispatch;
        dispatch(localParticipantLeft());
        dispatch(disconnect())
            .then(() => dispatch(destroyLocalTracks()))
            .then(() => dispatch(disposeLib()))
            .then(() => native.dismiss());
    }

    /**
     * Dispatches action to toggle the mute state of the audio/microphone.
     *
     * @protected
     * @returns {void}
     */
    _toggleAudio() {
        this.props.dispatch(toggleAudioMuted());
    }

    /**
     * Dispatches action to toggle the mute state of the video/camera.
     *
     * @protected
     * @returns {void}
     */
    _toggleVideo() {
        this.props.dispatch(toggleVideoMuted());
    }

    /**
     * Switches between the front/user-facing and rear/environment-facing
     * cameras.
     *
     * @private
     * @returns {void}
     */
    _toggleCameraFacingMode() {
        var state = this.props.store.getState();
        const media = state['features/base/media'];

        if (media.video.muted) {
            return;
        }

        this.props.dispatch(toggleCameraFacingMode());
    }
    

    play(name) {
        console.log("play:" + name);
        // Load the sound file 'whoosh.mp3' from the app bundle
        // See notes below about preloading sounds within initialization code below.
        var whoosh = new Sound(name, Sound.MAIN_BUNDLE);
        
        // Loop indefinitely until stop() is called        
        whoosh.setNumberOfLoops(-1);
        whoosh.prepare((error) => {
            if (error) {
                console.log('failed to load the sound', error);
            } else { // loaded successfully
                console.log('duration in seconds: ' + whoosh.getDuration() +
                            'number of channels: ' + whoosh.getNumberOfChannels());
                // Get properties of the player instance
                console.log('volume: ' + whoosh.getVolume());
                console.log('pan: ' + whoosh.getPan());
                console.log('loops: ' + whoosh.getNumberOfLoops());
                
                whoosh.play((success) => {
                    if (success) {
                        console.log('successfully finished playing');
                    } else {
                        console.log('playback failed due to audio decoding errors');
                    }
                });
            }
        });

    
        this.whoosh = whoosh;
    }

    /**
     * Initializes a new conference.
     *
     * @returns {Function}
     */
    createConference() {
        var store = this.props.store;
        const state = store.getState();
        const connection = state['features/base/connection'].jitsiConnection;
        const room = state['features/base/conference'].room;

        if (!connection) {
            throw new Error('Cannot create conference without connection');
        }
        if (typeof room === 'undefined' || room === '') {
            throw new Error('Cannot join conference without room name');
        }

        // TODO Take options from config.
        const conference
        = connection.initJitsiConference(room, { openSctp: true });

        conference.join();

        return conference;
    }



    /**
     * Attach any pre-existing local media to the conference once the conference has
     * been joined.
     *
     * @param {JitsiConference} conference - The JitsiConference instance which was
     * joined by the local participant.
     * @returns {Function}
     */
    conferenceJoined(conference) {
        var store = this.props.store;
        var dispatch = this.props.dispatch;
        const localTracks = store.getState()['features/base/tracks']
            .filter(t => t.local)
            .map(t => t.jitsiTrack);

        if (localTracks.length) {
            _addLocalTracksToConference(conference, localTracks);
        }

        if (this.props.name) {
            conference.setDisplayName(this.props.name);
        }
        dispatch(conferenceJoined(conference))
    }


    participantJoined(id, user) {
        var dispatch = this.props.dispatch;
        console.log("user join:" + id +
                    " name:" + user.getDisplayName());
        if (this.props.isInitiator &&
            this.state.sessionState != SESSION_CONNECTED) {
            if (this.whoosh) {
                this.whoosh.stop();
                this.whoosh.release();
                this.whoosh = null;
            }
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            dispatch(createLocalTracks());
            this.setState({sessionState:SESSION_CONNECTED});
        }
        return dispatch(participantJoined({
            id,
            name: user.getDisplayName(),
            role: user.getRole()
        }))        
    }

    participantLeft(id) {
        var dispatch = this.props.dispatch;
        dispatch(participantLeft(id));


        var store = this.props.store;
        var state = store.getState();
        var participants = state['features/base/participants'];
        if (participants.length == 1 && participants[0].local) {
            //其他人全部离开
            this._onHangup();
        }
    }
    /**
     * Setup various conference event handlers.
     *
     * @param {JitsiConference} conference - Conference instance.
     * @private
     * @returns {Function}
     */
    _setupConferenceListeners(conference) {
        var dispatch = this.props.dispatch;
        conference.on(
            JitsiConferenceEvents.CONFERENCE_JOINED,
            () => this.conferenceJoined(conference));
        conference.on(
            JitsiConferenceEvents.CONFERENCE_LEFT,
            () => dispatch(conferenceLeft(conference)));

        conference.on(
            JitsiConferenceEvents.DOMINANT_SPEAKER_CHANGED,
            id => dispatch(dominantSpeakerChanged(id)));

        conference.on(
            JitsiConferenceEvents.TRACK_ADDED,
            track =>
                track && !track.isLocal() && dispatch(trackAdded(track)));
        conference.on(
            JitsiConferenceEvents.TRACK_REMOVED,
            track =>
                track && !track.isLocal() && dispatch(trackRemoved(track)));

        conference.on(
            JitsiConferenceEvents.USER_JOINED,
            (id, user) => this.participantJoined(id, user));
        conference.on(
            JitsiConferenceEvents.USER_LEFT,
            id => this.participantLeft(id));
        conference.on(
            JitsiConferenceEvents.USER_ROLE_CHANGED,
            (id, role) => dispatch(participantRoleChanged(id, role)));

        conference.addCommandListener(
            EMAIL_COMMAND,
            (data, id) => dispatch(changeParticipantEmail(id, data.value)));

    }


    /**
     * Clears {@link #_toolbarTimeout} if any.
     *
     * @private
     * @returns {void}
     */
    _clearToolbarTimeout() {
        if (this._toolbarTimeout) {
            clearTimeout(this._toolbarTimeout);
            this._toolbarTimeout = undefined;
        }
    }

    /**
     * Changes the value of the toolbarVisible state, thus allowing us to
     * 'switch' between toolbar and filmstrip views and change the visibility of
     * the above.
     *
     * @private
     * @returns {void}
     */
    _onClick() {
        const toolbarVisible = !this.state.toolbarVisible;

        this.setState({ toolbarVisible });

        this._clearToolbarTimeout();
        if (toolbarVisible) {
            this._toolbarTimeout
                = setTimeout(this._onClick, TOOLBAR_TIMEOUT_MS);
        }
    }
}

/**
 * Conference component's property types.
 *
 * @static
 */
Conference.propTypes = {
    dispatch: React.PropTypes.func
};

export default reactReduxConnect(function(state) {
    return state;
})(Conference);
