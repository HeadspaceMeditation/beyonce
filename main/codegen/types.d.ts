export declare type Keys = {
    partition: string;
    sort: string[];
};
export declare type Fields = {
    [fieldName: string]: string;
};
export declare type ModelDefinition = Keys & Fields;
export declare type ModelDefinitions = {
    Partitions: {
        [partition: string]: string[];
    };
    Models: {
        [modelName: string]: ModelDefinition;
    };
};
export declare type Model = {
    name: string;
    partition: Keys["partition"];
    sk: string[];
    fields: Fields;
};
export declare type ModelSet = Model[];
