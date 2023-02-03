import { GlobalPurpose } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';

/**
 * Returns the list of GlobalPurposes
 * @author Felix Bole
 */
export const getGlobalPurposes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const gps = await GlobalPurpose.find()
            .populate('globalDatatypes', 'name id')
            .populate('servicesCategories');

        return restfulResponse(res, 200, gps);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns information on one GlobalPurpose
 * @author Felix Bole
 */
export const getGlobalPurpose = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const gp = await GlobalPurpose.findById(req.params.id)
            .populate('globalDatatypes', 'name id')
            .populate('servicesCategories');

        return restfulResponse(res, 200, gp);
    } catch (err) {
        next(err);
    }
};
