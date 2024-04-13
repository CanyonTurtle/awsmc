// src/console.ts
function requestFullscreen() {
  if (document.fullscreenElement == null) {
    let expandIframe = function() {
      const iframe = window.frameElement;
      if (iframe) {
        let styled_iframe = iframe;
        styled_iframe.style.position = "fixed";
        styled_iframe.style.top = "0";
        styled_iframe.style.left = "0";
        styled_iframe.style.zIndex = "99999";
        styled_iframe.style.width = "100%";
        styled_iframe.style.height = "100%";
      }
    };
    const promise = document.body.requestFullscreen && document.body.requestFullscreen({ navigationUI: "hide" });
    if (promise) {
      promise.catch(expandIframe);
    } else {
      expandIframe();
    }
  }
}
var update_touch_ringbuffer = function(awsm_console) {
  let memory = awsm_console.memory;
  let touchRingBuffer = new Uint8Array(memory.buffer, TOUCH_RINGBUFFER_ADDR, TOUCHES_COUNT * TOUCH_STRUCT_SIZE);
  touchRingBuffer.fill(0);
  let idx = 0;
  for (const [_, value] of awsm_console.activeTouches.entries()) {
    let [screenX, screenY, generation] = value;
    const touchIndex = idx * TOUCH_STRUCT_SIZE;
    touchRingBuffer[touchIndex + 1] = screenX >> 8 & 255;
    touchRingBuffer[touchIndex + 0] = screenX;
    touchRingBuffer[touchIndex + 3] = screenY >> 8 & 255;
    touchRingBuffer[touchIndex + 2] = screenY;
    touchRingBuffer[touchIndex + 5] = generation >> 8 & 255;
    touchRingBuffer[touchIndex + 4] = generation;
    idx += 1;
  }
  awsm_console.generation += 1;
};
var bind_input_handlers = function(awsm_console) {
  let mousedown = false;
  awsm_console.activeTouches = new Map;
  awsm_console.generation = 0;
  function handleTouchEvent(event, removing) {
    requestFullscreen();
    event.preventDefault();
    const touches = event.changedTouches;
    for (let i = 0;i < touches.length; i++) {
      const touch = touches[i];
      addTouch(touch.identifier, removing, touch.clientX, touch.clientY);
    }
  }
  function handleMouseEvent(event, removing) {
    event.preventDefault();
    addTouch(-1, removing, event.clientX, event.clientY);
  }
  function addTouch(id, removing, x, y) {
    if (removing) {
      awsm_console.activeTouches.delete(id);
      return;
    }
    const canvas = document.getElementById("screen");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = Math.floor((x - rect.left) * scaleX);
    const screenY = Math.floor((y - rect.top) * scaleY);
    if (screenX < 0 || screenX >= canvas.width || screenY < 0 || screenY >= canvas.height) {
      awsm_console.activeTouches.delete(id);
      return;
    }
    awsm_console.activeTouches.set(id, [screenX, screenY, awsm_console.generation]);
  }
  const touch_update = (e) => {
    handleTouchEvent(e, false);
  };
  const touch_delete = (e) => {
    handleTouchEvent(e, true);
  };
  const handle_mousemove = (e) => {
    if (mousedown) {
      handleMouseEvent(e, false);
    }
  };
  const handle_mousedown = (e) => {
    mousedown = true;
    handleMouseEvent(e, false);
  };
  const handle_mouseup = (e) => {
    mousedown = false;
    handleMouseEvent(e, true);
  };
  const rebind_listener = (ltype, func) => {
    window.removeEventListener(ltype, func, { passive: false });
    window.addEventListener(ltype, func, { passive: false });
  };
  for (const [ltype, func] of [
    ["touchstart", touch_update],
    ["touchmove", touch_update],
    ["touchend", touch_delete],
    ["touchcancel", touch_delete],
    ["mousemove", handle_mousemove],
    ["mousedown", handle_mousedown],
    ["mouseup", handle_mouseup]
  ]) {
    rebind_listener(ltype, func);
  }
};
function configure(awsm_console) {
  let memory = awsm_console.memory;
  const configData = new Uint16Array(memory.buffer, CONFIG_ADDR, 4);
  awsm_console.width = configData[0];
  awsm_console.height = configData[1];
  const bufferData = new Uint8Array(memory.buffer, FRAMEBUFFER_ADDR, awsm_console.width * awsm_console.height * FRAMEBUFFER_BYPP);
  const canvas = document.getElementById("screen");
  canvas.width = awsm_console.width;
  canvas.height = awsm_console.height;
  gl = canvas.getContext("webgl");
  if (!gl) {
    alert("WebGL not supported");
    return;
  }
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error("Vertex shader compilation error:", gl.getShaderInfoLog(vertexShader));
    return;
  }
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error("Fragment shader compilation error:", gl.getShaderInfoLog(fragmentShader));
    return;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,
    -1,
    -1,
    1,
    1,
    1,
    1,
    1,
    1,
    -1,
    -1,
    -1
  ]), gl.STATIC_DRAW);
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, awsm_console.width, awsm_console.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
  const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
  gl.uniform2f(resolutionUniformLocation, awsm_console.width, awsm_console.height);
  bind_input_handlers(awsm_console);
}
function update(awsm_console) {
  update_touch_ringbuffer(awsm_console);
  let memory = awsm_console.memory;
  thisLoop = new Date;
  let thisFrameTime = thisLoop.getTime() - lastLoop.getTime();
  frameTime += (thisFrameTime - frameTime) / filterStrength;
  lastLoop = thisLoop;
  const bufferData = new Uint8Array(memory.buffer, FRAMEBUFFER_ADDR, awsm_console.width * awsm_console.height * FRAMEBUFFER_BYPP);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, awsm_console.width, awsm_console.height, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
}
async function init() {
  const memory = new WebAssembly.Memory({ initial: 256 });
  const imports = {
    env: {
      memory
    }
  };
  const encoded = document.getElementById("cartdata").getAttribute("data-cart");
  console.log(encoded);
  function asciiToBinary(str) {
    if (typeof atob === "function") {
      return atob(str);
    } else {
      return new Buffer(str, "base64").toString("binary");
    }
  }
  function decode(encoded2) {
    var binaryString = asciiToBinary(encoded2);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0;i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const { instance } = await WebAssembly.instantiate(decode(encoded), imports);
  let awsm_console = {
    _configure: instance.exports.configure,
    _update: instance.exports.update,
    memory: instance.exports.memory,
    width: 64,
    height: 64,
    activeTouches: new Map,
    generation: 0
  };
  return awsm_console;
}
var gl;
var vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
    }
