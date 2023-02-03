import { Router } from 'express';
import {
    all,
    create,
    deleteTermsOfUse,
    one,
    update,
} from '../../../controllers/v1/protected/termsOfUse';
import { apiAuthenticate } from '../../middleware/auth';

const router = Router();

router.use(apiAuthenticate);

router.get('/', all);
router.get('/:id', one);
router.post('/', create);
router.delete('/', deleteTermsOfUse);
router.put('/', update);

export default router;
