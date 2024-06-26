import { ALL_INPUTS_SIZE, CLIENT_INPUT_SIZE, FRAMEBUFFER_BYPP, KEYS_VALUES, TOUCHES_COUNT, TOUCH_STRUCT_SIZE, type AwsmConsole } from "./awsmc_console_types.ts"

// import cart from "../build/cart.wasm"
import { decode } from "./base64.ts"

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




export function toggleFullscreen() {
    if (document.fullscreenElement == null) {
        function expandIframe() {
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

        const promise = document.body.requestFullscreen && document.body.requestFullscreen({ navigationUI: "hide" });
        if (promise) {
            promise.catch(expandIframe);
        } else {
            expandIframe();
        }
    } else {
        document.exitFullscreen();
    }
}

const mobileAndTabletCheck = (): boolean => {
    let check = false;
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

const fill_uint_at_loc = (mode: "u8" | "u16" | "u32", arr: Uint8Array, idx_u8: number, value: number): void => {
    let size = (mode === "u8") ? 1 : ((mode === "u16") ? 2 : 4);
    for(let i = 0; i < size; i++) {
        arr[idx_u8 + i] = (value >> (i * 8)) & 0xff;
    }
}


function update_this_client_info(awsm_console: AwsmConsole) {

    let memory = awsm_console.memory;
    awsm_console.buffers.info = new Uint8Array(memory!.buffer, awsm_console.config.info_addr, ALL_INPUTS_SIZE + 14);

    // update the information-type info.
    fill_uint_at_loc("u32", awsm_console.buffers.info!, 0, awsm_console.info.device_width);
    fill_uint_at_loc("u32", awsm_console.buffers.info!, 4, awsm_console.info.device_height);
    fill_uint_at_loc("u16", awsm_console.buffers.info!, 8, awsm_console.info.netplay_client_number);
    fill_uint_at_loc("u16", awsm_console.buffers.info!, 10, awsm_console.info.touch_generation);
    fill_uint_at_loc("u16", awsm_console.buffers.info!, 12, awsm_console.info.is_mobile);


    // update the touchscreen inputs.

    const ips = new Uint8Array(awsm_console.memory!.buffer, awsm_console.config.info_addr + 0x16, ALL_INPUTS_SIZE);
    ips.fill(0);

    let idx = 0;
    for (const [_, value] of awsm_console._runtime_state.active_touches.entries()) {
        // Store touch information in the ring buffer
        let [screenX, screenY, generation] = value;
        const touchIndex = CLIENT_INPUT_SIZE * awsm_console.info.netplay_client_number + idx * TOUCH_STRUCT_SIZE;
        ips[touchIndex + 1] = (screenX >> 8) & 0xff;
        ips[touchIndex + 0] = screenX;
        ips[touchIndex + 3] = (screenY >> 8) & 0xff;
        ips[touchIndex + 2] = screenY;
        ips[touchIndex + 5] = (generation >> 8) & 0xff;
        ips[touchIndex + 4] = generation;

        // nextTouchIndex = (nextTouchIndex + 1) % TOUCHES_COUNT;
        idx += 1;
    }

    // update keyboard input for this client's player
    fill_uint_at_loc("u32", awsm_console.buffers.info!, 16 + CLIENT_INPUT_SIZE * awsm_console.info.netplay_client_number + TOUCHES_COUNT * TOUCH_STRUCT_SIZE, awsm_console.info.inputs[awsm_console.info.netplay_client_number].keys_input);
    // console.log(awsm_console.info.inputs[awsm_console.info.netplay_client_number].keys_input)

    awsm_console.info.touch_generation += 1;
    // console.log(awsm_console.buffers.info);
}

/**
 * Binds touch and mouse input handlers to update the console's running list of active touches.
 * @param {any} awsm_console
 */
function bind_input_handlers(awsm_console: AwsmConsole) {

    let mousedown = false;
    awsm_console._runtime_state.active_touches = new Map();
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
            awsm_console._runtime_state.active_touches.delete(id);
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
            awsm_console._runtime_state.active_touches.delete(id);
            return;
        }

        // This will either update existing touches or add new ones, which will preserve the ordering.
        awsm_console._runtime_state.active_touches.set(id, [screenX, screenY, awsm_console.info.touch_generation])

    }

    const touch_update = (e: TouchEvent) => { handleTouchEvent(e, false) }
    const touch_delete = (e: TouchEvent) => { handleTouchEvent(e, true) }

    const handle_mousemove = (e: MouseEvent) => { if (mousedown) { handleMouseEvent(e, false); } };
    const handle_mousedown = (e: MouseEvent) => { mousedown = true; handleMouseEvent(e, false); };
    const handle_mouseup = (e: MouseEvent) => { mousedown = false; handleMouseEvent(e, true); };

    const special_keymaps: Map<string, number> = new Map([
        ["Space", 30],
        ["ArrowLeft", 0],
        ["ArrowRight", 1],
        ["ArrowUp", 2],
        ["ArrowDown", 3],
        ["Digit1", 31],
    ])

    const get_key_idx = (e: KeyboardEvent) => {
        let key_idx: number;
        if (e.isComposing) {
            return undefined;
        }
        if (e.code.startsWith("Key")) {
            const letter = e.code[3].toLowerCase();
            key_idx = KEYS_VALUES.indexOf(letter);
        } else if (special_keymaps.has(e.code)) {
            key_idx = special_keymaps.get(e.code)!;
        } else {
            return undefined;
        }

        return key_idx;
    }


    const handle_keydown = (e: KeyboardEvent) => {
        const key_idx = get_key_idx(e);
        if (key_idx !== undefined) {
            awsm_console.info.inputs[awsm_console.info.netplay_client_number].keys_input |= 0x1 << (31 - key_idx);
        }
    };

    const handle_keyup = (e: KeyboardEvent) => {
        const key_idx = get_key_idx(e);
        if (key_idx !== undefined) {
            awsm_console.info.inputs[awsm_console.info.netplay_client_number].keys_input &= ~(0x1 << (31 - key_idx));
        }
    }

    // Attach touch event listeners

    const screen_el = document.getElementById("screen")!;

    const rebind_listener = (listenee: HTMLElement, ltype: string, func: EventListener) => {
        listenee.removeEventListener(ltype, func);
        listenee.addEventListener(ltype, func, { passive: false });
    };

    for (const [listenee, ltype, func] of [
        [screen_el, 'touchstart', touch_update],
        [screen_el, 'touchmove', touch_update],
        [screen_el, 'touchend', touch_delete],
        [screen_el, 'touchcancel', touch_delete],
        [screen_el, 'mousemove', handle_mousemove],
        [screen_el, 'mousedown', handle_mousedown],
        [screen_el, 'mouseup', handle_mouseup],
        [window, 'keydown', handle_keydown],
        [window, 'keyup', handle_keyup],
    ]) {
        rebind_listener(listenee as HTMLElement, (<string>ltype), (<EventListener>func));
    }

    document.getElementById("fullscreen-btn")!.addEventListener("click", (e: Event) => {
        e.preventDefault();
        toggleFullscreen();
    });
}

