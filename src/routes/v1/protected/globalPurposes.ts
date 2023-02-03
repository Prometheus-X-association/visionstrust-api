import { Router } from 'express';
import {
    createPurposeToGlobalPurposeAssociation,
    deletePurposeToGlobalPurposeAssociation,
    getAssociatedPurposes,
    getPurposeToGlobalPurposesAssociations,
    updatePurposeToGlobalPurposeAssociation,
} from '../../../controllers/v1/protected/globalPurposes';

import { apiAuthenticate } from '../../middleware/auth';

const router = Router();
router.use(apiAuthenticate);

router.get('/', getPurposeToGlobalPurposesAssociations);
router.get('/:id', getAssociatedPurposes);
router.post('/:id', createPurposeToGlobalPurposeAssociation);
router.put('/:id', updatePurposeToGlobalPurposeAssociation);
router.delete('/:purposeId', deletePurposeToGlobalPurposeAssociation);

export default router;
