#ifndef __AWSMC_H__
#define __AWSMC_H__

// Please read "awsmc_console_types.ts". That explains how the console works, and will help
// make `configure()` and `update()` make more sense.

// The framebuffer is 4 bytes per pixel - r, g, b, A.
#define FRAMEBUFFER_BYPP 4


/** The number of simultaneous touches on the screen each client can have. */
#define TOUCH_BUFFER_SIZE 10

/** The number of clients that can connect at once. */
#define N_CLIENTS 10

/** A single touch on the screen. */
typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t generation;
} Touch;

/** The input from one particular client (e.g. this local client.) */
typedef struct {
    Touch touches[TOUCH_BUFFER_SIZE];
    uint32_t keys;
} ClientInput;

/** Information flowing from the runtime to this .wasm code.*/
typedef struct {
    uint32_t device_width;
    uint32_t device_height;
    uint16_t netplay_client_number;
    uint16_t touch_generation;
    ClientInput inputs[N_CLIENTS];
} AwsmInfo;

/** This is the configuration that will be sent to the runtime from here. */
typedef struct {
    uint32_t* framebuffer_addr;
    uint32_t* info_addr;
    uint32_t* spritesheet_addr;
    uint16_t logical_width_px;
    uint16_t logical_height_px;
    uint16_t max_n_players;
} AwsmConfig;

__attribute__((import_name("blit")))
extern void blit(
    uint8_t* src_addr,
    uint16_t sx,
    uint16_t sy,
    uint16_t s_stride,
    uint8_t* dest_addr,
    int16_t dx,
    int16_t dy,
    uint16_t d_stride,
    uint16_t w,
    uint16_t h,
    char flags
);

__attribute__((import_name("draw_ss")))
extern void draw_ss(
    uint16_t sx,
    uint16_t sy,
    int16_t dx,
    int16_t dy,
    uint16_t w,
    uint16_t h,
    char flags
);

__attribute__((import_name("fill_screen")))
extern void fill_screen(uint32_t color);

#endif