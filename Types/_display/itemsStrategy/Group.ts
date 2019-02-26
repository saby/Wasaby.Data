/// <amd-module name="Types/_display/itemsStrategy/Group" />
/**
 * Стратегия-декоратор для формирования групп элементов
 * @class Types/_display/ItemsStrategy/Group
 * @mixes Types/_entity/DestroyableMixin
 * @implements Types/_display/IItemsStrategy
 * @mixes Types/_entity/SerializableMixin
 * @author Мальцев А.А.
 */

import IItemsStrategy, {IOptions as IItemsStrategyOptions} from '../IItemsStrategy';
import Abstract from '../Abstract';
import CollectionItem from '../CollectionItem';
import GroupItem from '../GroupItem';
import {DestroyableMixin, SerializableMixin, ISerializableState as IDefaultSerializableState} from '../../entity';
import {mixin} from '../../util';

type GroupHandler = (data: any, index: number, item: CollectionItem) => string | number;

interface IOptions {
   source: IItemsStrategy;
   display: Abstract;
   handler: GroupHandler;
}

interface ISortOptions {
   display: Abstract;
   handler: GroupHandler;
   groups: GroupItem[];
}

interface ISerializableState extends IDefaultSerializableState {
   _groups: GroupItem[];
   _itemsOrder: number[];
}

