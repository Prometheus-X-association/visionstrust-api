import { Router } from 'express';
import { check } from 'express-validator';
import {
    addImportedDataType,
    createPurpose,
    getConfiguredExchangeServices,
    getConfiguredPurposesWithService,
    getOwnedPurpose,
    getOwnedPurposeInformation,
    getOwnedPurposes,
    getPurposeInfo,
    removeImportedDataType,
    updatePurpose,
} from '../../../controllers/v1/protected/purposes';

import { apiAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';

const router = Router();

router.use(apiAuthenticate);

// router.delete('/:id', deletePurpose);

router.get(
    '/info/:purposeId',

    [check('purposeId').not().isEmpty().trim().escape()],
    validate,
    getPurposeInfo
);

router.get('/list', getOwnedPurposeInformation);

router.get('/list/exchanges', getConfiguredExchangeServices);

router.get(
    '/list/exchanges/:serviceName',
    [check('serviceName').not().isEmpty().escape()],
    validate,
    getConfiguredPurposesWithService
);

router.get('/', getOwnedPurposes);
router.post(
    '/',
    [
        check('name').not().isEmpty().trim().escape(),
        check('description').not().isEmpty().trim().escape(),
    ],
    createPurpose
);
router.get('/:id', getOwnedPurpose);
router.put('/:id', updatePurpose);

router.post(
    '/:id/datatype',
    [check('dataTypeId').not().isEmpty().isString().trim()],
    validate,
    addImportedDataType
);
router.put(
    '/:id/datatype',
    [check('dataTypeId').not().isEmpty().isString().trim()],
    validate,
    removeImportedDataType
);

export default router;
