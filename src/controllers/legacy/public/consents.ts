import {
    ConsentExchange,
    DataType,
    DataUseExchange,
    Processor,
    Service,
} from '@visionsofficial/visions-public-models';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { formatXml } from '../../../utils/utils';

import moment from 'moment';

/**
 * Kept for reference - Not sure what it's about
 * @author Yanick Kifack
 * @deprecated
 */
export const downloadConsent = async (req: Request, res: Response) => {
    const { format, consentId } = req.query;

    const consentExchange = await ConsentExchange.findById(consentId)
        .populate<{
            userExportId: Pick<
                HydratedDocument<IIdentifier>,
                'user' | 'service'
            >;
        }>('userExportId', 'user service')
        .populate<{
            userImportId: Pick<
                HydratedDocument<IIdentifier>,
                'user' | 'service'
            >;
        }>('userImportId', 'user service');
    const serviceExport = await Service.findById(
        consentExchange.userExportId.service
    );
    const serviceImport = await Service.findById(
        consentExchange.userImportId.service
    );

    const dataUseExchange = await DataUseExchange.findById(
        consentExchange.dataUseExchange
    ).populate<{
        purpose: Pick<
            HydratedDocument<IPurpose>,
            'name' | 'description' | '_id'
        >;
    }>('purpose', 'name description');
    const processors = await Processor.find({
        $or: [{ service: serviceExport.id }, { service: serviceImport.id }],
    });

    const piiControllers = [];

    for (let i = 0; i < processors.length; i++) {
        const processor = processors[i];

        if (processor.user.name) {
            piiControllers.push({
                onBehalf: true,
                contact: processor.user.name,
                address: processor.user.address,
                email: processor.user.email,
                phone: processor.user.phone,
            });
        } else {
            const service = await Service.findById(
                processor.subcontractorService
            );
            piiControllers.push({
                name: service.name,
            });
        }
    }
    if (parseInt(format.toString()) === 1) {
        const result: any = {
            version: '1.0',
            jurisdiction: 'jury',
            consentTimestamp: consentExchange.timestamp,
            collectionMethod: 'method',
            consentReceiptID: consentExchange.id,
            publicKey: 'fdd',
            language: 'fr',
            piiPrincipalId: consentExchange.userExportId.user,
            piiControllers,
            policyUrl: 'touch.com',
            services: [
                {
                    service: serviceImport.name,
                    purposes: [dataUseExchange.purpose.name],
                },
                {
                    service: serviceExport.name,
                    purposes: [dataUseExchange.purpose.name],
                },
            ],
            sensitive: true,
            spiCat: '',
        };

        return res
            .status(200)
            .attachment(`consent-kantara.json`)
            .send(JSON.stringify(result, null, '\t'));
    } else {
        const data = consentExchange.data;
        let result = '';
        for (let i = 0; i < data.length; i++) {
            const datatype = await DataType.findById(data[i].datatype);

            if (datatype) {
                result += `
           <Data id="${datatype.id}" type="PROFILE">
                <Access mode="STORE" />
                <Datalife unit="" value="1" />
            </Data>
          `;
            }
        }

        const template = `
        <?xml version="1.0" encoding="UTF-8"?>
        <Consent xmlns="http://meity.gov.in" timestamp="${moment().format(
            'YYYY-MM-DD, h:mm:ss'
        )}">
          <Def id="" expiry="" revocable="" />
          <Collector type="URI" value="https://visionstrust.com" />
          <DataConsumer type="URI" value="${serviceImport.urls.website}">
              <Notify event="REVOKE" type="URI" value="${
                  serviceImport.urls.dataExport
              }" />
          </DataConsumer>
          <DataProvider type="URI" value="${serviceExport.urls.website}">
              <Notify event="REVOKE" type="URI" value="${
                  serviceExport.urls.dataImport
              }" />
          </DataProvider>
          <User type="AADHAAR|MOBILE|PAN|PASSPORT|..." value="" name="" issuer="">
              <Account dpID="${
                  consentExchange.userExportId.user
              }" dcID="" cmID="" />
          </User>
          <Revoker type="URI" value="" />
          <ConsentUse logTo="" type="URI" />
          <DataAccess logTo="${serviceImport.urls.dataExport}" type="URI" />
          <Data-Items>
             ${result}
          </Data-Items>
          <Purpose code="${dataUseExchange.purpose._id}" defUri="${
            dataUseExchange.purpose.name
        }" refUri="${dataUseExchange.purpose.description}" />
          <Signature value="" />
        </Consent>
      `;

        return res
            .status(200)
            .attachment(`consent-indian.xml`)
            .send(formatXml(template));
    }
};

/**
 * Returns the consent advancement
 * @todo Shouldn't be a render
 * @deprecated
 */
export const getConsentAdvancement = async (req: Request, res: Response) => {
    const consentExchange = await ConsentExchange.findById(
        req.params.consentId
    );
    const dataUseExchange = await DataUseExchange.findById(
        consentExchange.dataUseExchange
    ).populate<{
        purpose: HydratedDocument<IPurpose>;
        serviceImport: HydratedDocument<IService>;
    }>('purpose serviceImport');

    let serviceImportName = null;
    if (dataUseExchange && dataUseExchange.serviceImport) {
        serviceImportName = dataUseExchange.serviceImport.name;
    }

    const consent = {
        id: consentExchange.id,
        status: consentExchange.status,
        verified: consentExchange.verified,
        timestamp: consentExchange.timestamp,
        serviceImport: serviceImportName,
        flow: consentExchange.flow,
    };

    res.render('consentStatus', { consent });
};
