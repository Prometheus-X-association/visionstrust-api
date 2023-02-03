import {
    Application,
    json as expressJson,
    urlencoded,
    static as expressStatic,
} from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { Connection } from 'mongoose';

import { initSession } from '../routes/middleware/session';
import { morganLogs } from '../libs/loggers';
import { globalErrorHandler } from '../routes/middleware/globalErrorHandler';
import routes from './routes';
import { errorRes } from '../libs/api/VisionsAPIResponse';

export const startExpressServer = (
    app: Application,
    connection: Connection
) => {
    app.use(cors());
    app.use(cookieParser());
    app.use(expressJson());
    app.use(urlencoded({ extended: true }));

    // TODO This shouldn't be here for the API in the new infrastructure
    app.use(expressStatic(path.join(__dirname, 'public/')));

    // Init session
    app.use(initSession(connection));

    app.use(morganLogs);

    app.set('views', [path.join(__dirname, 'views')]);
    app.set('view engine', 'ejs');

    if (process.env.NODE_ENV === 'production') {
        app.enable('trust proxy');
        app.use((req, res, next) => {
            req.secure
                ? next()
                : res.redirect('https://' + req.headers.host + req.url);
        });
    }

    // Health Check
    app.get('/healthcheck', async (_req, res) => {
        const healthCheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now(),
        };

        try {
            res.json(healthCheck);
        } catch (err) {
            res.status(503).json({ error: 'server-error' });
        }
    });

    // Documentation
    app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(import('../docs/swagger.json'))
    );

    // Load routes
    routes(app);

    // Errors
    app.get('*', async (req, res) => {
        return errorRes({
            code: 404,
            errorMsg: 'The url you requested for does not seem to exist',
            message: 'Resource not found',
            req,
            res,
        });
    });
    app.use(globalErrorHandler);

    return { app };
};
