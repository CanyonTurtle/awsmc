#include <stdint.h>
#include <stdlib.h>
#include <math.h>


// The framebuffer is 4 bytes per pixel - r, g, b, A.
#define FRAMEBUFFER_BYPP 4

// The buffer specifying all the config must live at 0x10.
#define CONFIG_ADDR 0x10


// You can decide these!
#define SCREEN_WIDTH 160
#define SCREEN_HEIGHT 256

// You can also decide where the framebuffer should be.
// Make sure it doesn't overlap other important regions of memory.
#define FRAMEBUFFER_ADDR 0x200
uint8_t* framebuffer = (uint8_t*) FRAMEBUFFER_ADDR;

typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t generation;
} Touch;

Touch* touch_buffer = (Touch*)0x20;
int touchBufferSize = 10;

typedef struct {
    uint32_t timer;
    char just_touched;
} GameState;

GameState* game_state = (GameState*)(FRAMEBUFFER_ADDR+SCREEN_HEIGHT*SCREEN_WIDTH*FRAMEBUFFER_BYPP);

const uint8_t btn_color[4] = {0, 0, 0, 255};

// This is the configuration that will be sent to the runtime from here.
typedef struct {
    uint32_t* framebuffer_addr;
    uint32_t* info_addr;
    uint16_t logical_width_px;
    uint16_t logical_height_px;
    uint16_t max_n_players;
} AwsmConfig;
AwsmConfig* config_buffer = (AwsmConfig*)CONFIG_ADDR;

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
void configure(void) {

    // Here we fill in the settings.
    AwsmConfig awsm_config = {
        .framebuffer_addr= (uint32_t*)FRAMEBUFFER_ADDR,
        .info_addr = (uint32_t*)0x20,
        .logical_width_px = SCREEN_WIDTH,
        .logical_height_px = SCREEN_HEIGHT,
        .max_n_players = 1,
    };
    *config_buffer = awsm_config;

    GameState state = {
        .timer = 0,
        .just_touched = 0,
    };
    *game_state = state;
}

#define BUTTON_BOTTOM_OFFSET 20
#define BUTTON_SIZE 20

// This function is expected to be in the .wasm to update the screen, etc...
void update(void) {
    game_state->timer += 1;
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    float add_mult = 0.5f;
    if (1) {
        

    }


    // Access touch data from the buffer
    char any = 0;
    for (int i = 0; i < touchBufferSize; i++) {
        Touch touch = touch_buffer[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        if (x != 0 && y != 0 && generation) {
            any = 1;
            
            uint8_t rc[4];
            for(int j = 0; j < 4; j++) {
                rc[j] = framebuffer[(y*SCREEN_WIDTH+x)*4+j]; 
            }
            if (!game_state->just_touched) {
                game_state->just_touched = 1;
                for (uint32_t i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
                    framebuffer[i * 4] += (uint8_t)(add_mult * (float)(((uint32_t)pow(i*2, 1.2) + game_state->timer/2) % 200) + 30);        // R
                    framebuffer[i * 4 + 1] += (uint8_t)(add_mult * (float)(((uint32_t)pow(i*3, 1.01) + game_state->timer/14) % 256));  // G
                    framebuffer[i * 4 + 2] += (uint8_t)(add_mult * (float)(((uint32_t)pow(i*5, 0.99)/10 + game_state->timer) % 220)); // B
                    framebuffer[i * 4 + 3] += (uint8_t)(add_mult * (float)(((uint32_t)pow(i, 1.1) + (uint32_t)pow(game_state->timer, 0.9))%190) + 10);    // A
                }
            }
            rect(framebuffer, x - BUTTON_SIZE / 2, y - BUTTON_SIZE / 2,BUTTON_SIZE,BUTTON_SIZE, rc);
        }

    }

    if(!any) {
        game_state->just_touched=0;
    }

    float blur_rate = 0.254;
    if (1) {
        for (uint32_t i = 1; i < SCREEN_HEIGHT  - 1; i++) {
            for (uint32_t j = 1; j < SCREEN_WIDTH  - 1; j++) {
                for (uint32_t offs = 1; offs < 4; offs++) {
                    framebuffer[(i*SCREEN_WIDTH+j)*4+offs] = (
                        (uint8_t)((1.0f - 4.0f*blur_rate)*(float)framebuffer[(i*SCREEN_WIDTH+j)*4+offs])
                        + (uint8_t)(blur_rate*(float)framebuffer[((i-1)*SCREEN_WIDTH+j)*4+offs])
                        + (uint8_t)(blur_rate*(float)framebuffer[((i+1)*SCREEN_WIDTH+j)*4+offs])
                        + (uint8_t)(blur_rate*(float)framebuffer[((i)*SCREEN_WIDTH+j+1)*4+offs])
                        + (uint8_t)(blur_rate*(float)framebuffer[((i)*SCREEN_WIDTH+j-1)*4+offs])
                    );
                }
            }
        }
    }
    
}
