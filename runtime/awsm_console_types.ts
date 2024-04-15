/**
 * The main design is this: the AwsmConsole type bundles everything, the whole state
 * of the console, together.
 * Data flows from the virtual console via AwsmConfig,
 * and to the console via AwsmInfo. Read the types 
 * to see specific detail.
 */

/**
 * These configurations are set FROM the .wasm game and go TO the runtime, as 
 * set by the .wasm game's `configure()` function.
 * 
 * These configuration values CAN CHANGE during the runtime of the program, and the
 * console is designed to adapt to them.
 * 
 * The properties in this config must be written as tightly-packed as possible, at address
 * 0x10.
 */
export type AwsmConfig = {

    /** The framebuffer will be looked for at this address. u32. */
    framebuffer_addr: number,

    /** Where information flowing FROM the runtime TO the .wasm game will be sent. This includes inputs, the physical device width/height, etc... u32. */
    info_addr: number,

    /** Num. pixels in the virtual console's width. u16. */
    logical_width_px: number,

    /** Num. pixels in the virtual console's width. u16. */
    logical_height_px: number,


    /** The number of players that can play in the game. u16. */
    max_n_players: number,

};

/**
 * The input of one player. Includes their touchscreen touches and keyboard presses.
 */
export type PlayerInput = {

    /** The keyboard touches of this player. Maps a touch ID to (touch x u16, touch y u16, generation u16.) */
    active_touches: Map<number, [number, number, number]>

    /** Packed uint of each keyboard key as a 1 or a 0. left,right,up,down at positions 0123. */
    keys_input: number,
};

/**
 * System information flowing FROM the runtime TO the
 * .wasm game This includes the physical device width/height, which netplay index this player is, and input.
 */
export type AwsmInfo = {

    /** Width in pixels of the physical computer/phone/console. */
    device_width: number,

    /** Height in pixels of the physical computer/phone/console. */
    device_height: number,

    /** The index of this client's player, zero being player 1, etc... */
    netplay_player_number: number,

    /**
     * This generation is incremented each frame, so that touches can stale without overwriting zeros.
     */
    touch_generation: number,

    /**
     * The touches being pressed by the user. This will be loaded into the designated inputs buffer, TAKING INTO CONSIDERATION
     * which player # this client is (e.g. if player 2, these touches will be synced with the 2nd position in the input buffer).
     */
    player_inputs: Array<PlayerInput>,
};

/** The functions the .wasm module is expected to define, that this runtime will call. */
export type AwsmExportedFunctions = {
    _configure: CallableFunction,
    _update: CallableFunction,
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
    memory: WebAssembly.Memory,

    /** The Configuration sent FROM the .wasm cart TO this runtime. */
    config: AwsmConfig,

    /** The information relayed TO the .wasm cart FROM this runtime. */
    info: AwsmInfo,

    /** Functions defined in WASM console that this runtime uses. */
    exported_functions: AwsmExportedFunctions,

    /** Functions provided to the .wasm module from this runtime. */
    provided_builtins: AwsmBuiltinFunctions

};