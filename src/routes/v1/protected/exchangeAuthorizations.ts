import { Router } from 'express';
import { body, check } from 'express-validator';
import {
    createExchangeAuthorization,
    getExchangeAuthorizationWithOtherService,
    getOwnedExchangeAuthorization,
    getOwnedExchangeAuthorizations,
    revokeExchangeAuthorization,
    updateExchangeAuthorization,
} from '../../../controllers/v1/protected/exchangeAuthorizations';

import { apiAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';

const router = Router();
router.use(apiAuthenticate);

router.get('/', getOwnedExchangeAuthorizations);
router.post(
    '/',
    [
        body('serviceId', 'Missing or invalid serviceId format')
            .isString()
            .notEmpty()
            .trim()
            .escape(),
    ],
    validate,
    createExchangeAuthorization
);
router.get(
    '/with/:serviceId',
    [
        check('serviceId', 'Missing or invalid serviceId format')
            .isString()
            .notEmpty()
            .trim()
            .escape(),
    ],
    validate,
    getExchangeAuthorizationWithOtherService
);
router.get('/:id', getOwnedExchangeAuthorization);
router.put('/:id', updateExchangeAuthorization);
router.delete('/:id', revokeExchangeAuthorization);

export default router;
