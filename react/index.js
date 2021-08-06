import { AppRegistry } from 'react-native';
import { registerGlobals } from 'react-native-webrtc';
import GroupCall from './GroupCall.js';
import RoomModule from "./RoomModule";
registerGlobals();

var roomModule = new RoomModule();

AppRegistry.registerComponent('GroupCall', () => GroupCall);


