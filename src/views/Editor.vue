<template>
  <div class="main">
    <div class="toolbar">
      <el-radio-group v-model="currentTool">
        <el-radio-button label="钢笔" value="pen"></el-radio-button>
        <el-radio-button label="填充" value="fill" />
      </el-radio-group>
      <el-radio-group v-model="currentStyle" style="margin-left: 14px">
        <el-radio-button label="□" value="none" />
        <el-radio-button label="-" value="s1" />
        <el-radio-button label="x" value="s2" />
      </el-radio-group>
      <div style="margin-left: 20px">{{ mousePos.x }},{{ mousePos.y }}</div>
    </div>

    <div class="container">
      <el-scrollbar class="main-scroller">
        <div class="draw" :class="{ 'cur-move': currentKey == 'SPACE' }">
          <div class="drag">
            <canvas class="test" style="position: absolute" width="500" height="500"></canvas>
            <canvas class="canvas" @contextmenu.prevent :class="['cur-' + currentTool, currentCursor]"></canvas>
            <canvas class="grid" @contextmenu.prevent></canvas>
          </div>
        </div>
      </el-scrollbar>

      <div class="sidebar">
        <canvas class="preview" @contextmenu.prevent></canvas>
        <div class="palette">
          <el-scrollbar>
            <ul>
              <li v-for="(item, index) in palette" :key="item" class="item" :class="{ selected: item == currentColor, transparent: index == 0 }" :value="item" :style="{ backgroundColor: item }" @click.stop="currentColor = item"></li>
            </ul>
          </el-scrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import palettes from './palettes'
import Keyboard from '@/js/keyboard'
let grid, gridElRect, gridEl, gridCtx, previewEl, canvasEl, canvasCtx, previewScale, drawEl, previewCtx, dragEl, scaledSize
const currentKey = ref('')
const mousePos = ref({})
const currentTool = ref('pen')
const currentStyle = ref('none')
const palette = ref(palettes.default)
const currentColor = ref(palette.value[1])
const currentCursor = ref('cur-default')
let startTime

const historyStack = [] // 存储所有历史记录
let currentStep = -1 // 初始化为-1，表示当前没有历史记录
const maxSteps = 20 // undo/redo的最大步数

let boundingRect = {} // 当前绘制的矩形区域

let testCtx, testEl

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousedown', onStartDragCanvas)
})

onMounted(() => {
  //

  // testCtx.save()
  // testCtx.beginPath()
  // testCtx.fillStyle = 'tomato'
  // testCtx.arc(200, 200, 50, 0, Math.PI * 2, false)
  // testCtx.fill()
  // testCtx.clip()
  // testCtx.beginPath()
  // testCtx.strokeStyle = '#ccc'
  // testCtx.lineWidth = 10
  // testCtx.arc(150, 150, 50, 0, Math.PI * 2, false)
  // testCtx.stroke()
  // testCtx.restore()
  // testCtx.beginPath()
  // testCtx.fillStyle = 'green'
  // testCtx.arc(250, 250, 50, 0, Math.PI * 2, false)
  // testCtx.fill()
  // testCtx.clip()

  grid = { column: 40, row: 46, size: 40, x: 50, y: 50 }
  scaledSize = grid.size
  gridEl = document.querySelector('.grid')

  drawGrid(grid.size)
  gridElRect = gridEl.getBoundingClientRect()

  testEl = document.querySelector('.test')
  testCtx = testEl.getContext('2d')
  testEl.setAttribute('width', grid.column * grid.size)
  testEl.setAttribute('height', grid.row * grid.size)

  dragEl = document.querySelector('.drag')
  drawEl = document.querySelector('.main-scroller .el-scrollbar__wrap')
  canvasEl = document.querySelector('.canvas')
  canvasEl.setAttribute('width', grid.column * grid.size)
  canvasEl.setAttribute('height', grid.row * grid.size)
  canvasCtx = canvasEl.getContext('2d', { willReadFrequently: true })

  // boundingRect = { x: 0, y: 0, width: grid.column * grid.size, height: grid.row * grid.size }

  previewEl = document.querySelector('.preview')
  previewCtx = previewEl.getContext('2d')
  previewScale = Math.min(180 / (grid.column * grid.size), 200 / (grid.row * grid.size))

  previewEl.setAttribute('width', Math.floor(previewScale * grid.column * grid.size))
  previewEl.setAttribute('height', Math.floor(previewScale * grid.row * grid.size))

  canvasEl.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', (e) => {
    ;[mousePos.value.x, mousePos.value.y] = [e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x, e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x]
  })

  dragEl.addEventListener('wheel', onMouseWheel)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousedown', onStartDragCanvas)
  // saveCanvasState()
})

