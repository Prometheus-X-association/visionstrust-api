import { Application } from 'express';

import publicRoutesV1 from '../routes/v1/public';
import protectedRoutesV1 from '../routes/v1/protected';

import legacyPublicRoutes from '../routes/legacy/public';
import legacyProtectedRoutes from '../routes/legacy/protected';

const routersToSetup = [
    publicRoutesV1,
    protectedRoutesV1,
    legacyPublicRoutes,
    legacyProtectedRoutes,
];

export = (app: Application) => {
    routersToSetup.forEach((config) => {
        const { prefix } = config;
        config.routers.forEach((router) => {
            const fullPrefix = prefix + router.prefix;
            app.use(fullPrefix, router.router);
        });
    });
};
