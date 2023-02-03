import { Router } from 'express';
import {
    allDatasets,
    createDataset,
    deleteDataset,
    incomingDatasetRequests,
    oneDataset,
    oneDatasetRequest,
    outgoingDatasetRequests,
    searchDataset,
    updateDataset,
    requestDataset,
    authorizeDatasetRequest,
} from '../../../controllers/v1/protected/datasets';

import { apiAuthenticate } from '../../middleware/auth';

const router = Router();

router.get('/search', searchDataset);

router.get('/', apiAuthenticate, allDatasets);
router.get('/:id', apiAuthenticate, oneDataset);
router.post('/', apiAuthenticate, createDataset);
router.delete('/', apiAuthenticate, deleteDataset);
router.put('/', apiAuthenticate, updateDataset);

router.get('/request/in', apiAuthenticate, incomingDatasetRequests);
router.get('/request/out', apiAuthenticate, outgoingDatasetRequests);

router.get('/request/:requestId', apiAuthenticate, oneDatasetRequest);
router.post('/request/:datasetId', apiAuthenticate, requestDataset);
router.post(
    '/request/:requestId/authorize',
    apiAuthenticate,
    authorizeDatasetRequest
);

export default router;
