export class GridCanvas {
  constructor(width, height, containerEl) {
    this.width = width
    this.height = height
    this.canvasEl = containerEl.appendChild(document.createElement('canvas'))
    this.canvasEl.setAttribute('width', this.width)
    this.canvasEl.setAttribute('height', this.height)
    this.ctx = this.canvasEl.getContext('2d')
    this.ctx.translate(0.5, 0.5)
    this._drawGrid(false)
    this._drawGrid(true)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}
// 画网格
GridCanvas.prototype._drawGrid = function (isColumn) {
  const gutter = 10
  const limit = isColumn ? this.height : this.width

  let i = 0
  while (i * gutter + gutter <= limit) {
    i++
    const point = i * gutter

    // 清空子路径列表开始一个新路径
    this.ctx.beginPath()

    // 分割线
    this.ctx.strokeStyle = point % 100 !== 0 ? '#f0f0f0' : '#d6e4ff'

    // 将一个新的子路径的起始点移动到(x，y)坐标
    if (isColumn) {
      this.ctx.moveTo(0, point)
    } else {
      this.ctx.moveTo(point, 0)
    }
    // 使用直线连接子路径的终点到x，y坐标
    if (isColumn) {
      this.ctx.lineTo(this.width, point)
    } else {
      this.ctx.lineTo(point, this.height)
    }
    // 根据当前的画线样式，绘制当前或已经存在的路径的方法
    this.ctx.stroke()
  }
}

GridCanvas.prototype.addGridItem = function (x, y, w, h) {
  console.log(x, y, w, h)
}
