import { Router } from 'express';
import {
    createConsentExchange,
    verifyTokenAndUserIdentity,
} from '../../../controllers/legacy/protected/consents';
import {
    attachToken,
    startExportExchange,
    verifyConsentOnVerifiedAccountCreation,
} from '../../../controllers/v1/protected/consents';
import { getExportPopup } from '../../../controllers/v1/protected/popups';

import { apiAuthenticate } from '../../middleware/auth';
import {
    setForStartExportExchange,
    setForVerifiedAccountCreation,
} from '../../middleware/legacy';

const router = Router();

// * Used by legacy partners
router.post('/popup/export', apiAuthenticate, getExportPopup);
router.post('/token', apiAuthenticate, attachToken);
router.post('/verify', apiAuthenticate, verifyTokenAndUserIdentity);
router.post(
    '/exchange/import/:purpose',
    apiAuthenticate,
    createConsentExchange
);
router.post(
    '/exchange/export/:purpose',
    apiAuthenticate,
    setForStartExportExchange,
    startExportExchange
);
router.post(
    '/exchange/verifiedaccount',
    apiAuthenticate,
    setForVerifiedAccountCreation,
    verifyConsentOnVerifiedAccountCreation
);

export default router;
