import { NextFunction, Request, Response } from 'express';
import { errorRes } from '../../libs/api/VisionsAPIResponse';
import { Logger } from '../../libs/loggers';

/**
 * Checks for the content type to be application/json
 * @author Felix Bole
 */
export const checkApplicationJSON = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (
        !req.headers['content-type'] ||
        req.headers['content-type'] !== 'application/json'
    ) {
        if (req.service) {
            Logger.error({
                message: `Service ${req.service} tried to call ${req.originalUrl} with content-type: ${req.headers['content-type']}`,
                location: 'middleware.checkAppliationJSON',
            });
        }

        return errorRes({
            code: 400,
            req,
            res,
            errorMsg: 'invalid convent-type',
            message: `Invalid content-type header, received ${req.headers['content-type']}`,
        });
    }

    next();
};
