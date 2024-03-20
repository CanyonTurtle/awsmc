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


const WIDTH = 128;
const HEIGHT = 128;
const FRAMEBUFFER_BYPP = 4;

// Define our virtual console
let Console = {
    configure: function(memory) {

        const bufferPtr = 0;
        const bufferData = new Uint8Array(memory.buffer, bufferPtr, WIDTH * HEIGHT * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)

        // Initialize memory addresses
        // consoleMemory = new WebAssembly.Memory({ initial: 256 });
        // screenBuffer = new Uint8Array(consoleMemory.buffer, 0, FRAMEBUFFER_BYPP * WIDTH * HEIGHT);

        // Create WebGL context
        const canvas = document.getElementById('screen');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
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
            console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
            return;
        }

        // Create fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

        // Set resolution uniform
        const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
        gl.uniform2f(resolutionUniformLocation, WIDTH, HEIGHT);
    },

    update: function(memory) {
        // console.log(memory) 
        // Your game logic here
        // For now, let's just fill the screen buffer with random colors
        const bufferPtr = 0;
        const bufferData = new Uint8Array(memory.buffer, bufferPtr, WIDTH * HEIGHT * FRAMEBUFFER_BYPP); // 4 bytes per pixel (RGBA)
        // console.log(bufferData)
        // Update the texture with the screen buffer data
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, bufferData);

        // Clear the screen
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw the screen
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
    },
};

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
    Console._configure = instance.exports.configure;
    Console._update = instance.exports.update;
    Console.memory = instance.exports.memory;
    return Console;
}