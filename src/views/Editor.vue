<template>
  <div class="main">
    <div class="toolbar">
      <ul class="tools">
        <li title="画笔" @click="currentTool = 'pen'" :class="{ active: currentTool === 'pen' }"><img src="@/assets/pen.png" alt="画笔" /></li>
        <li title="填色" @click="currentTool = 'fill'" :class="{ active: currentTool === 'fill' }"><img src="@/assets/fill.png" alt="填充" /></li>
        <li title="选区" @click="currentTool = 'selector'" :class="{ active: currentTool === 'selector' }"><img src="@/assets/selector.png" alt="选区" /></li>
      </ul>

      <ul class="tools" v-if="currentTool === 'pen'">
        <li title="不镜像" :class="{ active: mirrorMode === 'none' }" @click="mirrorMode = 'none'"><img src="@/assets/mirror-none.png" alt="不镜像" /></li>
        <li title="水平镜像" :class="{ active: mirrorMode === 'horizontal' }" @click="mirrorMode = 'horizontal'"><img src="@/assets/mirror-h.png" alt="水平镜像" /></li>
        <li title="垂直镜像" :class="{ active: mirrorMode === 'vertical' }" @click="mirrorMode = 'vertical'"><img src="@/assets/mirror-v.png" alt="垂直镜像" /></li>
        <li title="中心镜像" :class="{ active: mirrorMode === 'center' }" @click="mirrorMode = 'center'"><img src="@/assets/mirror-c.png" alt="中心镜像" /></li>
      </ul>
      <div style="margin-left: 20px">{{ mousePos.x }},{{ mousePos.y }},{{ oldTool }},{{ currentTool }}</div>
    </div>

    <div class="container">
      <el-scrollbar class="main-scroller">
        <div class="draw" @contextmenu.prevent :class="{ 'cur-move': currentTool == 'move' }">
          <div class="drag">
            <canvas class="selection"></canvas>
            <canvas class="canvas" :class="'cur-' + currentTool"></canvas>
            <canvas class="grid"></canvas>
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
const oldKey = ref('')

const mousePos = ref({ x: 0, y: 0 })
const currentTool = ref('pen')
const oldTool = ref('')
const eraseMode = ref(false)
const selectMode = ref(false)
const palette = ref(palettes.default)
const currentColor = ref(palette.value[1])
// const currentMode = ref('default')
const mirrorMode = ref('none')
let startTime

const historyStack = [] // 存储所有历史记录
let currentStep = -1 // 初始化为-1，表示当前没有历史记录
const maxSteps = 20 // undo/redo的最大步数

// let boundingRect = {} // 当前绘制的矩形区域

// 初始化选区
let selectionCtx,
  selectionEl,
  selRect = {},
  clipboard

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousedown', onMouseDown)
  dragEl.removeEventListener('wheel', onMouseWheel)
})

onMounted(() => {
  grid = { col: 40, row: 35, size: 40, x: 50, y: 50 }
  grid.width = grid.col * grid.size
  grid.height = grid.row * grid.size
  scaledSize = grid.size
  gridEl = document.querySelector('.grid')

  drawGrid()
  gridElRect = gridEl.getBoundingClientRect()
  // testEl = document.querySelector('.test')
  // testCtx = testEl.getContext('2d')
  // testEl.setAttribute('width', grid.width)
  // testEl.setAttribute('height', grid.height)

  dragEl = document.querySelector('.drag')
  drawEl = document.querySelector('.main-scroller .el-scrollbar__wrap')
  canvasEl = document.querySelector('.canvas')
  canvasEl.setAttribute('width', grid.width)
  canvasEl.setAttribute('height', grid.height)
  canvasCtx = canvasEl.getContext('2d', { willReadFrequently: true })

  // boundingRect = { x: 0, y: 0, width: grid.width, height: grid.height }

  previewEl = document.querySelector('.preview')
  previewCtx = previewEl.getContext('2d')
  previewScale = Math.min(180 / grid.width, 200 / grid.height)

  previewEl.setAttribute('width', Math.floor(previewScale * grid.width))
  previewEl.setAttribute('height', Math.floor(previewScale * grid.height))

  selectionEl = document.querySelector('.selection')
  selectionCtx = selectionEl.getContext('2d')
  selectionEl.setAttribute('width', grid.width + grid.x + 20)
  selectionEl.setAttribute('height', grid.height + grid.y + 20)

  canvasEl.style.transformOrigin = `0 0`
  selectionEl.style.transformOrigin = `0 0`

  window.addEventListener('mousemove', (e) => {
    mousePos.value.x = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    mousePos.value.y = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
  })

  dragEl.addEventListener('wheel', onMouseWheel)

  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // saveCanvasState()
})

