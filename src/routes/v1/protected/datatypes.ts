import { Router } from 'express';
import { apiAuthenticate } from '../../middleware/auth';
import {
    createDataType,
    deleteDataType,
    getOwnedDataType,
    getOwnedDataTypes,
    updateDataType,
} from '../../../controllers/v1/protected/datatypes';

const router = Router();

router.use(apiAuthenticate);

router.get('/', getOwnedDataTypes);
router.post('/', createDataType);
router.get('/:id', getOwnedDataType);
router.put('/:id', updateDataType);
router.delete('/:id', deleteDataType);

export default router;
