import { setupEnvironment } from './env';

export { keys } from './keys';

// This should be one of the first actions
// to occur during startup of the app
setupEnvironment();
