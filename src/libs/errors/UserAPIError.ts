import { VisionsError } from './VisionsError';

export class UserAPIError extends VisionsError {
    isUserAPIError: boolean;

    constructor(message = '', location = '', statusCode = 500) {
        super(message, location, statusCode);
        this.isUserAPIError = true;
    }
}
