import { IGroup, IShape } from '@antv/g-base';
import { upperFirst } from '@antv/util';
import { ShapeOptions, ShapeDefine } from '../interface/shape';
import { IPoint, Item, ModelConfig, NodeConfig, EdgeConfig, UpdateType } from '../types';
import { createNodeFromXML } from './xml';

const cache: {
  [key: string]: string;
} = {}; // ucfirst 开销过大，进行缓存

// 首字母大写
function ucfirst(str: string) {
  if (!cache[str]) {
    cache[str] = upperFirst(str);
  }
  return cache[str];
}

/**
 * 工厂方法的基类
 * @type Shape.FactoryBase
 */
export const ShapeFactoryBase = {
  /**
   * 默认的形状，当没有指定/匹配 shapeType 时，使用默认的
   * @type {String}
   */
  defaultShapeType: 'defaultType',
  /**
   * 形状的 className，用于搜索
   * @type {String}
   */
  className: null,
  /**
   * 获取绘制 Shape 的工具类，无状态
   * @param  {String} type 类型
   * @return {Shape} 工具类
   */
  getShape(type?: string): ShapeOptions {
    const self = this as any;
    const shape = self[type!] || self[self.defaultShapeType] || self['simple-circle'];
    return shape;
  },
  /**
   * 绘制图形
   * @param  {String} type  类型
   * @param  {Object} cfg 配置项
   * @param  {G.Group} group 图形的分组
   * @return {IShape} 图形对象
   */
  draw(type: string, cfg: ModelConfig, group: IGroup): IShape {
    const shape = this.getShape(type);
    group['shapeMap'] = {};
    const rst = shape.draw!(cfg, group);
    if (shape.afterDraw) {
      shape.afterDraw(cfg, group, rst);
    }
    return rst;
  },
  /**
   * 更新
   * @param  {String} type  类型
   * @param  {Object} cfg 配置项
   * @param  {G6.Item} item 节点、边、分组等
   */
  baseUpdate(type: string, cfg: ModelConfig, item: Item, updateType?: UpdateType) {
    const shape = this.getShape(type);

    // 防止没定义 update 函数
    if (shape.update) {
      // shape.mergeStyle = updateType === 'move' || updateType === 'bbox' ? {} : shape.getOptions?.(cfg);
      shape.mergeStyle = shape.getOptions?.(cfg, updateType);
      shape.update?.(cfg, item, updateType);
    }

    if (shape.afterUpdate) {
      shape.afterUpdate(cfg, item);
    }
  },
  /**
   * 设置状态
   * @param {String} type  类型
   * @param {String} name  状态名
   * @param {String | Boolean} value 状态值
   * @param {G6.Item} item  节点、边、分组等
   */
  setState(type: string, name: string, value: string | boolean, item: Item) {
    const shape = this.getShape(type);

    // 调用 shape/shapeBase.ts 中的 setState 方法
    shape.setState!(name, value, item);
  },
  /**
   * 是否允许更新，不重新绘制图形
   * @param  {String} type 类型
   * @return {Boolean} 是否允许使用更新
   */
  shouldUpdate(type: string): boolean {
    const shape = this.getShape(type);
    return !!shape.update;
  },
  getControlPoints(type: string, cfg: ModelConfig): IPoint[] | undefined {
    const shape = this.getShape(type);
    return shape.getControlPoints!(cfg);
  },
  /**
   * 获取控制点
   * @param {String} type 节点、边类型
   * @param  {Object} cfg 节点、边的配置项
   * @return {Array|null} 控制点的数组,如果为 null，则没有控制点
   */
  getAnchorPoints(type: string, cfg: ModelConfig): number[][] | undefined {
    const shape = this.getShape(type);
    return shape.getAnchorPoints!(cfg);
  },
};

/**
 * 元素的框架
 */
