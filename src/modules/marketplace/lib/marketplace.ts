import {
    MarketplaceAccess,
    Service,
} from '@visionsofficial/visions-public-models';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { HydratedDocument, LeanDocument, Types } from 'mongoose';
import { MarketplaceError } from './errors';

const GALAXY_SELECT = '_id name description logo galaxy urls';

type ObjectIdQuery = {
    $or: { _id: Types.ObjectId | string }[];
};

/**
 * Returns the service query for services in the marketplace
 * @author Felix Bole
 */
export const getMarketplaceServicesQuery = async () => {
    try {
        const marketplaceAccess = await MarketplaceAccess.findOne().lean();
        const query: ObjectIdQuery = { $or: [] };
        for (const s of marketplaceAccess.services) {
            query.$or.push({ _id: s });
        }
        return query;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Returns the latest registered services in the marketplace
 * @returns Service[]
 */
export const getLastRegistered = async () => {
    try {
        const ma = await MarketplaceAccess.findOne().lean();
        const query: ObjectIdQuery = { $or: [] };

        for (
            let i = ma.services.length - 1;
            i > ma.services.length - 3 || i === 0;
            i--
        ) {
            query.$or.push({ _id: ma.services[i - 1] });
        }

        if (!query.$or.length) return [];

        const services = await Service.find(query)
            .sort({ name: 1 })
            .select(GALAXY_SELECT)
            .lean();
        return services;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Verifies the validity of a global exchange authorization
 * by checking for both services inside a Marketplace access config
 * @author Felix Bole
 */
export const checkAuthorizationInMarketplace = async (
    serviceImportId: Types.ObjectId,
    serviceExportId: Types.ObjectId
) => {
    try {
        const services: Types.ObjectId[] = [serviceImportId, serviceExportId];
        const authorization =
            await MarketplaceAccess.findOne().withMultipleServices(services);

        return authorization ? true : false;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Returns the services that are available for exchange
 * @author Felix Bole
 */
export const getAvailableServices = async (
    serviceId: Types.ObjectId | string,
    populateServices = false
) => {
    try {
        const marketplaceAccess = await MarketplaceAccess.findOne().byService(
            serviceId
        );

        if (!marketplaceAccess) return [];

        const services = marketplaceAccess.services;
        let result = [];

        const query: ObjectIdQuery = { $or: [] };
        for (const s of services) {
            query.$or.push({ _id: s });
        }

        if (populateServices && query.$or.length) {
            result = await Service.find(query)
                .select(`${GALAXY_SELECT} datatypes purposes`)
                .sort({ name: 1 })
                .populate('datatypes')
                .populate('purposes')
                .lean();
        } else {
            result = await Service.find(query)
                .select(GALAXY_SELECT)
                .sort({ name: 1 })
                .lean();
        }

        return result;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Verifies if a service is present in a marketplace, whatever the marketplace is
 * @author Felix Bole
 */
export const isServiceInMarketplace = async (
    serviceId: Types.ObjectId | string
) => {
    try {
        const marketplace = await MarketplaceAccess.findOne({
            services: serviceId,
        });
        return marketplace ? true : false;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Gets the service if the service is in a marketplace
 * @author Felix Bole
 */
export const getService = async (serviceId: Types.ObjectId | string) => {
    try {
        const isInMarketplace = await isServiceInMarketplace(serviceId);
        if (!isInMarketplace) return null;

        const service = await Service.findById(serviceId).select(GALAXY_SELECT);
        return service;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

type MarketplaceQueryOptions = {
    lean?: boolean;
    populate?: boolean;
    select?: string[];
};

const DEFAULT_GET_SERVICES_OPTIONS: MarketplaceQueryOptions = {
    lean: true,
    populate: false,
    select: [],
};

/**
 * Returns all services in the marketplace
 * @todo Review to only pass lean as parameter
 * @author Felix Bole
 */
const getServices = async (options?: MarketplaceQueryOptions) => {
    try {
        options = {
            ...DEFAULT_GET_SERVICES_OPTIONS,
            ...options,
        };

        const query = await getMarketplaceServicesQuery();

        let services;
        if (options.lean) {
            services = await Service.find(query)
                .sort({ name: 1 })
                .select(GALAXY_SELECT)
                .lean();
        } else {
            services = await Service.find(query)
                .sort({ name: 1 })
                .select(GALAXY_SELECT);
        }

        return services;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Find user services in a marketplace
 * @author Felix Bole
 */
export const getUserServices = async (
    identifiers: HydratedDocument<IIdentifier>[]
) => {
    try {
        const services = await getServices();
        const finalServices: LeanDocument<IService>[] = [];
        for (const id of identifiers) {
            if (!id.service) continue;
            const serviceId = id.service;
            const service = services.find(
                (s) => s._id.toString() === serviceId.toString()
            );
            if (service) finalServices.push(service);
        }

        return finalServices;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};

/**
 * Finds the services in a marketplace from a global purpose
 * @author Felix Bole
 */
export const getServicesFromGlobalPurpose = async (
    globalPurposeId: Types.ObjectId | string,
    limit?: number
) => {
    try {
        const query = await getMarketplaceServicesQuery();
        const services = await Service.find(query)
            .select(`${GALAXY_SELECT} purposes`)
            .sort({ name: 1 })
            .populate<{ purposes: HydratedDocument<IPurpose>[] }>(
                'purposes',
                'name description globalPurpose'
            )
            .lean();

        const filtered = [];
        for (const s of services) {
            if (limit && filtered.length === limit) break;
            for (const p of s.purposes) {
                if (
                    p.globalPurpose &&
                    p.globalPurpose.toString() === globalPurposeId.toString()
                ) {
                    filtered.push(s);
                    break;
                }
            }
        }

        return filtered;
    } catch (err) {
        throw new MarketplaceError(err.message);
    }
};
