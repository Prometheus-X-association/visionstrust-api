import session from 'express-session';
import MongoStore from 'connect-mongo';
import crypto from 'crypto';

/**
 * Initializes the session with the mongo store
 * @param connection This should be a mongoose.Connection, but there is an issue in connect-mongo with typescript making it incompatible when running MongoStore.create()
 * @returns The session object
 */
export const initSession = (connection: object) => {
    return session({
        genid: () => {
            return crypto.randomUUID();
        },
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 },
        store: MongoStore.create(connection),
    });
};
