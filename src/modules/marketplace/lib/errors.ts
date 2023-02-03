import { VisionsError } from '../../../libs/errors/VisionsError';

export class MarketplaceError extends VisionsError {
    constructor(message?: string, location = '{modules.marketplace}') {
        super(message);
        this.location = location;
    }
}