// Define our virtual console
export async function process_awsm_config(awsm_console: AwsmConsole, config_addr: number) {

    let memory = awsm_console.memory;

    // Load in the settings from the .wasm console, as set in configure().
    awsm_console.buffers.config = new Uint16Array(memory!.buffer, config_addr, 9);
    const cd = awsm_console.buffers.config;
    awsm_console.config = {
        framebuffer_addr: ((cd[1] << 16) & 0xffff0000) | (cd[0] & 0xffff),
        info_addr: ((cd[3] << 16) & 0xffff0000) | (cd[2] & 0xffff),
        spritesheet_addr: ((cd[5] << 16) & 0xffff0000) | (cd[4] & 0xffff),
        logical_width_px: cd[6],
        logical_height_px: cd[7],
        max_n_players: cd[8],
    };

    // if the game author specified a spritesheet address, load the spritesheet into the console's memory
    if (awsm_console.config.spritesheet_addr != 0) {

        // load in the spritesheet
        const cartdata_el = document.getElementById("cartdata")!;
        const spritesheet_src = cartdata_el.getAttribute("data-spritesheet")!;

        // create an image using the base64 url of the spritesheet, and wait for it to load
        const ss_img = new Image();
        ss_img.src = spritesheet_src;
        await ss_img.decode();

        // create a temporary canvas to render the image into bytes

        const ss_canvas = <HTMLCanvasElement>document.createElement("canvas")!;
        const ss_ctx = ss_canvas.getContext("2d")!;

        // Draw the image out, to rasterize it into RGBA bytes
        ss_canvas.width = ss_img.width;
        ss_canvas.height = ss_img.height;
        ss_ctx.drawImage(ss_img, 0, 0);
        const ss_bytes = ss_ctx.getImageData(0, 0, ss_img.width, ss_img.height).data;

        // Copy the spritesheet into the console's memory at the spritesheet address
        awsm_console.buffers.spritesheet_buffer = new Uint8Array(memory!.buffer, awsm_console.config.spritesheet_addr, ss_img.width * ss_img.height * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)
        awsm_console.buffers.spritesheet_buffer.set(ss_bytes);

        awsm_console._runtime_state.spritesheet_info = { width: ss_img.width, height: ss_img.height };
    }


    awsm_console.buffers.framebuffer = new Uint8Array(memory!.buffer, awsm_console.config.framebuffer_addr, awsm_console.config.logical_width_px * awsm_console.config.logical_height_px * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, awsm_console.config.logical_width_px, awsm_console.config.logical_height_px, 0, gl.RGBA, gl.UNSIGNED_BYTE, awsm_console.buffers.framebuffer);
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

    update_this_client_info(awsm_console);

    // calculate fps timing
    thisLoop = new Date();
    let thisFrameTime = thisLoop.getTime() - lastLoop.getTime();
    frameTime += (thisFrameTime - frameTime) / filterStrength;
    lastLoop = thisLoop;

    // Update the texture with the screen buffer data
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, awsm_console.config.logical_width_px, awsm_console.config.logical_height_px, gl.RGBA, gl.UNSIGNED_BYTE, awsm_console.buffers.framebuffer!);

    // Clear the screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the screen
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
}

