import ICrud, { EntityKey } from './ICrud';
import ICrudPlus from './ICrudPlus';
import IDecorator from './IDecorator';
import Memory, { IOptions as IMemoryOptions } from './Memory';
import {IQueryRawData} from './Local';
import Query from './Query';
import DataSet from './DataSet';
import {
    OptionsToPropertyMixin,
    SerializableMixin,
    ISerializableState as IDefaultSerializableState,
    Record,
    relation
} from '../entity';
import { RecordSet } from '../collection';
import { mixin } from '../util';
import { EntityMarker } from '../_declarations';

interface IOptions extends IMemoryOptions {
    parentProperty?: string;
}

interface ISerializableState extends IDefaultSerializableState {
    _source: Memory;
}

/**
 * Источник, который возвращает «хлебные крошки» в корень иерархии в результате выполнения метода query().
 * @remark
 * "Хлебные крошки" хранятся в виде массива в свойстве "path" метаданных RecordSet's.
 *
 * Давайте создадим иерархический источник и выберем данные с помощью хлебных крошек:
 * <pre>
 *     import {HierarchicalMemory, Query} from 'Types/source';
 *
 *     const goods = new HierarchicalMemory({
 *         data: [
 *             {id: 1, parent: null, name: 'Laptops'},
 *             {id: 10, parent: 1, name: 'Apple MacBook Pro'},
 *             {id: 11, parent: 1, name: 'Xiaomi Mi Notebook Air'},
 *             {id: 2, parent: null, name: 'Smartphones'},
 *             {id: 20, parent: 2, name: 'Apple iPhone'},
 *             {id: 21, parent: 2, name: 'Samsung Galaxy'}
 *         ],
 *         keyProperty: 'id',
 *         parentProperty: 'parent'
 *     });
 *
 *     const laptopsQuery = new Query();
 *     laptopsQuery.where({parent: 1});
 *
 *     goods.query(laptopsQuery).then((response) => {
 *         const items = response.getAll();
 *         items.forEach((item) => {
 *              console.log(item.get('name')); // 'Apple MacBook Pro', 'Xiaomi Mi Notebook Air'
 *         });
 *         items.getMetaData().path.map((item) => {
 *             console.log(item.get('name')); // 'Laptops'
 *         });
 *     }).catch(console.error);
 * </pre>
 * @class Types/_source/HierarchicalMemory
 * @mixes Types/_entity/DestroyableMixin
 * @implements Types/_source/IDecorator
 * @implements Types/_source/ICrud
 * @implements Types/_source/ICrudPlus
 * @mixes Types/_entity/SerializableMixin
 * @author Кудрявцев И.С.
 * @public
 */

/*
 * Source which returns "breadcrumbs" to the root of hierarchy in the result of query() method.
 * @remark
 * "Breadcrumbs" stores as Array in property "path" of RecordSet's meta data.
 *
 * Let's create hierarchical source and select data with breadcrumbs:
 * <pre>
 *     import {HierarchicalMemory, Query} from 'Types/source';
 *
 *     const goods = new HierarchicalMemory({
 *         data: [
 *             {id: 1, parent: null, name: 'Laptops'},
 *             {id: 10, parent: 1, name: 'Apple MacBook Pro'},
 *             {id: 11, parent: 1, name: 'Xiaomi Mi Notebook Air'},
 *             {id: 2, parent: null, name: 'Smartphones'},
 *             {id: 20, parent: 2, name: 'Apple iPhone'},
 *             {id: 21, parent: 2, name: 'Samsung Galaxy'}
 *         ],
 *         keyProperty: 'id',
 *         parentProperty: 'parent'
 *     });
 *
 *     const laptopsQuery = new Query();
 *     laptopsQuery.where({parent: 1});
 *
 *     goods.query(laptopsQuery).then((response) => {
 *         const items = response.getAll();
 *         items.forEach((item) => {
 *              console.log(item.get('name')); // 'Apple MacBook Pro', 'Xiaomi Mi Notebook Air'
 *         });
 *         items.getMetaData().path.map((item) => {
 *             console.log(item.get('name')); // 'Laptops'
 *         });
 *     }).catch(console.error);
 * </pre>
 * @class Types/_source/HierarchicalMemory
 * @mixes Types/_entity/DestroyableMixin
 * @implements Types/_source/IDecorator
 * @implements Types/_source/ICrud
 * @implements Types/_source/ICrudPlus
 * @mixes Types/_entity/SerializableMixin
 * @author Кудрявцев И.С.
 * @public
 */
export default class HierarchicalMemory extends mixin<
    OptionsToPropertyMixin,
    SerializableMixin
