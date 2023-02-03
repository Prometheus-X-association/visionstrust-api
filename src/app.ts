import express from 'express';
import { Logger } from './libs/loggers';
import { loadResources } from './loaders';
import './config';
import { IncomingMessage, Server, ServerResponse } from 'http';

const app = express();
let server: Server<typeof IncomingMessage, typeof ServerResponse>;
const PORT = process.env.PORT || 4040;

const startServer = async () => {
    await loadResources(app);
    server = app.listen(PORT, () => {
        Logger.debug({
            message: `App running on: http://localhost:${PORT}`,
            location: 'expressLoader',
        });
    });
};

startServer();

export { app, server }; // For mocha tests;
