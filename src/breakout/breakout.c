#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <stdio.h>

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



// --------- GAME CODE -----------
typedef enum PaddleMovement {
    PADDLE_LEFT,
    PADDLE_RIGHT,
    PADDLE_NO_MOVE,
} PaddleMovement;

typedef struct SpriteFrame {
    uint16_t x;
    uint16_t y; 
    uint16_t w;
    uint16_t h;
    char flags;
} SpriteFrame;

typedef struct Sprite {
    size_t n_frames;
    SpriteFrame* sprite_frames;
} Sprite;

SpriteFrame paddle_frames[1] = {
    {
        .x = 0,
        .y = 8,
        .w = 22,
        .h = 7,
        .flags = 0,
    },
};

Sprite paddle_sprite = {
    .n_frames = 1,
    .sprite_frames = paddle_frames,
};

SpriteFrame block_frames[1] = {
    {
        .x = 16,
        .y = 0,
        .w = 8,
        .h = 8,
        .flags = 0,
    }
};

Sprite block_sprite = {
   .n_frames = 1,
   .sprite_frames = block_frames, 
};

SpriteFrame ball_frames[1] = {
    {
        .x = 24,
        .y = 0,
        .w = 8,
        .h = 8,
        .flags = 0,
    },
};

Sprite ball_sprite = {
    .n_frames = 1,
    .sprite_frames = ball_frames,
};

SpriteFrame awsmc_frames[1] = {
    {
        .x = 0,
        .y = 32,
        .w = 89,
        .h = 16,
        .flags = 0,
    },
};

Sprite awsmc_sprite = {
    .n_frames = 1,
    .sprite_frames = awsmc_frames,
};

void drawsprite(const Sprite* sprite, int16_t x, int16_t y, size_t frame_idx, char extra_flags) {
    SpriteFrame* frame = &sprite->sprite_frames[frame_idx % sprite->n_frames];
    draw_ss(frame->x, frame->y, x, y, frame->w, frame->h, frame->flags ^ extra_flags);
}

typedef struct {
    float x;
    float y;
    float vx;
    float vy;
    PaddleMovement paddle_movement;
} Player;

typedef enum InputMode {
    KEYBOARD,
    TOUCH,
} InputMode;

typedef struct Ball {
    float x;
    float y;
    float vx;
    float vy;
} Ball;

typedef struct {
    Player player;
    InputMode input_mode;
    Ball ball;
    uint32_t timer;
    char blur_mode;
} GameState;

