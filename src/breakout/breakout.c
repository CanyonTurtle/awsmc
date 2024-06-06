#include <stdint.h>
#include <stdlib.h>
#include <math.h>

#include "awsmc.h"

// You can decide the aspect ratio of your screen!
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 192

// (optional) you can make any .png into a spritesheet that gets bundled into the game, see the bundle command.
#define SPRITESHEET_WIDTH 128
#define SPRITESHEET_HEIGHT 128

// ----------- awsmc REQUIRED memory items --------------------
// ----- You can decide where these awsmc-required sections of memory should live in your program. ----------
// ----- After that, you can make your game through the API, or directly modify memory for your console. ----

// (required by awsmc) the memory for the RGBA framebuffer.
uint8_t framebuffer[SCREEN_WIDTH*SCREEN_HEIGHT*FRAMEBUFFER_BYPP];

/** (required by awsmc) the memory where console runtime information will be placed. */
volatile AwsmInfo awsm_info;

/** (required by awsmc) the memeoy where your settings for the console will live. */
AwsmConfig awsm_config;

/** (Optional, supported by awsmc) the RGBA spritesheet framebuffer. */
uint8_t spritesheet[SPRITESHEET_WIDTH*SPRITESHEET_HEIGHT*FRAMEBUFFER_BYPP];

typedef struct {
    float x;
    float y;
    float vx;
    float vy;
} Player;

typedef struct {
    Player player;
} GameState;

GameState game_state = {
    .player = {
        .x = (float) (SCREEN_WIDTH / 2),
        .y = (float) (SCREEN_HEIGHT * 3 / 4),
        .vx = 0.0,
        .vy = 0.0,
    },
};

// Helper for drawing rectangles.
void rect_unchecked(uint8_t* framebuffer, uint16_t sx, const uint16_t sy, const uint16_t ex, const uint16_t ey, const uint8_t color[4]) {
    for (int i = sy; i < ey; i++) {
        for(int j = sx; j < ex; j++) {
            framebuffer[(i*SCREEN_WIDTH+j) * 4] = color[0]; 
            framebuffer[(i*SCREEN_WIDTH+j) * 4 + 1] = color[1]; 
            framebuffer[(i*SCREEN_WIDTH+j) * 4 + 2] = color[2]; 
            framebuffer[(i*SCREEN_WIDTH+j) * 4 + 3] = color[3]; 
        }
    }
}

// Helpers.
#define MIN(a,b) (uint16_t)((((int16_t)a)<((int16_t)b))?((int16_t)a):((int16_t)b))
#define MAX(a,b) (uint16_t)((((int16_t)a)>((int16_t)b))?((int16_t)a):((int16_t)b))

// Helper for drawing rectangles, making sure they don't go out of bounds of the framebuffer.
void rect(uint8_t* framebuffer, const int16_t sx, const int16_t sy, const uint16_t w, const uint16_t h, const uint8_t color[4]) {
    rect_unchecked(framebuffer, MAX(sx, 0), MAX(sy, 0), MIN(sx+w, SCREEN_WIDTH-1), MIN(sy+h, SCREEN_HEIGHT-1), color);
}


// This function is expected to be here in the .wasm.
// It must write the configuration settings.
AwsmConfig* configure(void) {

    AwsmConfig config = {
        .framebuffer_addr= (uint32_t*)&framebuffer,
        .info_addr = (uint32_t*)&awsm_info,
        .spritesheet_addr = (uint32_t*)&spritesheet,
        .logical_width_px = SCREEN_WIDTH,
        .logical_height_px = SCREEN_HEIGHT,
        .max_n_players = 1,
    };
    awsm_config = config;
    // Here we fill in the settings.
    return &awsm_config;
}

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

float clamp_float(float value, float min, float max) {
    if (value <= min) {
        return min;
    }
    if (value >= max) {
        return max;
    }
    return value;
}

// This function is expected to be in the .wasm to update the screen, etc...
void update(void) {

    for(int i = 0; i < sizeof framebuffer; i++) {
        framebuffer[i] = 0;
    }

    // Access touch data from the buffer
    char any = 0;
    for (int i = 0; i < TOUCH_BUFFER_SIZE; i++) {
        Touch touch = awsm_info.inputs[awsm_info.netplay_client_number].touches[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        if (x != 0 && y != 0 && generation) {
            
        }

    }

    // handle paddle input
    const uint16_t PADDLE_WIDTH = 22;
    const uint32_t KEY_LEFT = 0x80000000;
    const uint32_t KEY_RIGHT = 0x40000000;
    const float ax = 1.0;
    const float dragx = 0.8;
    const float vmaxx = 3.0;
    if (awsm_info.inputs[awsm_info.netplay_client_number].keys & KEY_LEFT) {
        game_state.player.vx -= ax;
    } else if (awsm_info.inputs[awsm_info.netplay_client_number].keys & KEY_RIGHT) {
        game_state.player.vx += ax;
    }
    game_state.player.vx *= dragx;
    game_state.player.vx = clamp_float(game_state.player.vx, -vmaxx, vmaxx);
    game_state.player.x += game_state.player.vx;
    game_state.player.x = clamp_float(game_state.player.x, 0.0, (float)(SCREEN_WIDTH - PADDLE_WIDTH));

    // draw paddle
    blit((uint8_t*)&spritesheet, 0, 8, SPRITESHEET_WIDTH, (uint8_t*)&framebuffer, (uint16_t) game_state.player.x, game_state.player.y, SCREEN_WIDTH, PADDLE_WIDTH, 7, 0);
}