function onKeyDown(e) {
  // console.log(e)
  e.preventDefault()
  const key = Keyboard.getComboKey(e)
  if (key == oldKey.value) return
  oldKey.value = key
  currentKey.value = key
  console.log(currentKey.value)
  switch (currentKey.value) {
    case 'ESC':
      clearSelection()
      break
    case 'SPACE':
      // 拖拽模式
      oldTool.value = currentTool.value
      currentTool.value = 'move'

      break
    case 'ALT':
    case 'CMD':
      // 吸管模式
      oldTool.value = currentTool.value
      currentTool.value = 'drop'

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
    // default:
    // currentMode.value = 'default'
  }
}

// function onStartDragCanvas(e) {

// }

function onKeyUp() {
  console.log(oldTool, currentTool)
  currentTool.value = oldTool.value
  currentKey.value = ''
  oldKey.value = ''
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
  canvasEl.style.transform = `scale(${scaledSize / grid.size})`
  drawGrid()
  drawSelection()
  drawControl()
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
  let tempCanvasEl = document.createElement('canvas')
  tempCanvasEl.width = grid.width
  tempCanvasEl.height = grid.height
  const tempData = canvasCtx.getImageData(0, 0, grid.width, grid.height)
  const tempCtx = tempCanvasEl.getContext('2d')
  tempCtx.putImageData(tempData, 0, 0)

  historyStack.push(tempCanvasEl.toDataURL())
  tempCanvasEl = null
  console.log(historyStack)
  // console.log(performance.now() - startTime + 'ms')

  currentStep++
  if (currentStep >= maxSteps) currentStep = maxSteps - 1

  // console.log(currentStep, historyStack)
}

// 执行undo操作
function undo() {
  if (currentStep > -1) {
    // let curState = historyStack[currentStep]

    currentStep--
    if (currentStep == -1) {
      canvasCtx.clearRect(0, 0, grid.width, grid.height)
      updatePreview()
    }
    if (currentStep < 0) return
    let prevState = historyStack[currentStep]
    // canvasCtx.clearRect(0, 0, grid.width, grid.height)

    let img = new Image()
    img.src = prevState
    img.onload = function () {
      canvasCtx.clearRect(0, 0, grid.width, grid.height)
      canvasCtx.drawImage(img, 0, 0)
      updatePreview()
    }
  }
  console.log(currentStep, historyStack)
}

// 执行redo操作
function redo() {
  if (currentStep < historyStack.length - 1) {
    currentStep++
    let nextState = historyStack[currentStep]
    // canvasCtx.clearRect(curState.x, curState.y, curState.width, curState.height)
    let img = new Image()
    img.src = nextState
    img.onload = function () {
      canvasCtx.clearRect(0, 0, grid.width, grid.height)
      canvasCtx.drawImage(img, 0, 0)
      updatePreview()
    }
  }
  // console.log(currentStep, historyStack)
}

function getGridPosByMouse(x, y) {
  // console.log(x, y)
  let col, row
  col = Math.floor(x / scaledSize)
  row = Math.floor(y / scaledSize)
  return { col: col, row: row }
}

// 画笔
function fillGrid(posArray, color) {
  // startTime = performance.now()
  canvasCtx.fillStyle = color
  posArray.forEach(({ col, row }) => {
    canvasCtx.fillRect(col * grid.size, row * grid.size, grid.size, grid.size)
  })
  // canvasCtx.stroke()
  // console.log('fill')
  // console.log(performance.now() - startTime + 'ms')`
}

