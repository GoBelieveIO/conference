import { AppRegistry } from 'react-native';
import { App } from './features/app';
import { ConferenceCreator } from './features/conference';

// Register the main Component.
AppRegistry.registerComponent('App', () => App);

// Register the main Component.
AppRegistry.registerComponent('ConferenceCreator', () => ConferenceCreator);
