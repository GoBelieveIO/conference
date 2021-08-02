import { AppRegistry } from 'react-native';
import { registerGlobals } from 'react-native-webrtc';
import GroupCall from './GroupCall.js';

registerGlobals();
AppRegistry.registerComponent('GroupCall', () => GroupCall);


