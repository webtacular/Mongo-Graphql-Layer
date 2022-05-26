import { ObjectId } from "mongodb";
import { merge } from "../merge";

import schemaObject from "./types/objects/object";
import schemaValue from "./types/value";
import schemaNested from "./types/objects/nested";
import baseObject from "./types/objects/base";

import { IHookBank, INestedValues, IOutput, IProcessedObject, IProcessedValue } from "./index.interfaces";

export function parse(object: schemaObject.init): IOutput {
    let returnable: IProcessedObject = { nested: {}, values: {}, object: {} };
    let hookBank: IHookBank = {};
    let clearObjectArr: Array<() => void> = [];

    const walk = (
        schema: schemaObject.init | baseObject.ValueInterface,
        parents: Array<schemaObject.init | schemaNested.init> = [],
        currentParent: ObjectId = new ObjectId(),
        parentsId: Array<string> = [],
        parentsKeys: Array<string> = []): void => 
    {

        // ---------------------------------[ Object ]--------------------------------- //
        // Recurse through the schema if the schema
        // an instance of schemaObject.init
        if(schema instanceof schemaObject.init) {
            // Push the clear function to the array
            clearObjectArr.push(() => schema.clearObject());

            merge(returnable.object, {
                [schema.identifier.toString()]: schema
            });

            // Recurse
            walk(
                schema.obj, 
                [...parents, schema], 
                schema.identifier,
                [...parentsId, schema.identifier.toString()],
                [...parentsKeys, schema.options.name]
            );
        } 
        
        // ----------------------------------[ Value ]--------------------------------- //
        else {
            
            const objKeys: string[] = Object.keys(schema);

            // Temporary object to store the processed values
            let temporaryReturnable: any = {};

            // Nested values
            let nestedValues: INestedValues = {};

            // Loop trough the values
            for(let i: number = 0; i < objKeys.length; i++) {

                // ------------------------------[ Nested ]---------------------------- //
                if(schema[objKeys[i]] instanceof schemaNested.init) {

                    // Get the nested object
                    const value = schema[objKeys[i]] as schemaNested.init;

                    // set the value key
                    value.key = objKeys[i];
                    
                    // Set the parents
                    value.setParents(parents);

                    // Set the key name
                    value.collectionizeObject(objKeys[i]);

                    // Add self to the nested Values object
                    nestedValues[value.key] = { identifier: value.identifier, get: () => value }

                    // Merge the returnable
                    merge(returnable.nested, { [value.identifier.toString()]: value });

                    // Push the clear function to the array
                    clearObjectArr.push(() => value.clearObject());

                    // Recurse
                    walk(
                        value.obj,
                        [...parents, value],
                        value.identifier,
                        [...parentsId, value.identifier.toString()],
                        [...parentsKeys, objKeys[i]]
                    );

                    // Stop the loop from progressing
                    continue;
                }

                // -----------------------------[ General ]---------------------------- //
                const key = objKeys[i],
                    value = schema[key] as schemaValue.init;

                // Set the value key
                value.key = key;

                // Process the value
                value.additonalValues();
                value.groupHooks(hookBank);
                value.setParent({
                    identifier: currentParent,
                    get: () => parents[parents.length - 1]
                });
                value.generateMask(parents[parents.length - 1].mask);

                // --------------------------[ Returnable ]-------------------------- //
                merge(temporaryReturnable, {
                    [key]: value
                });

            }

            // Generate the unique id for this value collection
            const valuesID = new ObjectId();

            // merge the returnable with the returnable object
            merge(returnable.values, {
                [valuesID.toString()]: {
                    parent: {
                        identifier: parents[parents.length - 1].identifier,
                        get: () => parents[parents.length - 1]
                    },
                    identifier: valuesID,
                    values: temporaryReturnable,
                    nested: nestedValues,
                } as IProcessedValue
            });
        }
    }

    // Walk through the object
    walk(object);

    // This is done for memory reasons,
    // as we don't want to keep 375634567 
    // redundant objects in memory
    clearObjectArr.forEach(func => func());

    return {
        processed: returnable,
        hookBank
    }
}


const schema = parse(new schemaObject.init({
    collectionName: 'config',
    databaseName: 'test',
    name: 'config',
    collectionize: true,
}, {
    id: new schemaValue.init({
        type: 'id',
        unique: true,

        mask: [ '_id' ]
    }),

    userName: new schemaValue.init({
        type: 'string',
        unique: true,
    }),

    loginHistory: new schemaNested.init({
        array: true,
    }, {
        ip: new schemaValue.init({
            type: 'string',
            description: 'The ip address of the user',
            mask: [ 'ip_latest' ]
        }),

        loginDate: new schemaValue.init({
            type: 'string',
            description: 'The date of the login',
            mask: [ 'login_date' ]
        }),
    }),
}));

console.log(JSON.stringify(schema, null, 2));