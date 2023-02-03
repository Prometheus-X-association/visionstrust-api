import { Router } from 'express';
import {
    getGlobalDataType,
    getGlobalDataTypes,
} from '../../../controllers/v1/public/globalDataTypes';

const router = Router();

router.get('/', getGlobalDataTypes);
router.get('/:id', getGlobalDataType);

export default router;