function onKeyDown(e) {
  // console.log(e)
  e.preventDefault()
  currentKey.value = Keyboard.getComboKey(e)
  switch (currentKey.value) {
    case 'SPACE':
      // 拖拽模式
      currentCursor.value = 'cur-move'
      break
    case 'ALT':
    case 'CMD':
      currentCursor.value = 'cur-dropper'
      break
    case 'CTRL+Z':
    case 'CMD+Z':
      // undo
      undo()
      break
    case 'CTRL+SHIFT+Z':
    case 'CMD+SHIFT+Z':
      redo()
      break
    default:
      currentCursor.value = 'cur-default'
  }
  // console.log(currentKey.value)
}

function onStartDragCanvas(e) {
  if (currentKey.value !== 'SPACE') return
  console.log('startdrag')
  window.addEventListener('mousemove', onDraggingCanvas)
  window.addEventListener('mouseup', onStopDragCanvas)
  let delta = { x: e.clientX + drawEl.scrollLeft - dragEl.offsetLeft, y: e.clientY + drawEl.scrollTop - dragEl.offsetTop }

  function onDraggingCanvas(e) {
    e.stopPropagation()

    if (e.button == 0 && currentKey.value === 'SPACE') {
      if (currentKey.value === 'SPACE') {
        // dragEl.style.left = e.clientX + drawEl.scrollLeft - delta.x < -drawEl.offsetWidth / 2 ? -drawEl.offsetWidth / 2 : e.clientX - delta.x + 'px'
        // dragEl.style.top = e.clientY + drawEl.scrollTop - delta.y < -drawEl.offsetHeight / 2 ? -drawEl.offsetHeight / 2 : e.clientY - delta.y + 'px'
        dragEl.style.left = e.clientX - delta.x + 'px'
        dragEl.style.top = e.clientY - delta.y + 'px'
        // console.log(drawEl.offsetHeight)
      }
    }
  }

  function onStopDragCanvas() {
    window.removeEventListener('mousemove', onDraggingCanvas)
    window.removeEventListener('mouseup', onStopDragCanvas)
  }
}

function onKeyUp() {
  currentKey.value = ''
  currentCursor.value = 'cur-default'
}

function onMouseWheel(e) {
  console.log('wheel', e.deltaY)
  const scaleStep = 5
  e.preventDefault()
  // const scale = grid.size
  if (e.deltaY < 0) {
    scaledSize += scaleStep
  } else {
    scaledSize -= scaleStep
  }

  if (scaledSize < 10) {
    scaledSize = 10
  } else if (scaledSize > 50) {
    scaledSize = 50
  }
  // scale = scale / 40

  drawGrid(scaledSize)

  canvasEl.style.transformOrigin = `0 0`
  canvasEl.style.transform = `scale(${scaledSize / grid.size})`
}

// 保存当前画布状态
function saveCanvasState() {
  // console.log('save')
  if (historyStack.length === maxSteps) {
    historyStack.shift() // 移除最旧的历史记录
  }
  if (currentStep < historyStack.length - 1) {
    historyStack.length = currentStep + 1
  }
  // startTime = performance.now()

  const tempData = canvasCtx.getImageData(boundingRect.x, boundingRect.y, boundingRect.width, boundingRect.height)
  const tempCanvasEl = document.createElement('canvas')
  tempCanvasEl.width = boundingRect.width
  tempCanvasEl.height = boundingRect.height
  const tempCtx = tempCanvasEl.getContext('2d')
  tempCtx.putImageData(tempData, 0, 0)

  testCtx.beginPath()
  testCtx.strokeStyle = 'green'
  testCtx.lineWidth = 8
  testCtx.strokeRect(boundingRect.x, boundingRect.y, boundingRect.width, boundingRect.height)

  historyStack.push({ x: boundingRect.x, y: boundingRect.y, width: boundingRect.width, height: boundingRect.height, data: tempCanvasEl.toDataURL() })

  // console.log(historyStack)
  // console.log(performance.now() - startTime + 'ms')

  currentStep++
  if (currentStep >= maxSteps) currentStep = maxSteps - 1

  // console.log(currentStep, historyStack)
}

