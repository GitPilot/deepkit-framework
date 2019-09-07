import {BehaviorSubject, TeardownLogic, Subject} from "rxjs";
import {tearDown} from "@marcj/estdlib-rxjs";
import {IdInterface} from "./contract";
import {ClassType} from "@marcj/estdlib";
import {Entity, Field, getEntitySchema, classToPlain, RegisteredEntities, plainToClass, FieldAny} from "@marcj/marshal";

@Entity('@error:json')
export class JSONError {
    constructor(@FieldAny().asName('json') public readonly json: any) {
    }
}


export class ValidationErrorItem {
    constructor(
        @Field().asName('path') public readonly path: string,
        @Field().asName('message') public readonly message: string,
        @Field().asName('code') public readonly code: string,
    ) {
    }
}

@Entity('@error:validation')
export class ValidationError {
    constructor(
        @Field(ValidationErrorItem).asArray().asName('errors') public readonly errors: ValidationErrorItem[]
    ) {
    }
}

@Entity('@error:parameter')
export class ValidationParameterError {
    constructor(
        @Field().asArray().asName('controller') public readonly controller: string,
        @Field().asArray().asName('action') public readonly action: string,
        @Field().asArray().asName('arg') public readonly arg: number,
        @Field(ValidationErrorItem).asArray().asName('errors') public readonly errors: ValidationErrorItem[]
    ) {
    }
}

export function getSerializedErrorPair(error: any): [string, any] {
    if (error instanceof Error) {
        return ['@error:default', error.message];
    } else {
        const entityName = getEntitySchema(error['constructor'] as ClassType<typeof error>).name;
        if (entityName) {
            return [entityName, classToPlain(error['constructor'] as ClassType<typeof error>, error)];
        }
    }

    return ['@error:default', error];
}

export function getUnserializedError(entityName: string, error: any): any {
    if (!entityName || entityName === '@error:default') {
        return new Error(error);
    }

    if (entityName) {
        const classType = RegisteredEntities[entityName];

        if (!classType) {
            throw new Error(`Entity ${entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
        }

        return plainToClass(classType, error);
    }
}

export class ReactiveSubQuery<T> {
    constructor(public classType: ClassType<T>, public query: FilterQuery<T>, public field: string) {
    }

    static create<T>(classType: ClassType<T>, query: FilterQuery<T>): ReactiveSubQuery<T> {
        return new ReactiveSubQuery(classType, query, 'id');
    }

    static createField<T>(classType: ClassType<T>, field: string, query: FilterQuery<T>) {
        return new ReactiveSubQuery(classType, query, field);
    }
}

export type Query<T> = {
    $eq?: T;
    $ne?: T;
    $or?: Array<FilterQuery<T>>;
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $mod?: number[];
    $in?: Array<T>;
    $nin?: Array<T>;
    $not?: FilterQuery<T>;
    $type?: any;
    $all?: Array<Partial<T>>;
    $size?: number;
    $nor?: Array<FilterQuery<T>>;
    $and?: Array<FilterQuery<T>>;
    $regex?: RegExp | string;
    $exists?: boolean;
    $options?: "i" | "g" | "m" | "u";

    //special glut types
    $sub?: ReactiveSubQuery<any>;
    $parameter?: string;
};

export type FilterQuery<T> = {
    [P in keyof T]?: Query<T[P]> | T[P];
} | Query<T>;


export class StreamBehaviorSubject<T> extends BehaviorSubject<T> {
    public readonly appendSubject = new Subject<T>();
    protected nextChange?: Subject<void>;

    protected nextOnAppend = false;
    protected unsubscribed = false;

    protected lastValue: T;

    protected teardowns: TeardownLogic[] = [];

    constructor(
        item: T,
        teardown?: TeardownLogic,
    ) {
        super(item);
        this.lastValue = item;
        if (teardown) {
            this.teardowns.push(teardown);
        }
    }

    public isUnsubscribed(): boolean {
        return this.unsubscribed;
    }

    get nextStateChange() {
        if (!this.nextChange) {
            this.nextChange = new Subject<void>();
        }
        return this.nextChange.toPromise();
    }

    addTearDown(teardown: TeardownLogic) {
        this.teardowns.push(teardown);
    }

    get value(): T {
        return this.lastValue;
    }

    /**
     * This method differs to BehaviorSubject in the way that this does not throw an error
     * when the subject is closed/unsubscribed.
     */
    getValue(): T {
        if (this.hasError) {
            throw this.thrownError;
        } else {
            return this.lastValue;
        }
    }

    next(value: T): void {
        super.next(value);
        this.lastValue = value;

        if (this.nextChange) {
            this.nextChange.complete();
            delete this.nextChange;
        }
    }

    activateNextOnAppend() {
        this.nextOnAppend = true;
    }

    append(value: T): void {
        this.appendSubject.next(value);

        if (this.nextOnAppend) {
            this.next(this.getValue() as any + value);
        } else {
            if ('string' === typeof value) {
                if (!this.lastValue) (this.lastValue as any) = '';
                (this.lastValue as any) = (this.lastValue as any) + value;
            }
        }
    }

    async unsubscribe(): Promise<void> {
        if (this.unsubscribed) return;
        this.unsubscribed = true;

        for (const teardown of this.teardowns) {
            await tearDown(teardown);
        }

        await super.unsubscribe();
    }
}

export class EntitySubject<T extends IdInterface | undefined> extends StreamBehaviorSubject<T> {
    /**
     * Patches are in class format.
     */
    public readonly patches = new Subject<{ [path: string]: any }>();
}

export type JSONEntity<T> = {
    [P in keyof T]?: any;
};
