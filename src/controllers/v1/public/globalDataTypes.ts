import { GlobalDataType } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';

/**
 * Returns information on all GlobalDataTypes
 * @author Felix Bole
 */
export const getGlobalDataTypes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const gds = await GlobalDataType.find();
        return restfulResponse(res, 200, gds);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns information on one GlobalDataType
 * @author Felix Bole
 */
export const getGlobalDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const gd = await GlobalDataType.findById(req.params.id);
        return restfulResponse(res, 200, gd);
    } catch (err) {
        next(err);
    }
};
