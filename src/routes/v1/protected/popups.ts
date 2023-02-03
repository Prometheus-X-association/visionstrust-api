import { Router } from 'express';
import { check } from 'express-validator';
import {
    getAllExchangePopups,
    getExportPopup,
    getImportPopup,
} from '../../../controllers/v1/protected/popups';
import { apiAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';

const router = Router();

router.get('/', apiAuthenticate, getAllExchangePopups);

router.post(
    '/import',
    apiAuthenticate,
    [
        check(
            'purpose',
            'Missing or empty Purpose ID. The purpose ID is needed in order to know what data should be loaded in the popup.'
        )
            .not()
            .isEmpty()
            .trim()
            .escape(),
        check(
            'emailImport',
            'Missing or empty email for the current user in your service.'
        )
            .isEmail()
            .normalizeEmail(),
    ],
    validate,
    getImportPopup
);

router.post(
    '/export',
    apiAuthenticate,
    [
        check(
            'purpose',
            'Missing or empty Purpose ID. The purpose ID is needed in order to know what data should be loaded in the popup.'
        )
            .not()
            .isEmpty()
            .trim()
            .escape(),
        check(
            'emailExport',
            'Missing or empty email for the current user in your service.'
        )
            .isEmail()
            .normalizeEmail(),
    ],
    validate,
    getExportPopup
);

export default router;
