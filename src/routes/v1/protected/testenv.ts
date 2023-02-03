import { Router } from 'express';
import {
    dataImport,
    findReceivedDataWithSignedConsent,
    getReceivedData,
    internalAttachToken,
    internalConsentExport,
    internalDataExport,
    startExport,
    startInteropExport,
    testValidate,
} from '../../../controllers/v1/protected/testenv';
import { apiAuthenticate } from '../../middleware/auth';
import { checkApplicationJSON } from '../../middleware/checkHeaders';

const router = Router();

router.use(apiAuthenticate);

router.post('/consents/export', startExport);
router.post('/data/import', checkApplicationJSON, dataImport);
router.post('/interop/exchange', startInteropExport);
router.post('/interop/consent/export', internalConsentExport);
router.post('/interop/data/export', internalDataExport);
router.post('/interop/token', internalAttachToken);
router.post('/validate', testValidate);

router.get('/interop/receiveddata/service/:serviceId', getReceivedData);
router.get('/receiveddata/consent', findReceivedDataWithSignedConsent);

export default router;