// 橡皮擦
function eraseGrid(posArray, color) {
  canvasCtx.fillStyle = color
  posArray.forEach(({ col, row }) => {
    canvasCtx.clearRect(col * grid.size, row * grid.size, grid.size, grid.size)
  })
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
    const [currentCol, currentRow] = queue.shift()
    // debugger
    const key = `${currentCol}-${currentRow}`
    const curColor = getGridColor(currentCol, currentRow)
    // console.log(currentColumn, currentRow, grid.column, grid.row)
    // console.log(currentColor, oldColor)
    if (currentRow < 0 || currentRow >= grid.row || currentCol < 0 || currentCol >= grid.col || curColor != oldColor || visited.has(key)) {
      visited.add(key)
      continue
    }
    visited.add(key)
    if (currentColor.value == '#00000000') {
      eraseGrid([{ col: currentCol, row: currentRow }], newColor)
    } else {
      fillGrid([{ col: currentCol, row: currentRow }], newColor)
    }
    queue.push([currentCol - 1, currentRow])
    queue.push([currentCol + 1, currentRow])
    queue.push([currentCol, currentRow - 1])
    queue.push([currentCol, currentRow + 1])
  }
}

// 画选区
function drawSelection() {
  selectionEl.setAttribute('width', grid.col * scaledSize + grid.x + 20)
  selectionEl.setAttribute('height', grid.row * scaledSize + grid.y + 20)
  selectionCtx.clearRect(0, 0, grid.width, grid.height)
  selectionCtx.fillStyle = '#cccccc99'
  selectionCtx.strokeStyle = 'black'
  // console.log(selRect)
  // console.log(x * grid.size, y * grid.size, w * grid.size, h * grid.size)
  let x = selRect.col * scaledSize + 50
  let y = selRect.row * scaledSize + 50
  let width = selRect.w * scaledSize
  let height = selRect.h * scaledSize
  selectionCtx.fillRect(x, y, width, height)
}

// 画选区的四个控制点
function drawControl() {
  if (selRect.w) {
    selectionCtx.strokeStyle = '#000'
    selectionCtx.fillStyle = '#fff'
    const radius = 5
    selRect.ctrlPos = [
      [selRect.col * scaledSize + grid.x, selRect.row * scaledSize + grid.y],
      [(selRect.col + selRect.w) * scaledSize + grid.x, selRect.row * scaledSize + grid.y],
      [selRect.col * scaledSize + grid.x, (selRect.row + selRect.h) * scaledSize + grid.y],
      [(selRect.col + selRect.w) * scaledSize + grid.x, (selRect.row + selRect.h) * scaledSize + grid.y]
    ]
    selRect.ctrlPos.forEach(([x, y]) => {
      selectionCtx.beginPath()
      selectionCtx.arc(x, y, radius, 0, 2 * Math.PI)
      selectionCtx.fill()
      selectionCtx.stroke()
    })
  }
}

// 清除选区
function clearSelection() {
  selectionCtx.clearRect(0, 0, grid.width + grid.x + 20, grid.height + grid.y + 20)
  selRect = {}
}

// function deleteSelection() {
//   if (selRect.w && selRect.h) {
//     const { x, y, w, h } = selRect
//     canvasCtx.clearRect(x, y, w, h)
//   }
// }

// function copySelection() {
//   if (selRect.w && selRect.h) {
//     const { x, y, w, h } = selRect
//     const imgData = canvasCtx.getImageData(x, y, w, h)
//     clipboard = imgData
//   }
// }

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
  previewCtx.clearRect(0, 0, Math.floor(previewScale * grid.width), Math.floor(previewScale * grid.height))
  previewCtx.drawImage(canvasEl, 0, 0, grid.width, grid.height, 0, 0, Math.floor(previewScale * grid.width), Math.floor(previewScale * grid.height))
}