export async function init(): Promise<AwsmConsole> {


    function check_is_little_endian() {
        var arrayBuffer = new ArrayBuffer(2);
        var uint8Array = new Uint8Array(arrayBuffer);
        var uint16array = new Uint16Array(arrayBuffer);
        uint8Array[0] = 0xAA; // set first byte
        uint8Array[1] = 0xBB; // set second byte
        if (uint16array[0] === 0xBBAA) return true;
        if (uint16array[0] === 0xAABB) return false;
        else throw new Error("Something crazy just happened");
    }

    let awsm_console: AwsmConsole = {
        memory: undefined,
        buffers: {
            config: undefined,
            framebuffer: undefined,
            info: undefined,
            spritesheet_buffer: undefined
        },
        config: {
            framebuffer_addr: 0,
            info_addr: 0,
            spritesheet_addr: 0,
            logical_width_px: 64,
            logical_height_px: 64,
            max_n_players: 0,
        },
        info: {
            device_width: 64,
            device_height: 64,
            netplay_client_number: 0,
            inputs: [
                {
                    touches: [],
                    keys_input: 0,
                },
            ],
            touch_generation: 0,
            is_mobile: mobileAndTabletCheck() ? 0x1 : 0x2,
        },
        exported_functions: {
            _configure: undefined,
            _update: undefined,
        },
        provided_builtins: {},
        _runtime_state: {
            active_touches: new Map(),
            spritesheet_info: undefined,
            is_little_endian: check_is_little_endian()
        }
    };

    // some quick helpers for implementing the game API.

    function blit(
        src_addr: number,
        sx: number,
        sy: number,
        s_stride: number,
        dest_addr: number,
        dx: number,
        dy: number,
        d_stride: number,
        w: number,
        h: number,
        flags: number,
    ) {
        // grab framebuffer. 
        // We try to reuse our buffer object 
        // if it's just the usual framebuffer.
        let dest_buffer;
        if (dest_addr === awsm_console.config.framebuffer_addr) {
            dest_buffer = awsm_console.buffers.framebuffer!;
        } else {
            dest_buffer = new Uint8Array(awsm_console.memory!.buffer, dest_addr);
        }

        // grab spritesheet. We try to reuse our spritesheet object
        // if it's just the usual spritesheet.
        let src_buffer;
        if (src_addr === awsm_console.config.spritesheet_addr) {
            src_buffer = awsm_console.buffers.spritesheet_buffer!;
        } else {
            src_buffer = new Uint8Array(awsm_console.memory!.buffer, src_addr);
        }


        const [startx, endx, stepx] = ((flags & 0x1) !== 0) ? [w, -1, -1] : [0, w, 1];
        const [starty, endy, stepy] = ((flags & 0x10) !== 0) ? [h, -1, -1] : [0, h, 1];


        for (let i = 0; i < h; i++) {
            const di = ((flags & 0x10) === 0) ? i : h - 1 - i;
            for (let j = 0; j < w; j++) {
                const dj = ((flags & 0x1) === 0) ? j : w - 1 - j;
                let alpha: number = src_buffer[((sy + i) * s_stride + (sx + j)) * FRAMEBUFFER_BYPP + 3];
                if (alpha !== 0) {
                    const fb_loc = ((dy + di) * d_stride + (dx + dj)) * FRAMEBUFFER_BYPP;
                    const ss_loc = ((sy + i) * s_stride + (sx + j)) * FRAMEBUFFER_BYPP;
                    dest_buffer[fb_loc] = src_buffer[ss_loc];
                    dest_buffer[fb_loc + 1] = src_buffer[ss_loc + 1];
                    dest_buffer[fb_loc + 2] = src_buffer[ss_loc + 2];
                    dest_buffer[fb_loc + 3] = alpha;
                }
            }
        }
    }

    function draw_ss(sx: number, sy: number, dx: number, dy: number, w: number, h: number, flags: number) {
        if (awsm_console._runtime_state.spritesheet_info !== undefined) {
            blit(
                awsm_console.buffers.spritesheet_buffer!.byteOffset,
                sx, sy, awsm_console._runtime_state.spritesheet_info.width,
                awsm_console.buffers.framebuffer!.byteOffset,
                dx, dy, awsm_console.config.logical_width_px,
                w, h, flags
            )
        }
    }

    function _REV(num: number): number {
        // Ensure the number is treated as a 32-bit unsigned integer
        let result = ((num >>> 24) & 0xFF) |
            ((num >>> 8) & 0xFF00) |
            ((num << 8) & 0xFF0000) |
            ((num << 24) & 0xFF000000);
        return result >>> 0; // Convert to unsigned 32-bit integer
    }

    function _get_corrected_color(color: number) {
        if (awsm_console._runtime_state.is_little_endian) {
            return _REV(color)
        }
        return color
    }


    function fill_screen(color: number) {
        const corrected_color = _get_corrected_color(color)
        new Uint32Array(awsm_console.buffers.framebuffer!.buffer, awsm_console.buffers.framebuffer!.byteOffset, awsm_console.buffers.framebuffer!.length / 4).fill(corrected_color);
    }

    /** Fast line filling function that uses the backed array helper. */
    function _fast_hline_unchecked(sx: number, ex: number, y: number, corrected_color: number) {
        new Uint32Array(
            awsm_console.buffers.framebuffer!.buffer,
            (
                awsm_console.buffers.framebuffer!.byteOffset
                + (y * awsm_console.config.logical_width_px) * 4
                + sx * 4
            ),
            (ex - sx),
        ).fill(corrected_color);
    }



    function fill(x: number, y: number, w: number, h: number, color: number) {
        const clamp = (v: number, minv: number, maxv: number) => Math.min(maxv, Math.max(minv, v))
        const [sx, ex] = [x, x + w].map((v) => clamp(v, 0, awsm_console.config.logical_width_px));
        const [sy, ey] = [y, y + h].map((v) => clamp(v, 0, awsm_console.config.logical_height_px));
        const corrected_color = _get_corrected_color(color)
        for (let i = sy; i < ey; i++) {
            _fast_hline_unchecked(sx, ex, i, corrected_color);
        }
    }

    function getCString (ptr: number) {
        let str = "";
        for (;;) {
            const c = new DataView(awsm_console.memory!.buffer).getUint8(ptr++);
            if (c == 0) {
                break;
            }
            str += String.fromCharCode(c);
        }
        return str;
    }

    function trace(ptr: number) {
        const msg = getCString(ptr);
        console.log(msg);
    }

    // No need to set maximum memory; allow growth.
    // const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024});
    const imports = {
        env: {
            // memory,
            blit,
            draw_ss,
            fill_screen,
            fill,
            trace,
        },
    };



    const cartdata_el = document.getElementById("cartdata")!;
    const encoded = cartdata_el.getAttribute("data-cart")!;
    const encoded_len = Number(cartdata_el.getAttribute("data-cartlen")!)!;

    const decoded_cart = decode(encoded, undefined);

    const { instance } = await WebAssembly.instantiate(decoded_cart, imports);

    // Expose the configure and update functions

    awsm_console.memory = instance.exports.memory as WebAssembly.Memory;
    awsm_console.exported_functions._configure = instance.exports.configure as Function;
    awsm_console.exported_functions._update = instance.exports.update as Function;

    return awsm_console;
}