>(
    OptionsToPropertyMixin,
    SerializableMixin
) implements IDecorator, ICrud, ICrudPlus {
    /**
     * @cfg {Object} Смотрите {@link Types/_source/Memory#data}.
     * @name Types/_source/HierarchicalMemory#data
     */

    /**
     * @cfg {String|Types/_entity/adapter/IAdapter} Смотрите {@link Types/_source/Memory#adapter}.
     * @name Types/_source/HierarchicalMemory#adapter
     */

    /**
     * @cfg {String|Function} Смотрите {@link Types/_source/Memory#model}.
     * @name Types/_source/HierarchicalMemory#model
     */

    /**
     * @cfg {String|Function} Смотрите {@link Types/_source/Memory#listModule}.
     * @name Types/_source/HierarchicalMemory#listModule
     */

    /**
     * @cfg {Function(Types/_entity/adapter/IRecord, Object):Boolean} Смотрите {@link Types/_source/Memory#filter}.
     * @name Types/_source/HierarchicalMemory#filter
     */

    /**
     * @cfg {String} Смотрите {@link Types/_source/Memory#keyProperty}.
     * @name Types/_source/HierarchicalMemory#keyProperty
     */

    /**
     * @cfg {String} Имя параметра записи, которое содержит идентификатор узла, которому принадлежит другой узел или список.
     * @name Types/_source/HierarchicalMemory#parentProperty
     */

    /*
     * @cfg {String} Record's property name that contains identity of the node another node or leaf belongs to.
     * @name Types/_source/HierarchicalMemory#parentProperty
     */
    protected _$parentProperty: string;

    protected _source: Memory;

    protected get _keyProperty(): string {
        return this._source.getKeyProperty();
    }

    constructor(options?: IOptions) {
        super();
        OptionsToPropertyMixin.call(this, options);
        SerializableMixin.call(this);
        this._source = new Memory(options);
    }

    // region IDecorator

    readonly '[Types/_source/IDecorator]': EntityMarker = true;

    getOriginal<T = Memory>(): T {
        return this._source as any;
    }

    // endregion

    // region ICrud

    readonly '[Types/_source/ICrud]': EntityMarker = true;

    create(meta?: object): Promise<Record> {
        return this._source.create(meta);
    }

    read(key: any, meta?: object): Promise<Record> {
        return this._source.read(key, meta);
    }

    update(data: Record | RecordSet, meta?: object): Promise<void> {
        return this._source.update(data, meta);
    }

    destroy(keys: any | any[], meta?: object): Promise<void> {
        return this._source.destroy(keys, meta);
    }

    query(query?: Query): Promise<DataSet> {
        return new Promise<DataSet>((resolve, reject) => {
            import('Types/collection').then((collection) => {
                this._source.query(query).then((response) => {
                    if (this._$parentProperty) {
                        const hierarchy = new relation.Hierarchy({
                            keyProperty: this._keyProperty,
                            parentProperty: this._$parentProperty
                        });

                        const sourceRecords = new collection.RecordSet({
                            rawData: this._source.data,
                            adapter: this._source.getAdapter(),
                            keyProperty: this._keyProperty
                        });

                        const breadcrumbs = new collection.RecordSet({
                            adapter: this._source.getAdapter(),
                            keyProperty: this._keyProperty
                        });

                        // Extract breadcrumbs as path from filtered node to the root
                        const whereConditions = query.getWhere();
                        if (this._$parentProperty in whereConditions) {
                            const startFromId = whereConditions[this._$parentProperty];
                            let startFromNode = sourceRecords.getRecordById(startFromId);
                            if (startFromNode) {
                                breadcrumbs.add(startFromNode, 0);
                                let node;
                                while (
                                    startFromNode &&
                                    (node = hierarchy.getParent(startFromNode, sourceRecords))
                                ) {
                                    breadcrumbs.add(node, 0);
                                    startFromNode = node.get(this._keyProperty);
                                }
                            }
                        }

                        // Store breadcrumbs as 'path' in meta data
                        const data = response.getRawData() as IQueryRawData;
                        if (data) {
                            const metaData =  data.meta || {};
                            metaData.path = breadcrumbs;
                            data.meta = metaData;
                            response.setRawData(data);
                        }
                    }

                    resolve(response);
                }).catch(reject);
            }).catch((reject));
        });
    }

    // endregion

    // region ICrudPlus

    readonly '[Types/_source/ICrudPlus]': EntityMarker = true;

    merge(target: EntityKey, merged: EntityKey | EntityKey[]): Promise<void> {
        return this._source.merge(target, merged);
    }

    copy(key: EntityKey, meta?: object): Promise<Record> {
        return this._source.copy(key, meta);
    }

    move(items: EntityKey | EntityKey[], target: EntityKey, meta?: object): Promise<void> {
        return this._source.move(items, target, meta);
    }

    // endregion

    // region SerializableMixin

    _getSerializableState(state: IDefaultSerializableState): ISerializableState {
        const resultState: ISerializableState = SerializableMixin.prototype._getSerializableState.call(this, state);
        resultState._source = this._source;

        return resultState;
    }

    _setSerializableState(state: ISerializableState): Function {
        const fromSerializableMixin = SerializableMixin.prototype._setSerializableState(state);
        return function(): void {
            fromSerializableMixin.call(this);
            this._source = state._source;
        };
    }

    // endregion
}

Object.assign(HierarchicalMemory.prototype, {
    '[Types/_source/HierarchicalMemory]': true,
    _moduleName: 'Types/source:HierarchicalMemory',
    _$parentProperty: null
});
