import { Router } from 'express';
import {
    getAllServices,
    getServiceInfo,
    updateService,
} from '../../../controllers/v1/protected/services';

import { apiAuthenticate } from '../../middleware/auth';

const router = Router();

router.use(apiAuthenticate);

router.get('/', getAllServices);
router.get('/me', getServiceInfo);
router.put('/', updateService);

export default router;
