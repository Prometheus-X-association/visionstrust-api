import { Router } from 'express';
import { body } from 'express-validator';
import {
    createExchangeConfiguration,
    getAllExchangeConfigurations,
    getOneExchangeConfiguration,
    revokeExchangeConfigurationRequest,
    revokeExchangeConfigurationRequestAuthorizations,
    updateExchangeConfigurationAuthorizations,
    updateExchangeConfigurationRequest,
} from '../../../controllers/v1/protected/exchanges';

import { apiAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';

const router = Router();
router.use(apiAuthenticate);

router.get('/', getAllExchangeConfigurations);
router.post(
    '/',
    [
        body('serviceId').exists().notEmpty().isString().trim(),
        body('purposeId').exists().notEmpty().isString().trim(),
        body('datatypes', 'Field should be a non empty array')
            .exists()
            .isArray(),
    ],
    validate,
    createExchangeConfiguration
);
router.get('/:id', getOneExchangeConfiguration);
router.put(
    '/:id',
    [body('datatypes', 'Field should be a non empty array').exists().isArray()],
    validate,
    updateExchangeConfigurationRequest
);
router.delete('/:id', revokeExchangeConfigurationRequest);
router.put(
    '/:id/authorization',
    [body('datatypes', 'Field should be a non empty array').exists().isArray()],
    validate,
    updateExchangeConfigurationAuthorizations
);
router.delete(
    '/:id/authorization',
    revokeExchangeConfigurationRequestAuthorizations
);

export default router;
