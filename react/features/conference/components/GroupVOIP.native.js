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
    native = NativeModules.GroupVOIPActivity;
} else {
    native = NativeModules.GroupVOIPViewController;
}


/**
 * The timeout in milliseconds after which the toolbar will be hidden.
 */
const TOOLBAR_TIMEOUT_MS = 5000;

/**
 * The groupvoip page of the application.
 */
class GroupVOIP extends Component {

    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);


        this.state = { toolbarVisible: false };
        
        /**
         * The numerical ID of the timeout in milliseconds after which the
         * toolbar will be hidden. To be used with
         * {@link WindowTimers#clearTimeout()}.
         *
         * @private
         */
        this._toolbarTimeout = undefined;

        this.hangup = false;
        
        // Bind event handlers so they are only bound once for every instance.
        this._onClick = this._onClick.bind(this);

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

        this.startConference();
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
            .then((conference) => this._setupConferenceListeners(conference))
            .then(() => dispatch(createLocalTracks()));
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
        return this.renderConference();
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
    
   
    _handleBack() {
        this._onHangup();

        //不立刻退出界面
        return true;
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
        return dispatch(participantJoined({
            id,
            name: user.getDisplayName(),
            role: user.getRole()
        }))        
    }

    participantLeft(id) {
        var dispatch = this.props.dispatch;
        dispatch(participantLeft(id));
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
GroupVOIP.propTypes = {
    dispatch: React.PropTypes.func
};

export default reactReduxConnect(function(state) {
    return state;
})(GroupVOIP);