// 执行undo操作
function undo() {
  if (currentStep > -1) {
    let curState = historyStack[currentStep]
    canvasCtx.clearRect(curState.x, curState.y, curState.width, curState.height)

    currentStep--
    if (currentStep < 0) return
    let prevState = historyStack[currentStep]
    // canvasCtx.clearRect(0, 0, grid.column * grid.size, grid.row * grid.size)

    let img = new Image()
    img.src = prevState.data
    img.onload = function () {
      canvasCtx.drawImage(img, prevState.x, prevState.y)
    }
  }
  // console.log(currentStep, historyStack)
}

// 执行redo操作
function redo() {
  if (currentStep < historyStack.length - 1) {
    currentStep++
    let nextState = historyStack[currentStep]
    // canvasCtx.clearRect(curState.x, curState.y, curState.width, curState.height)
    let img = new Image()
    img.src = nextState.data
    img.onload = function () {
      canvasCtx.drawImage(img, nextState.x, nextState.y)
    }
  }
  // console.log(currentStep, historyStack)
}

function getGridPosByMouse(x, y) {
  // console.log(x, y)
  if (x > 0 && x < grid.column * scaledSize && y > 0 && y < grid.row * scaledSize) {
    // console.log('in')
    const col = Math.floor(x / scaledSize)
    const row = Math.floor(y / scaledSize)
    return { col: col, row: row }
  }
}

// 画笔
function fillGrid(col, row, color) {
  // startTime = performance.now()
  canvasCtx.fillStyle = color
  canvasCtx.fillRect(col * grid.size, row * grid.size, grid.size, grid.size)
  canvasCtx.stroke()
  // console.log('fill')
  // console.log(performance.now() - startTime + 'ms')
}

// 橡皮擦
function eraseGrid(col, row, color) {
  canvasCtx.fillStyle = color
  canvasCtx.clearRect(col * grid.size, row * grid.size, grid.size, grid.size)
}

// 填充
function fillArea(col, row, newColor) {
  const oldColor = getGridColor(col, row)
  // console.log(oldColor)
  const visited = new Set()
  const queue = [[col, row]]
  canvasCtx.canvas.willReadFrequently = true
  // dfs搜索
  while (queue.length > 0) {
    const [currentColumn, currentRow] = queue.shift()
    // debugger
    const key = `${currentColumn}-${currentRow}`
    const curColor = getGridColor(currentColumn, currentRow)
    // console.log(currentColumn, currentRow, grid.column, grid.row)
    // console.log(currentColor, oldColor)
    if (currentRow < 0 || currentRow >= grid.row || currentColumn < 0 || currentColumn >= grid.column || curColor != oldColor || visited.has(key)) {
      visited.add(key)
      continue
    }
    visited.add(key)
    if (currentColor.value == '#00000000') {
      eraseGrid(currentColumn, currentRow, newColor)
    } else {
      fillGrid(currentColumn, currentRow, newColor)
    }
    if (currentColumn < boundingRect.x1) {
      boundingRect.x1 = currentColumn
    } else if (currentColumn > boundingRect.x2) {
      boundingRect.x2 = currentColumn
    }
    if (currentRow < boundingRect.y1) {
      boundingRect.y1 = currentRow
    } else if (currentRow > boundingRect.y2) {
      boundingRect.y2 = currentRow
    }
    queue.push([currentColumn - 1, currentRow])
    queue.push([currentColumn + 1, currentRow])
    queue.push([currentColumn, currentRow - 1])
    queue.push([currentColumn, currentRow + 1])
  }
}

// 获取网格色值
function getGridColor(row, col) {
  const rgba = canvasCtx.getImageData(row * grid.size + 1, col * grid.size + 1, 1, 1)
  // console.log(String(`#${getHex(rgba.data[0])}${getHex(rgba.data[1])}${getHex(rgba.data[2])}${getHex(rgba.data[3])}`))
  return String(`#${getHex(rgba.data[0])}${getHex(rgba.data[1])}${getHex(rgba.data[2])}${getHex(rgba.data[3])}`)
  function getHex(num) {
    return num.toString(16).padStart(2, '0')
  }
}

function updatePreview() {
  previewCtx.clearRect(0, 0, Math.floor(previewScale * grid.column * grid.size), Math.floor(previewScale * grid.row * grid.size))
  previewCtx.drawImage(canvasEl, 0, 0, grid.column * grid.size, grid.row * grid.size, 0, 0, Math.floor(previewScale * grid.column * grid.size), Math.floor(previewScale * grid.row * grid.size))
}

