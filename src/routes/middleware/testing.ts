import { ConsentExchange } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import {
    testAttachToken,
    testValidate,
} from '../../controllers/v1/protected/testenv';
import { errorRes } from '../../libs/api/VisionsAPIResponse';

const map = {
    attachToken: testAttachToken,
    validate: testValidate,
};

const checkForTesting = async (
    req: Request,
    res: Response,
    next: NextFunction,
    what: 'attachToken' | 'validate'
) => {
    try {
        if (!map[what]) throw new Error('unknown api check');

        const { consentId } = req.body;
        const ce = await ConsentExchange.findById(consentId);
        if (!ce)
            return errorRes({
                code: 404,
                errorMsg: 'resource not found',
                message: 'No consent with the specified consentId',
                req,
                res,
            });

        if (!ce.isTest) return next();

        return map[what](req, res, next);
    } catch (err) {
        next();
    }
};

export const checkForTestingToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    checkForTesting(req, res, next, 'attachToken');
};

export const checkForTestingValidate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    checkForTesting(req, res, next, 'validate');
};