function drawGrid() {
  console.log('draw grid')
  gridEl.setAttribute('width', grid.col * scaledSize + grid.x + 20)
  gridEl.setAttribute('height', grid.row * scaledSize + grid.y + 20)
  gridCtx = gridEl.getContext('2d')
  gridCtx.translate(0.5, 0.5)
  let i = 0
  let step = Math.max(grid.row, grid.col)
  while (i <= step) {
    // console.log
    // gridCtx.beginPath()
    gridCtx.font = '12px arial'
    let textSize = { w: gridCtx.measureText(i).width, h: 9 }
    // draw text
    // x-axis
    // reverse
    // let temp=i*2-1
    if (((i % 5 == 0 && i !== 0) || i === 1 || i === grid.col) && i <= grid.col) {
      gridCtx.fillText(i, (grid.col - i) * scaledSize + grid.x + (scaledSize - textSize.w) / 2, grid.y - 5)
      gridCtx.fillText(i, (grid.col - i) * scaledSize + grid.x + (scaledSize - textSize.w) / 2, scaledSize * grid.row + grid.y + 15)
    }
    //y-axis
    if (((i % 5 == 0 && i !== 0) || i === 1 || i === grid.row) && i <= grid.row) {
      gridCtx.fillText(i, grid.x - gridCtx.measureText(i).width - 5, (grid.row - i) * scaledSize + grid.y + (scaledSize - textSize.h) / 2 + 10)
      gridCtx.fillText(i, grid.col * scaledSize + grid.x + 5, (grid.row - i) * scaledSize + grid.y + (scaledSize - textSize.h) / 2 + 10)
    }
    // draw grid line
    const point = i * scaledSize

    if (i <= grid.row) {
      gridCtx.beginPath()
      gridCtx.strokeStyle = (grid.row - i) % 5 !== 0 ? '#333' : '#d07c7c'
      gridCtx.moveTo(grid.x, point + grid.y)
      gridCtx.lineTo(grid.col * scaledSize + grid.x, point + grid.y)
      gridCtx.stroke()
    }
    if (i <= grid.col) {
      gridCtx.beginPath()
      gridCtx.strokeStyle = (grid.col - i) % 5 !== 0 ? '#333' : '#d07c7c'
      gridCtx.moveTo(point + grid.x, grid.y)
      gridCtx.lineTo(point + grid.x, grid.row * scaledSize + grid.y)
      gridCtx.stroke()
    }
    i++
  }
  gridCtx.setTransform(1, 0, 0, 1, 0, 0)
}

