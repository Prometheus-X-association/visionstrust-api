import { NextFunction, Request, Response } from 'express';
import { Service } from '@visionsofficial/visions-public-models';
import { makeId } from '../../../utils/idGenerator';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';

/**
 * Creates a new service
 * @author Felix Bole
 */
export const createService = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            name,
            description,
            isDataUser,
            isDataProvider,
            website,
            selfDescription,
        } = req.body;

        const service = new Service({
            name,
            description,
            serviceKey: makeId(100),
            serviceSecretKey: makeId(50),
            checks: {
                isDataProvier: isDataProvider || false,
                isDataUser: isDataUser || false,
            },
            urls: {
                website,
            },
        });

        if (selfDescription) service.selfDescription = selfDescription;
        return restfulResponse(res, 201, service);
    } catch (err) {
        next(err);
    }
};
