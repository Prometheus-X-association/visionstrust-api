import { Identifier } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { errorRes } from '../../libs/api/VisionsAPIResponse';

/**
 * Middleware that looks for the user identifier by email and passes it to the
 * request object if found allowing for callbacks to access it without doing
 * a query of their own
 * @author Felix Bole
 */
export const findUserIdentifierForService = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const identifier = await Identifier.findOne({
        $and: [{ service: req.service }, { email: req.params.email }],
    });

    if (!identifier) {
        return errorRes({
            code: 404,
            errorMsg: 'resource not found',
            message: 'User Identifier not found',
            req,
            res,
        });
    }

    req.identifier = identifier;

    next();
};