function drawGrid(size) {
  console.log('draw grid')
  gridEl.setAttribute('width', grid.column * size + grid.x + 20)
  gridEl.setAttribute('height', grid.row * size + grid.y + 20)
  gridCtx = gridEl.getContext('2d')
  gridCtx.translate(0.5, 0.5)
  let i = 0
  while (i <= Math.max(grid.row, grid.column) + 1) {
    // console.log
    const point = i * size
    gridCtx.beginPath()
    // 分割线
    if (i % 5 == 0) {
      gridCtx.font = '12px arial'
      gridCtx.fillText(i, i * size + grid.x - gridCtx.measureText(i).width / 2, grid.y - 4)
      if (i != 0) gridCtx.fillText(i, grid.x - 4 - gridCtx.measureText(i).width, i * size + grid.y + 4)
      if (i != 0) gridCtx.fillText(i, grid.column * size + grid.x + 4, i * size + grid.y + 4)
      if (i != 0 && i != grid.column) gridCtx.fillText(i, i * size + grid.x - gridCtx.measureText(i).width / 2, size * grid.row + grid.y + 12)
    }
    gridCtx.strokeStyle = i % 5 !== 0 ? '#333' : '#d07c7c'
    if (i <= grid.row) {
      gridCtx.moveTo(grid.x, point + grid.y)
      gridCtx.lineTo(grid.column * size + grid.x, point + grid.y)
    }
    if (i <= grid.column) {
      gridCtx.moveTo(point + grid.x, grid.y)
      gridCtx.lineTo(point + grid.x, grid.row * size + grid.y)
    }
    gridCtx.stroke()
    i++
  }
  gridCtx.setTransform(1, 0, 0, 1, 0, 0)
}

function onMouseDown(e) {
  // e.stopPropagation()
  console.log('mouse down')
  const mouseInfo = { target: e.target, time: new Date().getTime() }
  // console.log(drawEl.scrollLeft, drawEl.scrollTop)
  const orinX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
  const orinY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
  const button = e.button
  // console.log('down', gridElRect, button, currentKey.value)
  // console.log(canvasEl.scrollLeft)
  let orinPos = getGridPosByMouse(orinX, orinY)
  let oldPos = {}
  if (!orinPos) return

  boundingRect.x1 = orinPos.col
  boundingRect.y1 = orinPos.row
  boundingRect.x2 = orinPos.col
  boundingRect.y2 = orinPos.row
  console.log('down', boundingRect.x1, boundingRect.y1, boundingRect.x2, boundingRect.y2)
  // 鼠标左键，绘制
  if (button == 0 && currentKey.value == '') {
    switch (currentTool.value) {
      case 'pen':
        // 铅笔工具，移动或抬起鼠标左键才触发绘制
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        break
      case 'fill':
        // 油漆桶工具，按下鼠标左键就立即触发绘制
        fillArea(orinPos.col, orinPos.row, currentColor.value)
        // console.log(boundingRect)
        boundingRect.x = Math.min(boundingRect.x1, boundingRect.x2) * grid.size
        boundingRect.y = Math.min(boundingRect.y1, boundingRect.y2) * grid.size
        boundingRect.width = (Math.abs(boundingRect.x1 - boundingRect.x2) + 1) * grid.size
        boundingRect.height = (Math.abs(boundingRect.y1 - boundingRect.y2) + 1) * grid.size
        // console.log(boundingRect.x, boundingRect.y, boundingRect.width, boundingRect.height)
        saveCanvasState()
        updatePreview()

        break
    }
  }
  // alt或cmd键按下，取色
  else if (button == 0 && ['CMD', 'ALT'].includes(currentKey.value)) {
    currentColor.value = getGridColor(orinPos.col, orinPos.row)
    // console.log(currentColor.value)
  }
  // 鼠标右键，擦除
  else if (button == 2 && currentKey.value == '') {
    // console.log('erase')
    eraseGrid(orinPos.col, orinPos.row, currentColor.value)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    updatePreview()
    saveCanvasState()
  }

  function onMouseMove(e) {
    // console.log('move')
    // 如果在绘画时有键盘按键按下
    if (currentKey.value) {
      currentKey.value = ''
      // return
    }
    const newX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    const newY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
    let newPos = getGridPosByMouse(newX, newY)
    if (!newPos || (newPos.col == oldPos.col && newPos.row == oldPos.row)) return
    oldPos = { col: newPos.col, row: newPos.row }
    if (newPos.col < boundingRect.x1) {
      boundingRect.x1 = newPos.col
    } else if (newPos.col > boundingRect.x2) {
      boundingRect.x2 = newPos.col
    }
    if (newPos.row < boundingRect.y1) {
      boundingRect.y1 = newPos.row
    } else if (newPos.row > boundingRect.y2) {
      boundingRect.y2 = newPos.row
    }
    // console.log('move', boundingRect.x1, boundingRect.y1, boundingRect.x2, boundingRect.y2)
    if (button == 0) {
      if (currentColor.value == '#00000000') {
        eraseGrid(newPos.col, newPos.row, currentColor.value)
      }
      fillGrid(newPos.col, newPos.row, currentColor.value)
    } else if (button == 2) {
      eraseGrid(newPos.col, newPos.row, currentColor.value)
    }
  }

  function onMouseUp(e) {
    // console.log('mouse up')
    const newX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    const newY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
    let newPos = getGridPosByMouse(newX, newY)
    if (!newPos) return
    if (newPos.col < boundingRect.x1) {
      boundingRect.x1 = newPos.col
    } else if (newPos.col > boundingRect.x2) {
      boundingRect.x2 = newPos.col
    }
    if (newPos.row < boundingRect.y1) {
      boundingRect.y1 = newPos.row
    } else if (newPos.row > boundingRect.y2) {
      boundingRect.y2 = newPos.row
    }
    // console.log('up', boundingRect.x1, boundingRect.y1, boundingRect.x2, boundingRect.y2)
    const timeDiff = new Date().getTime() - mouseInfo.time
    if (mouseInfo.target === e.target && timeDiff < 200) {
      console.log('click')
      if (button == 0) {
        if (currentColor.value == '#00000000') {
          eraseGrid(newPos.col, newPos.row, currentColor.value)
        }
        fillGrid(newPos.col, newPos.row, currentColor.value)
      } else if (button == 2) {
        eraseGrid(newPos.col, newPos.row, currentColor.value)
      }
    }
    boundingRect.x = Math.min(boundingRect.x1, boundingRect.x2) * grid.size
    boundingRect.y = Math.min(boundingRect.y1, boundingRect.y2) * grid.size
    boundingRect.width = (Math.abs(boundingRect.x1 - boundingRect.x2) + 1) * grid.size
    boundingRect.height = (Math.abs(boundingRect.y1 - boundingRect.y2) + 1) * grid.size

    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)

    updatePreview()
    saveCanvasState()
  }
}
</script>

