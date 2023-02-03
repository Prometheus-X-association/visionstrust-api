import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { VisionsError } from '../../libs/errors/VisionsError';
import { Logger } from '../../libs/loggers';

export const globalErrorHandler = async (
    err: Error | VisionsError | AxiosError,
    req: Request,
    res: Response
) => {
    Logger.error({
        location: err.stack,
        message: err.message,
    });

    const serverError = (customMessage = '') => {
        return res.status(500).json({
            error: 'internal-server-error',
            statusCode: 500,
            message: customMessage || undefined,
        });
    };

    // HANDLE VISIONS MODULES ERROR
    if (err instanceof VisionsError) {
        if (err.isVisionsError) {
            if (!err.statusCode) {
                return serverError(err.message);
            }

            return res
                .status(err.statusCode)
                .json({ message: err.message, statusCode: err.statusCode });
        }
    }

    // HANDLE AXIOS ERRORS
    if (err instanceof AxiosError) {
        if (err.isAxiosError) {
            return res.status(424).json({
                error: 'Something went wrong when communicating with a third-party service',
                message: err.message,
                statusCode: 424,
            });
        }
    }

    return serverError('Unknown Error');
};
