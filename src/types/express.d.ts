import 'express';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

declare module 'express' {
    interface Request {
        serviceKey?: string;
        service?: string | Types.ObjectId;

        /**
         * Only exists in the user protected router
         */
        identifier?: HydratedDocument<IIdentifier>;

        user?: { _id: ObjectId };
    }
}
