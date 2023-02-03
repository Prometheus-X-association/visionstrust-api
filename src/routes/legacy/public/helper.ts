import { Router } from 'express';
import {
    getAccessToken,
    getPurposeDataTypes,
    getSerciceDataTypes,
    validateEmail,
} from '../../../controllers/legacy/public/helper';

const router = Router();

router.get('/:serviceImport/:serviceExport/:purpose/:token', validateEmail);
router.post('/access/token', getAccessToken);
router.get('/datatypes/:purposeId', getPurposeDataTypes);
router.get('/datatypes/service/:serviceId', getSerciceDataTypes);

export default router;
