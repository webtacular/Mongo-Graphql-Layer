// This here module is responsible for parsing the request and
// Returning the correct data.

import _ from "lodash";

import SchemaObject from "../../../query/object";
import SchemaValue from "../../../query/value";
import MongoService from '../database'

import mapResponse from '../database/mapResponse';
import constructFilter from '../database/constructFilter';

import { MongoResponseObject } from "../database/interface";
import { RequestDetails } from "../..";

const resolve = async(
    input:  SchemaObject.init,
    requestDetails: RequestDetails,
    client: MongoService
) => {
    const collection = client.getCollection(input.options.databaseName, input.options.collectionName);

    // Start building the projection
    let projection = {};

    // Map the requested resouces
    for(const paramater in requestDetails.filter[input.options.key]){
        // Get the value
        const value = input.obj[paramater];

        // If the paramater is not found in the schema
        // It probably means that the user is trying to access a
        // that was generated by MGL, Such as IsUnique, IsRequired, etc.
        if(!value) {
            // If so, we can just generate the value here and continue
            const value = requestDetails.filter[input.options.key][paramater];

            console.log(value);
            continue;
        }

        // Merge the filters
        _.merge(projection, value.mask);
    }

    // Construct the filter
    const filter: MongoResponseObject = constructFilter(requestDetails.arguments, input);

    // Use the filter to get the data
    const data = await collection.aggregate([
        { $project: projection },
        { $match: filter }
    ]).toArray();

    if(data.length === 0) return undefined;

    // Map the requested resouces back to the schema
    return mapResponse(input, data[0]);
}

export default resolve;