function onMouseDown(e) {
  e.stopPropagation()
  console.log('mouse down')
  const mouseInfo = { target: e.target, time: new Date().getTime() }
  // console.log(drawEl.scrollLeft, drawEl.scrollTop)
  const orinX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
  const orinY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
  const button = e.button
  // console.log('down', gridElRect, button, currentKey.value)
  // console.log(canvasEl.scrollLeft)
  let oldPos = getGridPosByMouse(orinX, orinY)
  let prevPos = {}
  let delta = {}
  // if (!oldPos) return
  // 鼠标左键+空格：拖拽画布
  if (button == 0 && currentTool.value == 'move') {
    console.log('start drag canvas')
    window.addEventListener('mousemove', onDraggingCanvas)
    window.addEventListener('mouseup', onStopDragCanvas)
    delta = { x: e.clientX + drawEl.scrollLeft - dragEl.offsetLeft, y: e.clientY + drawEl.scrollTop - dragEl.offsetTop }
  }
  // 鼠标左键+画笔工具选中：画线
  else if (button == 0 && currentTool.value == 'pen') {
    window.addEventListener('mousemove', onDrawing)
    window.addEventListener('mouseup', onStopDraw)
  }
  // 鼠标左键+油漆桶工具选中：填色
  else if (button === 0 && currentTool.value == 'fill') {
    fillArea(oldPos.col, oldPos.row, currentColor.value)
    saveCanvasState()
    updatePreview()
  }
  // 鼠标左键+alt/cmd: 取色
  else if (button == 0 && ['CMD', 'ALT'].includes(currentKey.value)) {
    console.log('dropper')
    currentColor.value = getGridColor(oldPos.col, oldPos.row)
    // console.log(currentColor.value)
  }
  // 鼠标左键+选择工具选中：选区
  else if (button == 0 && currentTool.value == 'selector') {
    console.log('selection')
    const oldPos = getGridPosByMouse(e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x, e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x)
    // let newPos = {}
    delta = { x: oldPos.col - selRect.col, y: oldPos.row - selRect.row }
    // 鼠标在选区内：拖动选取
    // inside selection
    if (oldPos.col >= selRect.col && oldPos.col <= selRect.col + selRect.w && oldPos.row >= selRect.row && oldPos.row <= selRect.row + selRect.h) {
      window.addEventListener('mousemove', onDraggingSelection)
      window.addEventListener('mouseup', onStopDragSelection)
    }
    // 鼠标在选取外: 绘制/重绘选区
    // inside outside
    else {
      if (oldPos.col < 0 || oldPos.row < 0 || oldPos.col > grid.col || oldPos.row > grid.row) {
        return
      }
      clearSelection()
      window.addEventListener('mousemove', onDrawingSelection)
      window.addEventListener('mouseup', onStopDrawSelection)
    }
  }
  // 鼠标右键，擦除
  else if (button == 2) {
    console.log('erase')
    const posArray = []
    posArray.push({ col: oldPos.col, row: oldPos.row })
    switch (mirrorMode.value) {
      case 'horizontal':
        posArray.push({ col: grid.col - oldPos.col - 1, row: oldPos.row })
        break
      case 'vertical':
        posArray.push({ col: oldPos.col, row: grid.row - oldPos.row - 1 })
        break
      case 'center':
        posArray.push({ col: grid.col - oldPos.col - 1, row: oldPos.row })
        posArray.push({ col: oldPos.col, row: grid.row - oldPos.row - 1 })
        posArray.push({ col: grid.col - oldPos.col - 1, row: grid.row - oldPos.row - 1 })
        break
    }
    eraseMode.value = true
    eraseGrid(posArray, currentColor.value)
    window.addEventListener('mousemove', onDrawing)
    window.addEventListener('mouseup', onStopDraw)
    saveCanvasState()
    updatePreview()
  }

  function onDraggingSelection(e) {
    // e.stopPropagation()
    const newPos = getGridPosByMouse(e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x, e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x)
    if (!(newPos.col === oldPos.col && newPos.row === oldPos.row)) {
      selRect.col = newPos.col - delta.x
      if (selRect.col < 0) selRect.col = 0
      if (selRect.col + selRect.w > grid.col) selRect.col = grid.col - selRect.w
      selRect.row = newPos.row - delta.y
      if (selRect?.row < 0) selRect.row = 0
      if (selRect?.row + selRect.h > grid.row) selRect.row = grid.row - selRect.h
      // console.log(dx, dy)
      drawSelection()
      drawControl()
    }
  }
  function onStopDragSelection() {
    window.removeEventListener('mousemove', onDraggingSelection)
    window.removeEventListener('mouseup', onStopDragSelection)
  }

  function onDraggingCanvas(e) {
    console.log('dragging canvas')
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
    console.log('stop dragging canvas')
    window.removeEventListener('mousemove', onDraggingCanvas)
    window.removeEventListener('mouseup', onStopDragCanvas)
  }

  // 绘制选区
  function onDrawingSelection(e) {
    const newX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    const newY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
    let newPos = getGridPosByMouse(newX, newY)
    console.log('move sele')
    var col, row, w, h
    if (button === 0) {
      if (newPos.col >= grid.col) newPos.col = grid.col
      else if (newPos.col < 0) newPos.col = 0
      if (newPos.row >= grid.row) newPos.row = grid.row
      else if (newPos.row < 0) newPos.row = 0
      col = oldPos.col <= newPos.col ? oldPos.col : newPos.col
      row = oldPos.row <= newPos.row ? oldPos.row : newPos.row
      w = Math.abs(oldPos.col - newPos.col) + 1
      h = Math.abs(oldPos.row - newPos.row) + 1
      if (w + col > grid.col) w--
      if (h + row > grid.row) h--
      selRect = { col: col, row: row, w: w, h: h }
      console.log(oldPos, newPos)
      drawSelection()
    }
  }

  // 停止绘制选区
  function onStopDrawSelection() {
    drawControl()
    window.removeEventListener('mousemove', onDrawingSelection)
    window.removeEventListener('mouseup', onStopDrawSelection)
  }

  function onDrawing(e) {
    console.log('move')
    // 如果在绘画时有键盘按键按下
    if (currentKey.value) {
      currentKey.value = ''
      // return
    }
    const newX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    const newY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
    const posArray = []
    let newPos = getGridPosByMouse(newX, newY)
    // console.log('ppos', oldPos, newPos)
    if (!newPos || (newPos.col == prevPos.col && newPos.row == prevPos.row)) return
    prevPos = { col: newPos.col, row: newPos.row }
    posArray.push({ col: newPos.col, row: newPos.row })
    switch (mirrorMode.value) {
      case 'horizontal':
        posArray.push({ col: grid.col - newPos.col - 1, row: newPos.row })
        break
      case 'vertical':
        posArray.push({ col: newPos.col, row: grid.row - newPos.row - 1 })
        break
      case 'center':
        posArray.push({ col: grid.col - newPos.col - 1, row: newPos.row })
        posArray.push({ col: newPos.col, row: grid.row - newPos.row - 1 })
        posArray.push({ col: grid.col - newPos.col - 1, row: grid.row - newPos.row - 1 })
        break
    }
    // 左键：绘制
    if (button == 0) {
      if (currentColor.value == '#00000000') {
        eraseGrid(posArray, currentColor.value)
      }
      fillGrid(posArray, currentColor.value)
    }
    // 右键：擦除
    else if (button == 2) {
      eraseGrid(posArray, currentColor.value)
    }
  }

  function onStopDraw(e) {
    // console.log('mouse up')
    const newX = e.clientX + drawEl.scrollLeft - dragEl.offsetLeft - gridElRect.left - grid.x
    const newY = e.clientY + drawEl.scrollTop - dragEl.offsetTop - gridElRect.top - grid.x
    let newPos = getGridPosByMouse(newX, newY)
    if (newPos) {
      const timeDiff = new Date().getTime() - mouseInfo.time
      if (mouseInfo.target === e.target && timeDiff < 200) {
        // 单击
        console.log('click')
        const posArray = []
        posArray.push({ col: newPos.col, row: newPos.row })
        switch (mirrorMode.value) {
          case 'horizontal':
            posArray.push({ col: grid.col - newPos.col - 1, row: newPos.row })
            break
          case 'vertical':
            posArray.push({ col: newPos.col, row: grid.row - newPos.row - 1 })
            break
          case 'center':
            posArray.push({ col: grid.col - newPos.col - 1, row: newPos.row })
            posArray.push({ col: newPos.col, row: grid.row - newPos.row - 1 })
            posArray.push({ col: grid.col - newPos.col - 1, row: grid.row - newPos.row - 1 })
            break
        }
        // 左键：绘制
        if (button == 0) {
          if (currentColor.value == '#00000000') {
            eraseGrid(posArray, currentColor.value)
          }
          fillGrid(posArray, currentColor.value)
        }
        // 右键：擦除
        else if (button == 2) {
          eraseGrid(posArray, currentColor.value)
        }
      }
      eraseMode.value = false
      updatePreview()
      saveCanvasState()
    }

    window.removeEventListener('mousemove', onDrawing)
    window.removeEventListener('mouseup', onStopDraw)
  }
}
</script>

