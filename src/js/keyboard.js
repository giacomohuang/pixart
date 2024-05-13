let Keyboard = {
  getKey(e) {
    var evt = e || event
    const keyCode = evt.keyCode || evt.which || evt.charCode
    const keyName = KEY_NAME[keyCode]
    return { ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, shift: e.shiftKey, code: keyCode, name: keyName }
  },
  getComboKey(e) {
    let comboKey = ''
    var evt = e || event
    const keyCode = evt.keyCode || evt.which || evt.charCode
    const keyName = KEY_NAME[keyCode]
    let comboArray = []
    if (e.ctrlKey) {
      IS_MAC ? comboArray.push('CONTROL') : comboArray.push('CTRL')
    }
    if (e.altKey) {
      IS_MAC ? comboArray.push('OPTION') : comboArray.push('ALT')
    }
    if (e.metaKey) {
      IS_MAC ? comboArray.push('CMD') : comboArray.push('WIN')
    }
    if (e.shiftKey) {
      comboArray.push('SHIFT')
    }
    if (keyName) comboArray.push(keyName)

    // console.log(keyName, keyCode, comboArray)

    comboArray.forEach((key, index) => {
      if (index !== 0) {
        comboKey += '+'
      }
      comboKey += key
    })
    return comboKey
  }
}

const IS_MAC = navigator.userAgent.includes('Mac')

const KEY_NAME = {
  65: 'A',
  66: 'B',
  67: 'C',
  68: 'D',
  69: 'E',
  70: 'F',
  71: 'G',
  72: 'H',
  73: 'I',
  74: 'J',
  75: 'K',
  76: 'L',
  77: 'M',
  78: 'N',
  79: 'O',
  80: 'P',
  81: 'Q',
  82: 'R',
  83: 'S',
  84: 'T',
  85: 'U',
  86: 'V',
  87: 'W',
  88: 'X',
  89: 'Y',
  90: 'Z',
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',
  8: 'BACKSPACE',
  9: 'TAB',
  12: 'CLEAR',
  13: 'ENTER',
  20: 'CAPSLOCK',
  27: 'ESC',
  32: 'SPACE',
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  45: 'INSERT',
  46: 'DELETE',
  112: 'F1',
  113: 'F2',
  114: 'F3',
  115: 'F4',
  116: 'F5',
  117: 'F6',
  118: 'F7',
  119: 'F8',
  120: 'F9',
  121: 'F10',
  122: 'F11',
  123: 'F12',
  144: 'NUMLOCK',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'"
}

// ⌘⎋⏎↩︎⏏︎⇥⇤⇪⇧⌥⌃⌫↑↓→←

export default Keyboard
