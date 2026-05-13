import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import App from './App';

import { Buffer } from 'buffer';
global.Buffer = Buffer;

AppRegistry.registerComponent(appName, () => App);
