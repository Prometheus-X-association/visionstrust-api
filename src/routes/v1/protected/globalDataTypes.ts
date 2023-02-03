import { Router } from 'express';
import {
    createDataTypeToGlobalDataTypeAssociation,
    deleteDataTypeToGlobalDataTypeAssociation,
    getAssociatedDataTypes,
    getDataTypeToGlobalDataTypeAssociations,
    updateDataTypeToGlobalDataTypeAssociation,
} from '../../../controllers/v1/protected/globalDataTypes';

import { apiAuthenticate } from '../../middleware/auth';

const router = Router();
router.use(apiAuthenticate);

router.get('/', getDataTypeToGlobalDataTypeAssociations);
router.get('/:id', getAssociatedDataTypes);
router.post('/:id', createDataTypeToGlobalDataTypeAssociation);
router.put('/:id', updateDataTypeToGlobalDataTypeAssociation);
router.delete('/:datatypeId', deleteDataTypeToGlobalDataTypeAssociation);

export default router;