<style lang="scss" scoped>
.cur-move {
  cursor: move;
}
.cur-pen {
  cursor: url('@/assets/pen.png') 8 23, auto;
}
.cur-fill {
  cursor: url('@/assets/fill.png') 22 23, auto;
}
.cur-drop {
  cursor: url('@/assets/dropper.png') 8 23, auto;
}
.cur-erase {
  cursor: url('@/assets/eraser.png') 8 23, auto;
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
  justify-content: flex-start;
  padding: 0 24px;
  height: 80px;
  background: #fff;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.tools {
  list-style-type: none;
  padding: 0;
  margin: 0 12px 0 0;
  cursor: pointer;
  li {
    line-height: 0;
    margin: 0px;
    display: inline-block;
    border-top: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
    padding: 0 2px;
    &:first-child {
      border-left: 1px solid #ccc;
      border-top-left-radius: 5px;
      border-bottom-left-radius: 5px;
    }
    &:last-child {
      border-right: 1px solid #ccc;
      border-top-right-radius: 5px;
      border-bottom-right-radius: 5px;
    }
    &:not(:first-child):not(:first-child) {
      border-left: 1px solid #ccc;
    }
  }
  .active {
    background: #419eff;
  }
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
.selection {
  top: 0px;
  left: 0px;
  position: absolute;
  z-index: 2;
  pointer-events: none;
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
  pointer-events: none;
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
