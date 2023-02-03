import { Application } from 'express';
import { startExpressServer } from './express';
import { loadMongoose } from './mongoose';

export const loadResources = async (app: Application) => {
    const connection = await loadMongoose();
    startExpressServer(app, connection);
};
