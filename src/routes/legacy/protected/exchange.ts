import { Router } from 'express';
import {
    getAllExchangePurposes,
    getAllExchangePurposesList,
    getExportServices,
    validateDemands,
} from '../../../controllers/legacy/protected/exchange';
import { getImportPopup } from '../../../controllers/v1/protected/popups';
import { apiAuthenticate } from '../../middleware/auth';
import { setForGetImportPopup } from '../../middleware/legacy';

const router = Router();

router.use(apiAuthenticate);

router.get('/:serviceId/exchanges', getAllExchangePurposes);
router.post('/validate', validateDemands);
router.post('/popup/:purpose', setForGetImportPopup, getImportPopup);
router.post('/export-services', getExportServices);
router.post('/purposes/list', getAllExchangePurposesList);

export default router;
