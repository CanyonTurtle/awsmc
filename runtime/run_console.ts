import type {AwsmConsole} from "./awsm_console_types.ts"

// import cart from "../build/cart.wasm"
import {decode} from "./z85.ts"

let gl: WebGL2RenderingContext;

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

var filterStrength: number = 20;
var frameTime: number = 0;
var lastLoop: Date = new Date();
var thisLoop: Date = new Date();


const FRAMEBUFFER_BYPP = 4;
const CONFIG_ADDR = 0x10;
const TOUCHES_COUNT = 10;
const TOUCH_STRUCT_SIZE = 6; // 2 bytes for X, 2 bytes for Y, 2 bytes for generation

export function requestFullscreen () {
    if (document.fullscreenElement == null) {
        function expandIframe () {
            // Fullscreen failed, try to maximize our own iframe. We don't yet have a button to go
            // back to minimized, but this at least makes games on wasm4.org playable on iPhone
            const iframe = window.frameElement;
            if (iframe) {
                let styled_iframe = iframe as HTMLElement
                styled_iframe.style.position = "fixed";
                styled_iframe.style.top = "0";
                styled_iframe.style.left = "0";
                styled_iframe.style.zIndex = "99999";
                styled_iframe.style.width = "100%";
                styled_iframe.style.height = "100%";
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





function update_touch_ringbuffer(awsm_console: AwsmConsole) {
    let memory = awsm_console.memory;
    let touchRingBuffer = new Uint8Array(memory.buffer, awsm_console.config.info_addr, TOUCHES_COUNT * TOUCH_STRUCT_SIZE);
    touchRingBuffer.fill(0);
    let idx = 0;
    for (const [_, value] of awsm_console.info.player_inputs[0].active_touches.entries()) {
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

    awsm_console.info.touch_generation += 1;
    
}

/**
 * Binds touch and mouse input handlers to update the console's running list of active touches.
 * @param {any} awsm_console
 */
function bind_input_handlers(awsm_console: AwsmConsole) {
    
    let mousedown = false;
    awsm_console.info.player_inputs[0].active_touches = new Map();
    awsm_console.info.touch_generation = 0;

    function handleTouchEvent(event: TouchEvent, removing: boolean) {
        
        event.preventDefault();
    
        const touches = event.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            addTouch(touch.identifier, removing, touch.clientX, touch.clientY);
        }
    }
    
    function handleMouseEvent(event: MouseEvent, removing: boolean) {
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
    function addTouch(id: number, removing: boolean, x: number, y: number) {
        
        if (removing) {
            awsm_console.info.player_inputs[0].active_touches.delete(id);
            return;
        }   

        const canvas = document.getElementById('screen') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
    
        // Calculate screen coordinates based on canvas size and client coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const screenX = Math.floor((x - rect.left) * scaleX);
        const screenY = Math.floor((y - rect.top) * scaleY);
    
        // If the touch events were oob, delete them.
        if (screenX < 0 || screenX >= canvas.width || screenY < 0 || screenY >= canvas.height) {
            awsm_console.info.player_inputs[0].active_touches.delete(id);
            return;
        }
  
        // This will either update existing touches or add new ones, which will preserve the ordering.
        awsm_console.info.player_inputs[0].active_touches.set(id, [screenX, screenY, awsm_console.info.touch_generation])

    }

    const touch_update = (e: TouchEvent) => {handleTouchEvent(e, false)}
    const touch_delete = (e: TouchEvent) => {handleTouchEvent(e, true)}

    const handle_mousemove = (e: MouseEvent) => {if(mousedown) {handleMouseEvent(e, false);}};
    const handle_mousedown = (e: MouseEvent) => {mousedown = true; handleMouseEvent(e, false);};
    const handle_mouseup = (e: MouseEvent) => {mousedown = false; handleMouseEvent(e, true);};

    // Attach touch event listeners

    const screen_el = document.getElementById("screen")!;

    const rebind_listener = (ltype: string, func: EventListener)  => {
        screen_el.removeEventListener(ltype, func);
        screen_el.addEventListener(ltype, func, {passive: false});
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
        rebind_listener((<string>ltype), (<EventListener>func));
    }

    document.getElementById("fullscreen-btn")!.addEventListener("click", (e: Event) => {
        e.preventDefault();
        requestFullscreen();
    });
}

// Define our virtual console
export function process_awsm_config(awsm_console: AwsmConsole) {

    let memory = awsm_console.memory;

    // Load in the settings from the .wasm console, as set in configure().
    const configData = new Uint16Array(memory.buffer, CONFIG_ADDR, 7);
    awsm_console.config = {
        framebuffer_addr:   ((configData[1] << 16) & 0xffff0000) | (configData[0] & 0xffff),
        info_addr: ((configData[3] << 16) & 0xffff0000) | (configData[2] & 0xffff),
        logical_width_px: configData[4],
        logical_height_px: configData[5],
        max_n_players: configData[6],
    };

    const bufferData = new Uint8Array(memory.buffer, awsm_console.config.framebuffer_addr, awsm_console.config.logical_width_px * awsm_console.config.logical_height_px * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)

    // Create WebGL context
    const canvas = document.getElementById('screen') as HTMLCanvasElement;
    canvas.width = awsm_console.config.logical_width_px;
    canvas.height = awsm_console.config.logical_height_px;
    gl = canvas.getContext('webgl') as WebGL2RenderingContext;

    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Create vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
        return;
    }

    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    // Create shader program
    const program = gl.createProgram()!;
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, awsm_console.config.logical_width_px, awsm_console.config.logical_height_px, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    // Set resolution uniform
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    gl.uniform2f(resolutionUniformLocation, awsm_console.config.logical_width_px, awsm_console.config.logical_height_px);


    bind_input_handlers(awsm_console);
}

export function process_awsm_update(awsm_console: AwsmConsole) {

    update_touch_ringbuffer(awsm_console);

    let memory = awsm_console.memory;
    thisLoop = new Date();
    let thisFrameTime = thisLoop.getTime() - lastLoop.getTime();
    frameTime += (thisFrameTime - frameTime) / filterStrength;
    lastLoop = thisLoop;

    // the framebuffer data for this frame.
    const framebuffer_data_this_frame = new Uint8Array(
        memory.buffer,
        awsm_console.config.framebuffer_addr,
        awsm_console.config.logical_width_px * awsm_console.config.logical_height_px * FRAMEBUFFER_BYPP
    );

    // Update the texture with the screen buffer data
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, awsm_console.config.logical_width_px, awsm_console.config.logical_height_px, gl.RGBA, gl.UNSIGNED_BYTE, framebuffer_data_this_frame);

    // Clear the screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the screen
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
}

export async function init(): Promise<AwsmConsole> {
    const memory = new WebAssembly.Memory({ initial: 256 });
    const imports = {
        env: {
            memory,
        },
    };

    const cartdata_el = document.getElementById("cartdata")!;
    const encoded = cartdata_el.getAttribute("data-cart")!;
    const encoded_len = Number(cartdata_el.getAttribute("data-cartlen")!)!;

    // console.log(encoded)

    // function asciiToBinary(str: any) {
    //     if (typeof atob === 'function') {
    //         return atob(str)
    //     } else {
    //         return new Buffer(str, 'base64').toString('binary');
    //     }
    // }

    // function decode(encoded: any) {
    //     var binaryString = asciiToBinary(encoded);
    //     var bytes = new Uint8Array(binaryString.length);
    //     for (var i = 0; i < binaryString.length; i++) {
    //         bytes[i] = binaryString.charCodeAt(i);
    //     }
    //     return bytes.buffer;
    // }

    const decoded_cart = new Uint8Array(encoded_len);
    decode(encoded, decoded_cart)

    const { instance } = await WebAssembly.instantiate(decoded_cart, imports);

    // Expose the configure and update functions

    let awsm_console: AwsmConsole = {
        memory: instance.exports.memory as WebAssembly.Memory,
        config: {
            framebuffer_addr: 0,
            info_addr: 0,
            logical_width_px: 64,
            logical_height_px: 64,
            max_n_players: 0,
        },
        info: {
            device_width: 64,
            device_height: 64,
            netplay_player_number: 0,
            player_inputs: [
                {
                    active_touches: new Map(),
                    keys_input: 0,
                },
            ],
            touch_generation: 0
        },
        exported_functions: {
            _configure: instance.exports.configure as Function,
            _update: instance.exports.update as Function,
        },
        provided_builtins: {}
    };
   
    return awsm_console;
}



export default async function run() {

    const awsm_console = await init();

    awsm_console.exported_functions._configure();
    process_awsm_config(awsm_console);
    
    setInterval(() => {
        awsm_console.exported_functions._update();
        process_awsm_update(awsm_console);
    }, 1000 / 60);
    const canvas = document.getElementById('screen') as HTMLCanvasElement;

    // Set the canvas internal width and height
    const canvasWidth = awsm_console.config.logical_width_px;
    const canvasHeight = awsm_console.config.logical_height_px;
    // canvas.width = canvasWidth;
    // canvas.height = canvasHeight; -->

    function resizeCanvas() {
        // console.log("resized");
        // Get the current size of the canvas container
        const containerWidth = (<any>canvas.parentNode).clientWidth;
        const containerHeight = (<any>canvas.parentNode).clientHeight;

        awsm_console.info.device_width = containerWidth;
        awsm_console.info.device_height = containerHeight;

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

    var fpsOut = document.getElementById('fpsOut')!;
    setInterval(function(){
        fpsOut.innerHTML = (1000/frameTime).toFixed(1) + " fps";
    },1000);
}