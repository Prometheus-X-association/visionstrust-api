import { Router } from 'express';
import { check, body } from 'express-validator';

import { validate } from '../../middleware/validator';
import { apiAuthenticate } from '../../middleware/auth';
import {
    checkForTestingToken,
    checkForTestingValidate,
} from '../../middleware/testing';
import {
    attachToken,
    startExportExchange,
    startImportExchange,
    verifyConsentOnVerifiedAccountCreation,
    verifyInteropConsent,
    verifyTokenAndUserIdentity,
} from '../../../controllers/v1/protected/consents';

const router = Router();

router.use(apiAuthenticate);

router.post(
    '/exchange/import',
    [
        check('datatypes', 'Value is not an array or is an empty array.')
            .isArray()
            .notEmpty(),

        check(
            'emailExport',
            'Missing or invalid user email from the export service.'
        ).isEmail(),

        check(
            'emailImport',
            'Missing or invalid user email from your service.'
        ).isEmail(),

        check('userKey', 'Missing or invalid userKey of the current user.')
            .exists()
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check('serviceExport', 'Missing or invalid Service Export name.')
            .exists()
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check('purpose', 'Missing or invalid purpose ID.')
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    startImportExchange
);

router.post(
    '/exchange/export',
    [
        check('datatypes', 'Value is not an array or is an empty array.')
            .isArray()
            .notEmpty(),

        check(
            'emailExport',
            'Missing or invalid user email from your service.'
        ).isEmail(),

        check(
            'emailImport',
            'Missing or invalid user email from the import service.'
        ).isEmail(),

        check('userKey', 'Missing or empty userKey of the current user.')
            .exists()
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check('purpose', 'Missing or empty purpose ID.')
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check(
            'isNewAccount',
            'Missing or invalid isNewAccount boolean.'
        ).isBoolean(),
    ],
    validate,
    startExportExchange
);

router.post(
    '/exchange/verifiedaccount',
    [
        check('consentId', 'Missing or empty consent ID value.')
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check('userKey', 'Missing or empty userKey of the current user.')
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    verifyConsentOnVerifiedAccountCreation
);

router.post(
    '/exchange/token',
    [
        check('consentId', 'Missing or empty consent ID value.')
            .not()
            .isEmpty()
            .trim()
            .escape(),

        check('token', 'Missing or empty access token.')
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    checkForTestingToken,
    attachToken
);

router.post(
    '/exchange/validate',
    [
        check('consentId', 'Missing or empty consent ID value.')
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    checkForTestingValidate,
    verifyTokenAndUserIdentity
);

router.post(
    '/exchange/interop/verify',
    [body('signedConsent', 'Missing key signedConsent from request payload')],
    validate,
    verifyInteropConsent
);

export default router;
