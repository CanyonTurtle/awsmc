/**
 * The main design is this: the AwsmConsole type bundles everything, the whole state
 * of the console, together.
 * Data flows from the virtual console via AwsmConfig,
 * and to the console via AwsmInfo. Read the types 
 * to see specific detail.
 */

export const FRAMEBUFFER_BYPP = 4;

/** Maximum number of supported clients connected at once. */
export const N_CLIENTS = 4;

/**
 * These configurations are set FROM the .wasm game and go TO the runtime, as 
 * set by the .wasm game's `configure()` function.
 * 
 * These configuration values CAN CHANGE during the runtime of the program, and the
 * console is designed to adapt to them.
 * 
 * The properties in this config must be written as tightly-packed as possible, at the memory address
 * returned by the configure() function.
 */
export type AwsmConfig = {

    /** The framebuffer will be looked for at this address. u32. */
    framebuffer_addr: number,

    /** Where information flowing FROM the runtime TO the .wasm game will be sent. This includes inputs, the physical device width/height, etc... u32. */
    info_addr: number,

    /** If nonzero, where the optionally-provided RGBA spritesheet will be loaded into console memory after `configure()` and before `update()`. u32. */
    spritesheet_addr: number,

    /** Num. pixels in the virtual console's width. u16. */
    logical_width_px: number,

    /** Num. pixels in the virtual console's width. u16. */
    logical_height_px: number,

    /** The number of players that can play in the game. u16. */
    max_n_players: number,
};

/** Game stores up to 10 touches at a time. */
export const TOUCHES_COUNT = 10; 

/** 2 bytes for X, 2 bytes for Y, 2 bytes for generation */
export const TOUCH_STRUCT_SIZE = 6; 

/** The keys that are passed through. LRUD is the arrow keys. " " is the space, and 1 is digit 1.*/
export const KEYS_VALUES = "LRUDabcdefghijklmnopqrstuvwxyz 1"

/** Each digit shows 1 for pressed, 0 for not. "LRUDabcdefghijklmnopqrstuvwxyz 1" */
export const KEYS_INPUT_SIZE = 4; 

/** size of one client's input. */
export const CLIENT_INPUT_SIZE = TOUCHES_COUNT * TOUCH_STRUCT_SIZE + KEYS_INPUT_SIZE; 


/** size of all the inputs. */
export const ALL_INPUTS_SIZE = CLIENT_INPUT_SIZE * N_CLIENTS; 

/**
 * The input of one client (e.g. your browser, or someone else's phone). Includes their touchscreen touches and keyboard presses.
 */
export type ClientInput = {

    /** 
     * Touches. The index of the touch runs from 0 to TOUCHES_COUNT 
     * and each index stores (touch x u16, touch y u16, generation u16.) 
     */
    touches: [number, number, number][]

    /** Packed u32 of each keyboard key as a 1 or a 0. left,right,up,down at positions 0123. */
    keys_input: number,
};

/**
 * System information flowing FROM the runtime TO the
 * .wasm game This includes the physical device width/height, which netplay index this player is, and input.
 */
export type AwsmInfo = {

    /** u32 Width in pixels of the physical computer/phone/console. */
    device_width: number,

    /** u32 Height in pixels of the physical computer/phone/console. */
    device_height: number,

    /** u16 The index of this client's, 0 being player 1, 1 being player 2,  etc... */
    netplay_client_number: number,

    /**
     * u16 This generation is incremented each frame, so that touches can stale without overwriting zeros.
     */
    touch_generation: number,

    /**
     * The touches being pressed by the user. This will be loaded into the designated inputs buffer, TAKING INTO CONSIDERATION
     * which player # this client is (e.g. if player 2, these touches will be synced with the 2nd position in the input buffer).
     */
    inputs: Array<ClientInput>,
};

/** The functions the .wasm module is expected to define, that this runtime will call. */
export type AwsmExportedFunctions = {
    _configure: CallableFunction | undefined,
    _update: CallableFunction | undefined,
};

/** Built-in functions that are provided to the .wasm module from this runtime. */
export type AwsmBuiltinFunctions = {

};

/**
 * The entirety of the virtual console's state lives in here.
 * The Memory is the whole program memory, the config and info are the output from / input to the .wasm module,
 * and 
 */
export type AwsmConsole = {
    
    /**
     * The entire console memory at runtime - the framebuffer, game state, configuration, program stack & memory, etc... 
     * Used in tandem with the `config` property which describes the current layout info of this memory.
     */
    memory: WebAssembly.Memory | undefined,

    /** Views into the console's memory. */
    buffers: {
        /** Section of console memory where configuration lives. */
        config: Uint16Array | undefined,

        /** Section of console memory where screen pixel data lives. */
        framebuffer: Uint8Array | undefined,

        /** Section of console memory where inputs live.  */
        inputs: Uint8Array | undefined,

        /** Section of memory where spritesheet lives. */
        spritesheet_buffer: Uint8Array | undefined,
    },
    

    /** The Configuration sent FROM the .wasm cart TO this runtime. */
    config: AwsmConfig,

    /** The information relayed TO the .wasm cart FROM this runtime. */
    info: AwsmInfo,

    /** Functions defined in WASM console that this runtime uses. */
    exported_functions: AwsmExportedFunctions,

    /** Functions provided to the .wasm module from this runtime. */
    provided_builtins: AwsmBuiltinFunctions,

    _runtime_state: {
        active_touches: Map<number, [number, number, number]>
    }
};