GameState game_state = {
    .player = {
        .x = (float) (SCREEN_WIDTH / 2),
        .y = (float) (SCREEN_HEIGHT * 3 / 4),
        .vx = 0.0,
        .vy = 0.0,
    },
    KEYBOARD,
    .ball = {
        .x = (float) (SCREEN_WIDTH / 2),
        .y = (float) (SCREEN_HEIGHT / 2),
        .vx = 3.0,
        .vy = 1.3,
    },
    .timer = 0,
    .blur_mode = 1,
};

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

    // Access touch data from the buffer
    char any = 0;
    for (int i = 0; i < TOUCH_BUFFER_SIZE; i++) {
        Touch touch = awsm_info.inputs[awsm_info.netplay_client_number].touches[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        if (x != 0 && y != 0 && generation) {
            game_state.player.paddle_movement = (x < SCREEN_WIDTH / 2) ? PADDLE_LEFT : PADDLE_RIGHT;
            game_state.input_mode = TOUCH;
            any = 1;
        }

    }
    if (!any && game_state.input_mode == TOUCH) {
        game_state.player.paddle_movement = PADDLE_NO_MOVE;
    }

    // handle paddle input
    const uint16_t PADDLE_WIDTH = 22;
    const uint16_t PADDLE_HEIGHT = 7;
    const uint32_t KEY_LEFT = 0x80000000;
    const uint32_t KEY_RIGHT = 0x40000000;
    const float ax = 2.0;
    const float dragx = 0.8;
    const float vmaxx = 3.0;
    if (awsm_info.inputs[awsm_info.netplay_client_number].keys & KEY_LEFT) {
        game_state.player.paddle_movement = PADDLE_LEFT;
        game_state.input_mode = KEYBOARD;
    } else if (awsm_info.inputs[awsm_info.netplay_client_number].keys & KEY_RIGHT) {
        game_state.player.paddle_movement = PADDLE_RIGHT;
        game_state.input_mode = KEYBOARD;
    } else if (game_state.input_mode == KEYBOARD) {
        game_state.player.paddle_movement = PADDLE_NO_MOVE;
    }

    if (game_state.player.paddle_movement == PADDLE_LEFT) {
        game_state.player.vx -= ax;
    } else if (game_state.player.paddle_movement == PADDLE_RIGHT) {
        game_state.player.vx += ax;
    }

    game_state.player.vx *= dragx;
    game_state.player.vx = clamp_float(game_state.player.vx, -vmaxx, vmaxx);
    game_state.player.x += game_state.player.vx;
    game_state.player.x = clamp_float(game_state.player.x, 8.0, (float)(SCREEN_WIDTH - PADDLE_WIDTH - 8.0));

    // move ball
    if (game_state.ball.x < 8.0) {
        game_state.ball.x = 8.0;
        game_state.ball.vx *= (game_state.ball.vx < 0) ? -1.0 : 1.0;
    }
    const float BALL_RIGHT_SIDE = ((float)SCREEN_WIDTH) - 8.0 - 8.0 - 1.0;
    if (game_state.ball.x > BALL_RIGHT_SIDE) {
        game_state.ball.x = BALL_RIGHT_SIDE;
        game_state.ball.vx *= (game_state.ball.vx < 0) ? 1.0 : -1.0;
    }
    if (game_state.ball.y < 8.0) {
        game_state.ball.y = 8.0;
        game_state.ball.vy *= (game_state.ball.vy < 0) ? -1.0 : 1.0;
    }
    const float BALL_BOTTOM_SIDE = ((float)SCREEN_HEIGHT) - 8.0 - 1.0;
    if (game_state.ball.y > BALL_BOTTOM_SIDE) {
        game_state.ball.y = BALL_BOTTOM_SIDE;
        game_state.ball.vy *= (game_state.ball.vy < 0) ? 1.0 : -1.0;
    }
    game_state.ball.x += game_state.ball.vx;
    game_state.ball.y += game_state.ball.vy;

    // ball bouncing off paddle
    if (
        game_state.ball.x + (int16_t)ball_sprite.sprite_frames[0].w >= game_state.player.x 
        && game_state.ball.x <= game_state.player.x + (int16_t)paddle_frames[0].w
        && game_state.ball.y + (int16_t)ball_sprite.sprite_frames[0].h >= game_state.player.y
        && game_state.ball.y <= game_state.player.y + (int16_t)paddle_frames[0].h
    ) {
        game_state.ball.vy *= (game_state.ball.vy < 0) ? 1.0 : -1.0;
    }

    // clear screen
    const uint32_t BG_COLOR = 0xf6ffd4ff;

    // draw rectangles
    #define BUTTON_INLAY 10
    #define BUTTON_PRESSED_COLOR 0x2ff6a7ff
    #define BUTTON_UNPRESSED_COLOR 0x5d6d88ff
    #define BUTTON_WIDTH 16
    #define BUTTON_HEIGHT 16


    game_state.timer += 1;
    float blur_rate = 0.25;
    float channel_rates[4] = {-0.1f, -.1f, -0.1f, 0.95f};
    if (game_state.blur_mode && game_state.timer % 1 == 0) {
        for (int kk = 0; kk < 2; kk++) {
            for (uint32_t i = 0; i < SCREEN_HEIGHT; i++) {
                for (uint32_t j = 0; j < SCREEN_WIDTH; j++) {
                    for (uint32_t offs = 0; offs < 4; offs++) {
                        framebuffer[(i*SCREEN_WIDTH+j)*4+offs] = (
                            (uint8_t)((1.0f - 4.0f*blur_rate*channel_rates[offs])*(float)framebuffer[(i*SCREEN_WIDTH+j)*4+offs])
                            + (uint8_t)(blur_rate*channel_rates[offs]*(float)framebuffer[(((i-1)%SCREEN_HEIGHT)*SCREEN_WIDTH+j)*4+offs])
                            + (uint8_t)(blur_rate*channel_rates[offs]*(float)framebuffer[(((i+1)%SCREEN_HEIGHT)*SCREEN_WIDTH+j)*4+offs])
                            + (uint8_t)(blur_rate*channel_rates[offs]*(float)framebuffer[((i)*SCREEN_WIDTH+(j+1)%SCREEN_WIDTH)*4+offs])
                            + (uint8_t)(blur_rate*channel_rates[offs]*(float)framebuffer[((i)*SCREEN_WIDTH+(j-1)%SCREEN_WIDTH)*4+offs])
                        );
                    }
                }
            }
        }
    } else {
        // fill_screen(BG_COLOR);
    }

    if (game_state.input_mode == TOUCH) {
        if (game_state.player.paddle_movement == PADDLE_LEFT) {
            draw_ss(16, 16, BUTTON_INLAY, SCREEN_HEIGHT - BUTTON_HEIGHT - BUTTON_INLAY, BUTTON_WIDTH, BUTTON_HEIGHT, 0);
        } else {
            draw_ss(0, 16, BUTTON_INLAY, SCREEN_HEIGHT - BUTTON_HEIGHT - BUTTON_INLAY, BUTTON_WIDTH, BUTTON_HEIGHT, 0);
        }

        if (game_state.player.paddle_movement == PADDLE_RIGHT) {
            draw_ss(16, 16, SCREEN_WIDTH - BUTTON_WIDTH - BUTTON_INLAY, SCREEN_HEIGHT - BUTTON_HEIGHT - BUTTON_INLAY, BUTTON_WIDTH, BUTTON_HEIGHT, DRAW_FLAGS_FLIP_X);
        } else {
            draw_ss(0, 16, SCREEN_WIDTH - BUTTON_WIDTH - BUTTON_INLAY, SCREEN_HEIGHT - BUTTON_HEIGHT - BUTTON_INLAY, BUTTON_WIDTH, BUTTON_HEIGHT, DRAW_FLAGS_FLIP_X);
        }
    }

    // draw paddle
    // draw_ss(0, 8, game_state.player.x, game_state.player.y, PADDLE_WIDTH, PADDLE_HEIGHT, 0);
    drawsprite(&paddle_sprite, game_state.player.x, game_state.player.y, 0, 0);

    // draw blocks around the border
    for(int16_t i = 0; i < SCREEN_WIDTH / 8; i++) {
        drawsprite(&block_sprite, i * 8, 0, 0, 0);
    }
    for(int16_t j = 0; j < SCREEN_HEIGHT / 8; j++) {
        drawsprite(&block_sprite, 0, j * 8, 0, 0);
        drawsprite(&block_sprite, SCREEN_WIDTH - 8, j * 8, 0, 0);
    }

    // draw a ball
    drawsprite(&ball_sprite, (int16_t)game_state.ball.x, (int16_t)game_state.ball.y, 0, 0);

    drawsprite(&awsmc_sprite, SCREEN_WIDTH / 2 - awsmc_frames[0].w / 2, 80, 0, 0);

    char debug_msg[200];
    sprintf(debug_msg, "is_mobile is %x, netplay client number is %x, keys offset is %X", awsm_info.is_mobile, awsm_info.netplay_client_number, (uint8_t*)&(awsm_info.inputs[0].keys) - (uint8_t*)&(awsm_info.inputs[0].touches));
    // trace((uint8_t*) debug_msg);



}
