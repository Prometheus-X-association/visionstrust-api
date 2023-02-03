import { Response } from 'express';
import { Logger } from '../../../libs/loggers';
import { VisionsError } from '../../../libs/errors/VisionsError';

const errorTypes = {
    ERR_CONSENTS: 'ERRCONSENTS',
    ERR_CONSENTS_NO_EXCHANGE_DATA: 'ERRCONSENTSNOEXCHANGEDATA',
    ERR_CONSENTS_NO_IDENTIFIER: 'ERRCONSENTSNOIDENTIFIER',
    ERR_CONSENTS_UNAUTHORIZED_EXCHANGE: 'ERRCONSENTSUNAUTHORIZEDEXCHANGE',
} as const;

export class ConsentsError extends VisionsError {
    isConsentsError = true;
    details = 'Error thrown from the consents module.';
    defaultJsonErrorObject: {
        error: string;
        details?: string;
    };
    shouldSendClientResponse: boolean;
    consentsTypeError: string;

    constructor(
        message: string,
        location: string,
        shouldSendClientResponse: boolean,
        statusCode?: number
    ) {
        super(message);
        this.shouldSendClientResponse = shouldSendClientResponse;
        this.statusCode = statusCode;
        this.location = 'module.consents.' + location;
        this.consentsTypeError = errorTypes.ERR_CONSENTS;
        this.defaultJsonErrorObject = {
            error: errorTypes.ERR_CONSENTS,
            details: this.details,
        };
    }

    sendClientResponse(res: Response, jsonBody = {}) {
        if (this.shouldSendClientResponse) {
            return res
                .status(this.statusCode)
                .json({ ...this.defaultJsonErrorObject, jsonBody });
        } else {
            throw new VisionsError();
        }
    }
}

export class NoExchangeDataError extends ConsentsError {
    constructor(location = '') {
        super('DataUseExchange does not seem to exist.', location, true, 404);
        this.consentsTypeError = errorTypes.ERR_CONSENTS_NO_EXCHANGE_DATA;
        this.defaultJsonErrorObject = {
            ...this.defaultJsonErrorObject,
            error: errorTypes.ERR_CONSENTS_NO_EXCHANGE_DATA,
        };
    }
}

export class NoUserIdentifierError extends ConsentsError {
    serviceInvolved: string;

    constructor(serviceInvolved: string, location = '') {
        super(`No User Identifier in ${serviceInvolved}`, location, true, 404);
        this.consentsTypeError = errorTypes.ERR_CONSENTS_NO_IDENTIFIER;
        this.serviceInvolved = serviceInvolved;
        this.details = `User does not have an identifier in the service ${serviceInvolved}`;
        this.defaultJsonErrorObject = {
            ...this.defaultJsonErrorObject,
            error: errorTypes.ERR_CONSENTS_NO_IDENTIFIER,
        };
    }
}

export class UnauthorizedExchangeError extends ConsentsError {
    constructor(location = '') {
        super(
            `Exchange unauthorized between the two services`,
            location,
            true,
            401
        );
        this.consentsTypeError = errorTypes.ERR_CONSENTS_UNAUTHORIZED_EXCHANGE;
        this.defaultJsonErrorObject = {
            ...this.defaultJsonErrorObject,
            error: errorTypes.ERR_CONSENTS_NO_IDENTIFIER,
        };
    }
}

export const handleCaughtErrors = (err: VisionsError) => {
    Logger.error(`${err.location} -- ${err.message}`);
    throw err;
};

export const handleCaughtErrorsOutsideModule = (
    err: Error | VisionsError | ConsentsError,
    res: Response
) => {
    if (err instanceof ConsentsError) {
        switch (err.consentsTypeError) {
            case errorTypes.ERR_CONSENTS_NO_EXCHANGE_DATA:
                return err.sendClientResponse(res, {
                    message: 'No exchange data found',
                });

            case errorTypes.ERR_CONSENTS_UNAUTHORIZED_EXCHANGE:
                return err.sendClientResponse(res, {
                    message: 'Unauthorized exchange',
                });

            case errorTypes.ERR_CONSENTS_NO_IDENTIFIER:
                return err.sendClientResponse(res, {
                    message: 'Missing identifier',
                });

            default:
                return err.sendClientResponse(res);
        }
    }

    return res.status(500).json({
        error: 'unhandled-error',
        message: 'error thrown from the consent module',
        errorObject: err,
    });
};
