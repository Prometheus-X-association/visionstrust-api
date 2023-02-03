import dotenv from 'dotenv';
import path from 'path';

export const setupEnvironment = () => {
    const env = dotenv.config({
        path: path.join(__dirname, '..', '..', '.env'),
    });

    if (env.error) {
        throw new Error(
            'Error initializing environment. Could not find .env file'
        );
    }
};