export default async function run() {


    const awsm_console = await init();

    const config_addr = awsm_console.exported_functions._configure!();
    await process_awsm_config(awsm_console, config_addr);

    setInterval(() => {
        process_awsm_update(awsm_console);
        awsm_console.exported_functions._update!();
    }, 1000 / 60);
    const canvas = document.getElementById('screen') as HTMLCanvasElement;

    // Set the canvas internal width and height
    const canvasWidth = awsm_console.config.logical_width_px;
    const canvasHeight = awsm_console.config.logical_height_px;
    // canvas.width = canvasWidth;
    // canvas.height = canvasHeight; -->

    function resizeCanvas() {
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
    setInterval(function () {
        fpsOut.innerHTML = (1000 / frameTime).toFixed(1) + " fps";
    }, 1000);
}

const canvas = document.getElementById("screen");
const recordBtn = document.getElementById("record-btn")!;

let recording = false;
let mediaRecorder;
let recordedChunks;

recordBtn.addEventListener("click", () => {
    recording = !recording;
    if (recording) {
        recordBtn.textContent = "Stop";
        const stream = (canvas as HTMLCanvasElement).captureStream(60);

        const kbps = 1024;
        const Mbps = kbps * kbps;

        const options = {
        mimeType: "video/webm",
        };

        mediaRecorder = new MediaRecorder(stream, options);
        recordedChunks = [];
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        mediaRecorder.start();
    } else {
        recordBtn.textContent = "Record"
        mediaRecorder.stop();
        setTimeout(() => {
            const blob = new Blob(recordedChunks, {
                type: "video/webm"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "recording.webm";
            a.click();
            URL.revokeObjectURL(url);
        }, 0);
    }
});