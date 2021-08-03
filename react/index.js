import { AppRegistry } from 'react-native';
import { registerGlobals } from 'react-native-webrtc';
import GroupCall from './GroupCall.js';

console.log("navigator:", navigator, "productor", navigator.product);
registerGlobals();
AppRegistry.registerComponent('GroupCall', () => GroupCall);


