import { AppRegistry } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { name as appName } from './app.json';
import App from './App';
import { initMonitoring, SENTRY_DSN } from './src/config/monitoring';

import { Buffer } from 'buffer';
global.Buffer = Buffer;

initMonitoring();

const Root = SENTRY_DSN ? Sentry.wrap(App) : App;

AppRegistry.registerComponent(appName, () => Root);
