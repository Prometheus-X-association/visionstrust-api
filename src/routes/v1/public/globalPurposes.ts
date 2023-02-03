import { Router } from 'express';
import {
    getGlobalPurpose,
    getGlobalPurposes,
} from '../../../controllers/v1/public/globalPurposes';

const router = Router();

router.get('/', getGlobalPurposes);
router.get('/:id', getGlobalPurpose);

export default router;