`;
var fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        gl_FragColor = texture2D(u_texture, uv);
    }
`;
var filterStrength = 20;
var frameTime = 0;
var lastLoop = new Date;
var thisLoop = new Date;
var FRAMEBUFFER_BYPP = 4;
var FRAMEBUFFER_ADDR = 512;
var CONFIG_ADDR = 16;
var TOUCH_RINGBUFFER_ADDR = 32;
var TOUCHES_COUNT = 10;
var TOUCH_STRUCT_SIZE = 6;
async function run() {
  const awsm_console = await init();
  awsm_console._configure();
  configure(awsm_console);
  setInterval(() => {
    awsm_console._update();
    update(awsm_console);
  }, 16.666666666666668);
  const canvas = document.getElementById("screen");
  const canvasWidth = awsm_console.width;
  const canvasHeight = awsm_console.height;
  function resizeCanvas() {
    const containerWidth = canvas.parentNode.clientWidth;
    const containerHeight = canvas.parentNode.clientHeight;
    const scaleWidth = containerWidth / canvasWidth;
    const scaleHeight = containerHeight / canvasHeight;
    let scale = Math.min(scaleWidth, scaleHeight);
    const newWidth = Math.floor(canvasWidth * scale);
    const newHeight = Math.floor(canvasHeight * scale);
    canvas.style.width = newWidth + "px";
    canvas.style.height = newHeight + "px";
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  var fpsOut = document.getElementById("fpsOut");
  setInterval(function() {
    fpsOut.innerHTML = (1000 / frameTime).toFixed(1) + " fps";
  }, 1000);
}
export {
  update,
  requestFullscreen,
  init,
  run as default,
  configure
};