<style lang="scss" scoped>
.cur-default {
  cursor: default;
}
.cur-move {
  cursor: move !important;
}
.cur-pen {
  cursor: url('@/assets/pen.png') 8 23, auto;
}
.cur-fill {
  cursor: url('@/assets/fill.png') 22 23, auto;
}
.cur-dropper {
  cursor: url('@/assets/dropper.png') 8 23, auto;
}

.main {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #f0f0f2;
  height: 100vh;
  width: 100vw;
}

.toolbar {
  position: fixed;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 80px;
  background: #fff;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.container {
  position: relative;
  display: flex;
  flex-direction: row;
  top: 80px;
}

.draw {
  height: calc(100vh - 80px);
  width: calc(100vw - 200px);
  position: relative;
  display: block;
  // overflow: auto;
  z-index: 1;
}

.drag {
  position: absolute;
  top: 0px;
  left: 0px;
}

.test {
  position: relative;
  top: 50px;
  left: 50px;
}
.canvas {
  position: relative;
  top: 50px;
  left: 50px;
  z-index: 1;
  // border: 1px solid green;
  box-sizing: border-box;
}
.grid {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
}

.sidebar {
  width: 200px;
  border-left: 1px solid #ccc;
  padding-top: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: center;
}

.preview-container {
  border: 1px solid black;
  background: #fff;
  display: block;
}

.preview {
  border: 1px solid #ccc;
  margin-bottom: 20px;
}

.palette {
  width: 190px;
  height: 400px;
  overflow: auto;

  // flex-wrap: wrap;

  ul {
    padding: 0;
    list-style-type: none;
  }
  .item {
    position: relative;
    float: left;
    margin: 1px;
    width: 25px;
    height: 25px;
  }
  .transparent {
    background: linear-gradient(to bottom right, transparent calc(50% - 1px), red calc(50% - 1px), red calc(50% + 1px), transparent calc(50% + 1px));
  }

  .selected::before {
    content: '';
    position: absolute;
    border: 4px solid black;
    width: 25px;
    height: 25px;
  }
}
</style>
