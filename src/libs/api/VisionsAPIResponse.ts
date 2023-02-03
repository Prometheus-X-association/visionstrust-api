import { Request, Response } from 'express';

type SuccessCode = 200 | 201 | 202;
type ErrorCode = 400 | 401 | 403 | 404 | 409 | 424 | 500;

type SuccessResponse = {
    code: SuccessCode;
    req: Request;
    res: Response;
    data: object;
    message?: string;
};

type ErrorResponse = {
    code: ErrorCode;
    req: Request;
    res: Response;
    errorMsg: string;
    message: string;
    data?: object;
};

const CODE_CONFIGURATIONS: {
    [key: number]: object;
} = {
    200: {
        statusText: 'OK',
    },
    201: {
        statusText: 'Created',
    },
    400: {
        statusText: 'Bad Request',
    },
    401: {
        statusText: 'Unauthorized',
    },
    403: {
        statusText: 'Forbidden',
    },
    404: {
        statusText: 'Not found',
    },
    424: {
        statusText: 'Failed Dependency',
    },
    500: {
        statusText: 'Internal server error',
    },
};

/**
 * Sends a formatted success response to the client
 */
export const successRes = (props: SuccessResponse) => {
    const { code, data, req, res, message } = props;
    return res.status(code).json({
        path: req.originalUrl,
        statusCode: code,
        success: true,
        ...CODE_CONFIGURATIONS[code],
        message,
        data,
    });
};

/**
 * Sends a pre-formatted error response to the client
 */
export const errorRes = (props: ErrorResponse) => {
    const { code, errorMsg, message, req, res, data } = props;
    return res.status(code).json({
        path: req.originalUrl,
        statusCode: code,
        error: errorMsg,
        success: false,
        ...CODE_CONFIGURATIONS[code],
        message,
        data,
    });
};
