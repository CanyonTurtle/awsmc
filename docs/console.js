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
const FRAMEBUFFER_ADDR = 0x200;
const CONFIG_ADDR = 0x10;
const TOUCH_RINGBUFFER_ADDR = 0x20;
const TOUCHES_COUNT = 10;
const TOUCH_STRUCT_SIZE = 6; // 2 bytes for X, 2 bytes for Y, 2 bytes for generation

export function requestFullscreen () {
    if (document.fullscreenElement == null) {
        function expandIframe () {
            // Fullscreen failed, try to maximize our own iframe. We don't yet have a button to go
            // back to minimized, but this at least makes games on wasm4.org playable on iPhone
            const iframe = window.frameElement;
            if (iframe) {
                iframe.style.position = "fixed";
                iframe.style.top = "0";
                iframe.style.left = "0";
                iframe.style.zIndex = "99999";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
            }
        }

        const promise = document.body.requestFullscreen && document.body.requestFullscreen({navigationUI: "hide"});
        if (promise) {
            promise.catch(expandIframe);
        } else {
            expandIframe();
        }
    }
}

// Initialize the ring buffer for touches
function update_touch_ringbuffer(awsm_console) {
    let memory = awsm_console.memory;
    let touchRingBuffer = new Uint8Array(memory.buffer, TOUCH_RINGBUFFER_ADDR, TOUCHES_COUNT * TOUCH_STRUCT_SIZE);
    touchRingBuffer.fill(0);
    let idx = 0;
    for (const [_, value] of awsm_console.activeTouches.entries()) {
        // Store touch information in the ring buffer
        let [screenX, screenY, generation] = value;
        const touchIndex = idx * TOUCH_STRUCT_SIZE;
        touchRingBuffer[touchIndex + 1] = (screenX >> 8) & 0xff;
        touchRingBuffer[touchIndex + 0] = screenX;
        touchRingBuffer[touchIndex + 3] = (screenY >> 8) & 0xff;
        touchRingBuffer[touchIndex + 2] = screenY;
        touchRingBuffer[touchIndex + 5] = (generation >> 8) & 0xff;
        touchRingBuffer[touchIndex + 4] = generation;

        // nextTouchIndex = (nextTouchIndex + 1) % TOUCHES_COUNT;
        idx += 1;
    }

    awsm_console.generation += 1;
    
}

/**
 * Binds touch and mouse input handlers to update the console's running list of active touches.
 * @param {any} awsm_console
 */
function bind_input_handlers(awsm_console) {
    
    let mousedown = false;
    awsm_console.activeTouches = new Map();
    awsm_console.generation = 0;

    function handleTouchEvent(event, removing) {
        requestFullscreen();
        event.preventDefault();
    
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            addTouch(touch.identifier, removing, touch.clientX, touch.clientY);
        }
    }
    
    function handleMouseEvent(event, removing) {
        event.preventDefault();
    
        addTouch(-1, removing, event.clientX, event.clientY);
    }

    /**
     * Handle a touch event, either adding it or removing it from our actively-maintained list of touches.
     * @param {number} id the touch ID
     * @param {bool} removing if true, remove this ID. if false, add or modify.
     * @param {any} x the client touch X position
     * @param {any} y the client touch Y position.
     */
    function addTouch(id, removing, x, y) {
        
        if (removing) {
            awsm_console.activeTouches.delete(id);
            return;
        }   

        const canvas = document.getElementById('screen');
        const rect = canvas.getBoundingClientRect();
    
        // Calculate screen coordinates based on canvas size and client coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const screenX = Math.floor((x - rect.left) * scaleX);
        const screenY = Math.floor((y - rect.top) * scaleY);
    
        // If the touch events were oob, delete them.
        if (screenX < 0 || screenX >= canvas.width || screenY < 0 || screenY >= canvas.height) {
            awsm_console.activeTouches.delete(id);
            return;
        }
  
        // This will either update existing touches or add new ones, which will preserve the ordering.
        awsm_console.activeTouches.set(id, [screenX, screenY, awsm_console.generation])

    }

    const touch_update = (e) => {handleTouchEvent(e, false)}
    const touch_delete = (e) => {handleTouchEvent(e, true)}

    const handle_mousemove = (e) => {if(mousedown) {handleMouseEvent(e, false);}};
    const handle_mousedown = (e) => {mousedown = true; handleMouseEvent(e, false);};
    const handle_mouseup = (e) => {mousedown = false; handleMouseEvent(e, true);};

    // Attach touch event listeners

    const rebind_listener = (ltype, func)  => {
        window.removeEventListener(ltype, func, {passive: false})
        window.addEventListener(ltype, func, {passive: false})
    };

    for (const [ltype, func] of [
        ['touchstart', touch_update],
        ['touchmove', touch_update],
        ['touchend', touch_delete],
        ['touchcancel', touch_delete],
        ['mousemove', handle_mousemove],
        ['mousedown', handle_mousedown],
        ['mouseup', handle_mouseup],
    ]) {
        rebind_listener(ltype, func);
    }

    // window.addEventListener('touchstart', touch_update, { passive: false });
    // window.addEventListener('touchmove', touch_update, { passive: false });
    // window.addEventListener('touchend', touch_delete, { passive: false });
    // window.addEventListener('touchcancel', touch_delete, { passive: false });
    // window.addEventListener('mousemove', handle_mousemove, { passive: false });
    // window.addEventListener('mousedown', handle_mousedown, { passive: false });
    // window.addEventListener('mouseup', handle_mouseup, { passive: false });
}

// Define our virtual console
export function configure(awsm_console) {

    let memory = awsm_console.memory;

    const configData = new Uint16Array(memory.buffer, CONFIG_ADDR, 4);
    awsm_console.width = configData[0];
    awsm_console.height = configData[1];

    const bufferData = new Uint8Array(memory.buffer, FRAMEBUFFER_ADDR, awsm_console.width * awsm_console.height * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)

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


    bind_input_handlers(awsm_console);
}

export function update(awsm_console) {

    update_touch_ringbuffer(awsm_console);

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

export async function init() {
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

export default async function run() {
    const awsm_console = await init();
    awsm_console._configure();
    configure(awsm_console);
    
    setInterval(() => {
        awsm_console._update();
        update(awsm_console);
    }, 1000 / 60);
    const canvas = document.getElementById('screen');

    // Set the canvas internal width and height
    const canvasWidth = awsm_console.width;
    const canvasHeight = awsm_console.height;
    // canvas.width = canvasWidth;
    // canvas.height = canvasHeight; -->

    function resizeCanvas() {
        // console.log("resized");
        // Get the current size of the canvas container
        const containerWidth = canvas.parentNode.clientWidth;
        const containerHeight = canvas.parentNode.clientHeight;

        // Calculate the scale for width and height
        const scaleWidth = containerWidth / canvasWidth;
        const scaleHeight = containerHeight / canvasHeight;

        // Determine the scale to fit the canvas while preserving aspect ratio
        let scale = Math.min(scaleWidth, scaleHeight);
        // console.log(scale);

        // Calculate the new dimensions
        const newWidth = Math.floor(canvasWidth * scale);
        const newHeight = Math.floor(canvasHeight * scale);

        // Set the canvas size
        canvas.style.width = newWidth + 'px';
        canvas.style.height = newHeight + 'px';
    }

    // Initial resize
    resizeCanvas();

    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
}
run();