export default class Group extends mixin(
   DestroyableMixin, SerializableMixin
) implements IItemsStrategy /** @lends Types/_display/ItemsStrategy/Group.prototype */ {
   /**
    * @typedef {Object} Options
    * @property {Types/_display/ItemsStrategy/Abstract} source Декорирумая стратегия
    * @property {Function(Types/_collection/Item, Number, *)} handler Метод, возвращающий группу элемента
    */

   /**
    * Опции конструктора
    */
   protected _options: IOptions;

   /**
    * Группы
    */
   protected _groups: GroupItem[] = [];

   /**
    * Индекс в в стратегии -> оригинальный индекс
    */
   protected _itemsOrder: number[];

   /**
    * Конструктор
    * @param {Options} options Опции
    */
   constructor(options: IOptions) {
      super();
      this._options = options;
   }

   /**
    * Метод, возвращающий группу элемента
    */
   set handler(value: GroupHandler) {
      this._options.handler = value;
   }

   // region IItemsStrategy

   readonly '[Types/_display/IItemsStrategy]': boolean = true;

   get options(): IItemsStrategyOptions {
      return this.source.options;
   }

   get source(): IItemsStrategy {
      return this._options.source;
   }

   get count(): number {
      return this._getItemsOrder().length;
   }

   get items(): CollectionItem[] {
      const itemsOrder = this._getItemsOrder();
      const items = this._getItems();

      return itemsOrder.map((index) => items[index]);
   }

   at(index: number): CollectionItem {
      const itemsOrder = this._getItemsOrder();
      const itemIndex = itemsOrder[index];

      if (itemIndex === undefined) {
         throw new ReferenceError('Index ' + index + ' is out of bounds.');
      }

      return this._getItems()[itemIndex];
   }

   splice(start: number, deleteCount: number, added?: CollectionItem[]): CollectionItem[] {
      this._itemsOrder = null;
      return this.source.splice(
         start,
         deleteCount,
         added
      );
   }

   reset(): void {
      this._groups = [];
      this._itemsOrder = null;
      return this.source.reset();
   }

   invalidate(): void {
      this._itemsOrder = null;
      return this.source.invalidate();
   }

   getDisplayIndex(index: number): number {
      const itemsOrder = this._getItemsOrder();
      const sourceIndex = this.source.getDisplayIndex(index);
      const overallIndex = sourceIndex + this._groups.length;
      const itemIndex = itemsOrder.indexOf(overallIndex);

      return itemIndex === -1 ? itemsOrder.length : itemIndex;
   }

   getCollectionIndex(index: number): number {
      const itemsOrder = this._getItemsOrder();
      const overallIndex = itemsOrder[index];
      let sourceIndex = overallIndex - this._groups.length;

      sourceIndex = sourceIndex >= 0 ? this.source.getCollectionIndex(sourceIndex) : -1;

      return sourceIndex;
   }

   // endregion

   // region SerializableMixin

   protected _getSerializableState(state: IDefaultSerializableState): ISerializableState {
      const resultState: ISerializableState = SerializableMixin.prototype._getSerializableState.call(this, state);

      resultState.$options = this._options;
      resultState._groups = this._groups;
      resultState._itemsOrder = this._itemsOrder;

      // If handler is defined force calc order because handler can be lost during serialization
      if (!resultState._itemsOrder && this._options.handler) {
         resultState._itemsOrder = this._getItemsOrder();
      }

      return resultState;
   }

   protected _setSerializableState(state: ISerializableState): Function {
      const fromSerializableMixin = SerializableMixin.prototype._setSerializableState(state);
      return function(): void {
         this._groups = state._groups;
         this._itemsOrder = state._itemsOrder;
         fromSerializableMixin.call(this);
      };
   }

   // endregion

   // region Protected

   /**
    * Возвращает группы + элементы оригинальной стратегии
    * @protected
    * @return {Array.<CollectionItem>}
    */
   protected _getItems(): CollectionItem[] {
      return (<CollectionItem[]> this._groups).concat(this.source.items);
   }

   /**
    * Возвращает соответствие индексов в стратегии оригинальным индексам
    * @protected
    * @return {Array.<Number>}
    */
   protected _getItemsOrder(): number[] {
      if (!this._itemsOrder) {
         this._itemsOrder = this._createItemsOrder();
      }

      return this._itemsOrder;
   }

   /**
    * Создает соответствие индексов в стратегии оригинальным оригинальный индексам
    * @protected
    * @return {Array.<Number>}
    */
   protected _createItemsOrder(): number[] {
      return Group.sortItems(this.source.items, {
         display: this.options.display,
         handler: this._options.handler,
         groups: this._groups
      });
   }

   /**
    * Возвращает число групп, в которых есть элементы
    * @protected
    * @return {Number}
    */
   protected _getActiveGroupsCount(itemsOrder: number[]): number {
      return itemsOrder.length - this.source.items.length;
   }

   // endregion

   // region Statics

   /**
    * Создает индекс сортировки в порядке группировки
    * @param {Array.<Types/_display/CollectionItem>} items Элементы проекции.
    * @param {Object} options Опции
    * @param {Array.<Types/_display/GroupItem>} options.groups Группы
    * @param {Types/_display/Display} options.display Проекция
    * @param {Function(Types/_display/CollectionItem):*>} options.handler Метод, возвращающий идентификатор группы
    * @return {Array.<Number>}
    */
   static sortItems(items: CollectionItem[], options: ISortOptions): number[] {
      const groups = options.groups;
      const display = options.display;
      const handler = options.handler;

      // No grouping - reset groups and return current order
      if (!handler) {
         groups.length = 0;
         return items.map((item, index) => index);
      }

      let groupsId; //{Array}: Group index -> group ID
      // Fill groupsId by groups
      groupsId = groups.map((item) => item.getContents());

      const groupsOrder = []; //{Array.<Number>}: Group position -> Group index
      const groupsItems = []; //{Array.<Number>}: Group index -> Item index
      // Check group ID and group instance for every item and join them all together
      for (let position = 0; position < items.length; position++) {
         const item = items[position];
         const groupId = handler ? handler(item.getContents(), position, item) : undefined;
         let groupIndex = groupsId.indexOf(groupId);

         // Create group with this groupId if necessary
         if (groupsId.indexOf(groupId) === -1) {
            const group = new GroupItem({
               owner: display,
               contents: groupId
            });

            groupIndex = groups.length;

            // Insert data into groups and groupsId
            groups.push(group);
            groupsId.push(groupId);
         }

         // Remember group order
         if (groupsOrder.indexOf(groupIndex) === -1) {
            groupsOrder.push(groupIndex);
         }

         // Items of each group
         if (!groupsItems[groupIndex]) {
            groupsItems[groupIndex] = [];
         }
         groupsItems[groupIndex].push(position);
      }

      // Fill result by groups
      const result = [];
      const groupsCount = groups.length;
      groupsOrder.forEach((groupIndex) => {
         result.push(groupIndex);
         groupsItems[groupIndex].forEach((item) => {
            result.push(item + groupsCount);
         });
      });

      return result;
   }

   // endregion
}

Object.assign(Group.prototype, {
   '[Types/_display/itemsStrategy/Group]': true,
   _moduleName: 'Types/display:itemsStrategy.Group',
   _groups: null,
   _itemsOrder: null
});
