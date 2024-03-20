let consoleMemory;
let screenBuffer;
let gl;

// Vertex shader source
const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
    }
`;

// Fragment shader source
const fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        gl_FragColor = texture2D(u_texture, uv);
    }
`;

var filterStrength = 20;
var frameTime = 0, lastLoop = new Date, thisLoop;


const FRAMEBUFFER_BYPP = 4;
const FRAMEBUFFER_ADDR = 0x100;
const CONFIG_ADDR = 0x10;
const TOUCH_RINGBUFFER_ADDR = 0x20;
const TOUCHES_COUNT = 10;
const TOUCH_STRUCT_SIZE = 6; // 2 bytes for X, 2 bytes for Y, 2 bytes for generation

export function bind_input_handlers(awsm_console) {
    let memory = awsm_console.memory;
    
    // Initialize the ring buffer for touches
    let touchRingBuffer = new Uint16Array(memory.buffer, TOUCH_RINGBUFFER_ADDR, TOUCHES_COUNT * TOUCH_STRUCT_SIZE);
    let nextTouchIndex = 0;
    let generation = 0;

    function handleTouchEvent(event) {
        event.preventDefault();
    
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            addTouch(touch.clientX, touch.clientY);
        }
    }
    
    function handleMouseEvent(event) {
        event.preventDefault();
    
        addTouch(event.clientX, event.clientY);
    }
    
    function addTouch(x, y) {
        console.log(x, y)

        const canvas = document.getElementById('screen');
        const rect = canvas.getBoundingClientRect();
    
        // Calculate screen coordinates based on canvas size and client coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const screenX = Math.floor((x - rect.left) * scaleX);
        const screenY = Math.floor((y - rect.top) * scaleY);
    

        // Store touch information in the ring buffer
        const touchIndex = nextTouchIndex * TOUCH_STRUCT_SIZE;
        touchRingBuffer[touchIndex] = Math.floor(screenX);
        touchRingBuffer[touchIndex + 1] = Math.floor(screenY);
        touchRingBuffer[touchIndex + 2] = generation;
    
        nextTouchIndex = (nextTouchIndex + 1) % TOUCHES_COUNT;
        if (nextTouchIndex === 0) {
            // Increment generation when the ring buffer wraps around
            generation++;
        }
    }

    // Clear the touch buffer on touch end
    function clearTouchBuffer() {
        // touchRingBuffer.fill(0);
    }

    // Attach touch event listeners
    window.addEventListener('touchstart', handleTouchEvent, { passive: false });
    window.addEventListener('touchmove', handleTouchEvent, { passive: false });
    window.addEventListener('touchend', clearTouchBuffer, { passive: false });
    window.addEventListener('touchcancel', clearTouchBuffer, { passive: false });

    window.addEventListener('mousemove', handleMouseEvent, { passive: false });
    window.addEventListener('mousedown', handleMouseEvent, { passive: false });
    window.addEventListener('mouseup', clearTouchBuffer, { passive: false });
}

// Define our virtual console
export function configure(awsm_console) {
    let memory = awsm_console.memory;

    const configData = new Uint16Array(memory.buffer, CONFIG_ADDR, 4);
    awsm_console.width = configData[0];
    awsm_console.height = configData[1];

    const bufferData = new Uint8Array(memory.buffer, FRAMEBUFFER_ADDR, awsm_console.width * awsm_console.height * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)



    // Initialize memory addresses
    // consoleMemory = new WebAssembly.Memory({ initial: 256 });
    // screenBuffer = new Uint8Array(consoleMemory.buffer, 0, FRAMEBUFFER_BYPP * WIDTH * HEIGHT);

    // Create WebGL context
    const canvas = document.getElementById('screen');
    canvas.width = awsm_console.width;
    canvas.height = awsm_console.height;
    gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Create vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        awsm_console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
        return;
    }

    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        awsm_console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    // Create shader program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Create a buffer for the position of the vertices
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, -1, +1, +1, +1,
        +1, +1, +1, -1, -1, -1,
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Create texture for screen buffer
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, awsm_console.width, awsm_console.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    // Set resolution uniform
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    gl.uniform2f(resolutionUniformLocation, awsm_console.width, awsm_console.height);
}

export function update(awsm_console) {
    let memory = awsm_console.memory;
    var thisFrameTime = (thisLoop=new Date) - lastLoop;
    frameTime+= (thisFrameTime - frameTime) / filterStrength;
    lastLoop = thisLoop;

    // console.log(memory) 
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    const bufferData = new Uint8Array(memory.buffer, FRAMEBUFFER_ADDR, awsm_console.width * awsm_console.height * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)
    // console.log(bufferData)
    // Update the texture with the screen buffer data
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, awsm_console.width, awsm_console.height, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);

    // Clear the screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the screen
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
}

export default async function init() {
    const memory = new WebAssembly.Memory({ initial: 256 });
    const imports = {
        env: {
            memory,
        },
    };

    const response = await fetch('console.wasm');
    const buffer = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buffer, imports);

    // Expose the configure and update functions
    let awsm_console = {
        _configure: instance.exports.configure,
        _update: instance.exports.update,
        memory: instance.exports.memory,
        width: 64,
        height: 64
    };
   
    return awsm_console;
}

var fpsOut = document.getElementById('fpsOut');
setInterval(function(){
fpsOut.innerHTML = (1000/frameTime).toFixed(1) + " fps";
},1000);