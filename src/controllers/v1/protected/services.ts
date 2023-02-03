import { Service } from '@visionsofficial/visions-public-models';
import { ModelConverter } from '@visionsofficial/visions-public-models/lib/utils';
import { NextFunction, Request, Response } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { Logger } from '../../../libs/loggers';

/**
 * Returns all services
 * @author Felix Bole
 */
export const getAllServices = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const services = await Service.find().populate('datatypes').populate({
            path: 'purposes',
            populate: 'datatypes importedDatatypes.datatype',
        });

        const result = [];

        for (const service of services) {
            result.push(ModelConverter.toServiceModel(false, service));
        }

        return res.status(200).json({ result });
    } catch (error) {
        Logger.error({ message: 'unknown error', location: 'getAllServices' });

        next(error);
    }
};

/**
 * Returns the service information to its owner
 * @author Felix Bole
 */
export const getServiceInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const service = await Service.findById(req.service)
            .populate('datatypes')
            .populate({
                path: 'purposes',
                populate: 'datatypes importedDatatypes.datatype',
            });

        return res
            .status(200)
            .json(ModelConverter.toServiceModel(true, service));
    } catch (error) {
        Logger.error({ message: error.message });
        next(error);
    }
};

/**
 * Updates the service
 * @author Felix Bole
 */
export const updateService = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            name,
            description,
            authMethod,
            isDataUser,
            isDataProvider,
            isInteropService,
            dataExport,
            consentImport,
            dataImport,
            consentExport,
            authURL,
            registerURL,
            termsOfUse,
            legalNotices,
            website,
            hasLegallyBindingName,
            streetAddress,
            locality,
            countryName,
            hasLegalForm,
            hasJurisdiction,
            hasSalesTaxID,
            hasLegalRegistrationNumber,
            contactGivenName,
            contactFamilyName,
            contactEmail,
            contactTechnicalGivenName,
            contactTechnicalFamilyName,
            contactTechnicalEmail,
            type,
        } = req.body;

        const service = await Service.findById(req.service);
        if (!service) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Service not found',
            });
        }

        service.name = name || service.name;
        service.description = description || service.description;
        service.authMethod = authMethod || service.authMethod;
        service.checks.isDataProvider =
            isDataProvider || service.checks.isDataProvider;
        service.checks.isDataUser = isDataUser || service.checks.isDataUser;
        service.checks.isInteropService =
            isInteropService || service.checks.isInteropService;
        service.urls.dataExport = dataExport || service.urls.dataExport;
        service.urls.dataImport = dataImport || service.urls.dataImport;
        service.urls.consentExport =
            consentExport || service.urls.consentExport;
        service.urls.consentImport =
            consentImport || service.urls.consentImport;
        service.urls.authURL = authURL || service.urls.authURL;
        service.urls.registerURL = registerURL || service.urls.registerURL;
        service.urls.termsOfUse = termsOfUse || service.urls.termsOfUse;
        service.urls.legalNotices = legalNotices || service.urls.legalNotices;
        service.urls.website = website || service.urls.website;
        service.selfDescription.hasWebAddress =
            website || service.selfDescription.hasWebAddress;
        service.selfDescription.hasLegallyBindingName =
            hasLegallyBindingName ||
            service.selfDescription.hasLegallyBindingName;
        service.selfDescription.hasLegallyBindingAddress = {
            streetAddress:
                streetAddress ||
                service.selfDescription.hasLegallyBindingAddress.streetAddress,
            locality:
                locality ||
                service.selfDescription.hasLegallyBindingAddress.locality,
            countryName:
                countryName ||
                service.selfDescription.hasLegallyBindingAddress.countryName,
        };
        service.selfDescription.hasLegalForm =
            hasLegalForm || service.selfDescription.hasLegalForm;
        service.selfDescription.hasJurisdiction =
            hasJurisdiction || service.selfDescription.hasJurisdiction;
        service.selfDescription.hasSalesTaxID =
            hasSalesTaxID || service.selfDescription.hasSalesTaxID;
        service.selfDescription.hasLegalRegistrationNumber =
            hasLegalRegistrationNumber ||
            service.selfDescription.hasLegalRegistrationNumber;
        service.selfDescription.hasIndividualContactLegal = {
            givenName:
                contactGivenName ||
                service.selfDescription.hasIndividualContactLegal.givenName,
            familyName:
                contactFamilyName ||
                service.selfDescription.hasIndividualContactLegal.familyName,
            email:
                contactEmail ||
                service.selfDescription.hasIndividualContactLegal.email,
        };
        service.selfDescription.hasIndividualContactTechnical = {
            givenName:
                contactTechnicalGivenName ||
                service.selfDescription.hasIndividualContactLegal.givenName,
            familyName:
                contactTechnicalFamilyName ||
                service.selfDescription.hasIndividualContactLegal.familyName,
            email:
                contactTechnicalEmail ||
                service.selfDescription.hasIndividualContactLegal.email,
        };
        service.type = type !== undefined ? type : service.type;

        await service.save();
        return restfulResponse(res, 200, service);
    } catch (err) {
        next(err);
    }
};
