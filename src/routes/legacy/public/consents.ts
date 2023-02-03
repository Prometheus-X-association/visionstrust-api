import { Router } from 'express';
import {
    downloadConsent,
    getConsentAdvancement,
} from '../../../controllers/legacy/public/consents';

const router = Router();

router.get('/download/format', downloadConsent);

// TODO Shouldn't be a render
router.get('/status/:consentId', getConsentAdvancement);

export default router;
