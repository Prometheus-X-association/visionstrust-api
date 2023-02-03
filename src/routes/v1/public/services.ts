import { Router } from 'express';
import { createService } from '../../../controllers/v1/public/services';

const router = Router();

router.post('/', createService);

export default router;