const ShapeFramework = {
  // 默认样式及配置
  options: {},
  /**
   * 绘制
   */
  draw(cfg, group) {
    return this.drawShape(cfg, group);
  },
  /**
   * 绘制
   */
  drawShape(/* cfg, group */) {},
  /**
   * 绘制完成后的操作，便于用户继承现有的节点、边
   */
  afterDraw(/* cfg, group */) {},
  // update(cfg, item) // 默认不定义
  afterUpdate(/* cfg, item */) {},
  /**
   * 设置节点、边状态
   */
  setState(/* name, value, item */) {},
  /**
   * 获取控制点
   * @param  {Object} cfg 节点、边的配置项
   * @return {Array|null} 控制点的数组,如果为 null，则没有控制点
   */
  getControlPoints(cfg: NodeConfig | EdgeConfig) {
    return cfg.controlPoints;
  },
  /**
   * 获取控制点
   * @param  {Object} cfg 节点、边的配置项
   * @return {Array|null} 控制点的数组,如果为 null，则没有控制点
   */
  getAnchorPoints(cfg: NodeConfig | EdgeConfig) {
    const { anchorPoints: defaultAnchorPoints } = this.options as any;
    const anchorPoints = cfg.anchorPoints || defaultAnchorPoints;
    return anchorPoints;
  },
  /* 如果没定义 update 方法，每次都调用 draw 方法
  update(cfg, item) {

  }
  */
};

export default class Shape {
  public static Node: any;

  public static Edge: any;

  public static Combo: any;

  public static registerFactory(factoryType: string, cfg: object): object {
    const className = ucfirst(factoryType);
    const factoryBase = ShapeFactoryBase;
    const shapeFactory = { ...factoryBase, ...cfg } as any;
    (Shape as any)[className] = shapeFactory;
    shapeFactory.className = className;
    return shapeFactory;
  }

  public static getFactory(factoryType: string) {
    const className = ucfirst(factoryType);
    return (Shape as any)[className];
  }

  public static registerNode(
    shapeType: string,
    nodeDefinition: ShapeOptions | ShapeDefine,
    extendShapeType?: string,
  ) {
    const shapeFactory = Shape.Node;
    let shapeObj;

    if (typeof nodeDefinition === 'string' || typeof nodeDefinition === 'function') {
      const autoNodeDefinition = createNodeFromXML(nodeDefinition);
      shapeObj = { ...shapeFactory.getShape('single-node'), ...autoNodeDefinition };
    } else if (nodeDefinition.jsx) {
      const { jsx } = nodeDefinition;
      const autoNodeDefinition = createNodeFromXML(jsx);
      shapeObj = {
        ...shapeFactory.getShape('single-node'),
        ...autoNodeDefinition,
        ...nodeDefinition,
      };
    } else {
      shapeFactory.getShape(extendShapeType);
      const extendShape = extendShapeType ? shapeFactory.getShape(extendShapeType) : ShapeFramework;
      shapeObj = { ...extendShape, ...nodeDefinition };
    }

    shapeObj.type = shapeType;
    shapeObj.itemType = 'node';
    shapeFactory[shapeType] = shapeObj;
    return shapeObj;
  }

  public static registerEdge(
    shapeType: string,
    edgeDefinition: ShapeOptions,
    extendShapeType?: string,
  ) {
    const shapeFactory = Shape.Edge;
    const extendShape = extendShapeType ? shapeFactory.getShape(extendShapeType) : ShapeFramework;
    const shapeObj = { ...extendShape, ...edgeDefinition };
    shapeObj.type = shapeType;
    shapeObj.itemType = 'edge';
    shapeFactory[shapeType] = shapeObj;
    return shapeObj;
  }

  public static registerCombo(
    shapeType: string,
    comboDefinition: ShapeOptions,
    extendShapeType?: string,
  ) {
    const shapeFactory = Shape.Combo;
    const extendShape = extendShapeType ? shapeFactory.getShape(extendShapeType) : ShapeFramework;

    const shapeObj = { ...extendShape, ...comboDefinition };
    shapeObj.type = shapeType;
    shapeObj.itemType = 'combo';
    shapeFactory[shapeType] = shapeObj;
    return shapeObj;
  }
}

// 注册 Node 的工厂方法
Shape.registerFactory('node', {
  defaultShapeType: 'circle',
});

// 注册 Edge 的工厂方法
Shape.registerFactory('edge', {
  defaultShapeType: 'line',
});

// 注册 Combo 的工厂方法
Shape.registerFactory('combo', {
  defaultShapeType: 'circle',
});
