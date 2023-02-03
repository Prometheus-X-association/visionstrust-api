import { Router } from 'express';
import { body } from 'express-validator';
import {
    createContract,
    getContractsOnBlockchain,
    getMyContracts,
    getOneContract,
    revokeContractOnBlockchain,
    uploadClientSignature,
    uploadProviderSignature,
    verifyContractOnBlockchain,
} from '../../../controllers/v1/protected/contracts';
import { apiAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';

const router = Router();

router.use(apiAuthenticate);

router.get('/', getMyContracts);
router.get('/:id', getOneContract);
router.post(
    '/',
    [
        body('serviceImportId').not().isEmpty().isString(),
        body('serviceExportId').not().isEmpty().isString(),
        body('purposeId').not().isEmpty().isString(),
        body('datatypes').exists(),
    ],
    validate,
    createContract
);

router.get('/blockchain', getContractsOnBlockchain);
router.post('/blockchain/:id/sign/provider', uploadProviderSignature);
router.post('/blockchain/:id/sign/client', uploadClientSignature);
router.get('/blockchain/:id/verify', verifyContractOnBlockchain);
router.post('/blockchain/:id/revoke', revokeContractOnBlockchain);

export default router;
