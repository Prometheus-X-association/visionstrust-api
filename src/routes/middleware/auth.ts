import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../../libs/loggers';
import { Service } from '@visionsofficial/visions-public-models';

type DecodedServiceJWT = {
    serviceKey: string;
};

/**
 * Authentication through API
 * @todo There should be a wrapper allowing access to non web api's via the web authentication
 */
export const apiAuthenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authorization = req.header('authorization');
        const xauthtoken = req.header('x-auth-token'); // legacy access

        if (!xauthtoken && !authorization) {
            return res.status(401).json({
                error: 'authorization-denied-error',
                message: 'No authorization token. Access denied.',
            });
        }

        let token;

        if (authorization && !xauthtoken) token = authorization.split(' ')[1];
        else if (xauthtoken && !authorization) token = xauthtoken;
        else token = authorization.split(' ')[1];

        const data = token.split('.');

        if (data.length < 3) {
            return res.status(401).json({
                message: "'" + token + "' is not a valid authorization token",
            });
        }

        const buff = Buffer.from(data[1], 'base64');
        const authObject: DecodedServiceJWT = JSON.parse(buff.toString());

        if (!authObject.serviceKey) {
            return res.status(401).json({
                error: 'absent-servicekey-from-authorization-token-error',
                message: 'No service key, authorization denied',
            });
        }

        const { serviceKey } = authObject;

        const service = await Service.findOne({
            serviceKey: serviceKey,
        }).lean();

        if (!service)
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized resource' });

        try {
            const decoded = jwt.verify(token, service.serviceSecretKey);
            if (decoded) {
                req.serviceKey = serviceKey;
                req.service = service._id.toString();
                return next();
            } else {
                return res.status(401).json({
                    error: 'token-decode-error',
                    message: 'Unauthorized resource',
                });
            }
        } catch (error) {
            return res
                .status(401)
                .json({ error: error, message: 'Unauthorized resource' });
        }
    } catch (err) {
        Logger.error({ message: err.message, location: 'middleware.auth' });
        return res
            .status(401)
            .json({ error: 'invalid-token', statusCode: 401 });
    }
};
