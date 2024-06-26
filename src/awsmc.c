#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <awsmc.h>

// Please read "awsmc_console_types.ts". That explains how the console works, and will help
// make `configure()` and `update()` make more sense.


// You can decide these!
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 192
#define BUTTON_SIZE 15

// You can also decide where the framebuffer should be.
// Make sure it doesn't overlap other important regions of memory.
uint8_t framebuffer[SCREEN_WIDTH*SCREEN_HEIGHT*FRAMEBUFFER_BYPP];

#define SPRITESHEET_WIDTH 89
#define SPRITESHEET_HEIGHT 16

// You can decide if and where the spritesheet should be.
uint8_t spritesheet[SPRITESHEET_WIDTH*SPRITESHEET_HEIGHT*FRAMEBUFFER_BYPP];


float backing_framebuffer[SCREEN_HEIGHT * SCREEN_WIDTH * FRAMEBUFFER_BYPP];

AwsmInfo awsm_info;

typedef struct {
    uint32_t timer;
    char just_touched;
} GameState;

GameState game_state = {
    .timer = 0,
    .just_touched = 0,
};

AwsmConfig awsm_config;


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

// This function is expected to be in the .wasm to update the screen, etc...

void update(void) {
    game_state.timer += 1;
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    float add_mult = 0.3f;

    char triggered = 0;
    int16_t xx = 0;
    int16_t yy = 0;
    uint8_t rc[4];
    if(game_state.timer < 5) {
        triggered = 1;
    }

    // Access touch data from the buffer
    char any = 0;
    for (int i = 0; i < TOUCH_BUFFER_SIZE; i++) {
        Touch touch = awsm_info.inputs[0].touches[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        if (x != 0 && y != 0 && generation) {
            any = 1;
            trace("touched");
            
            for(int j = 0; j < 4; j++) {
                rc[j] = framebuffer[(y*SCREEN_WIDTH+x)*4+j]; 
            }
            if (!game_state.just_touched) {
                game_state.just_touched = 1;
                triggered = 1;
                
            }
            xx = x - BUTTON_SIZE / 2;
            yy = y - BUTTON_SIZE / 2;
            uint32_t c = (
                ((rc[0] << 24) & 0xff000000) |
                ((rc[1] << 16) & 0xff0000) |
                ((rc[2] << 8) & 0xff00) |
                ((rc[3]) & 0xff)
            );
            fill(xx, yy,BUTTON_SIZE,BUTTON_SIZE, c);
        }

    }

    if(!any) {
        game_state.just_touched=0;
    }

    if(triggered) {
        for (uint32_t i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
            backing_framebuffer[i * 4] += (float)(add_mult * (float)(((uint32_t)pow(i*2, 1.2) + game_state.timer/2) % 200) + 30);        // R
            backing_framebuffer[i * 4 + 1] += (float)(add_mult * (float)(((uint32_t)pow(i*3, 1.01) - 60 * (uint32_t)backing_framebuffer[i * 4] + game_state.timer/14) % 256));  // G
            backing_framebuffer[i * 4 + 2] += (float)(add_mult * (float)(((uint32_t)pow(i*5, 0.99)/10 + 60 * (uint32_t)backing_framebuffer[i * 4 + 1] + game_state.timer) % 220)); // B
            backing_framebuffer[i * 4 + 3] += (float)(add_mult * (float)((uint32_t)(pow(i, 1.1) + pow(game_state.timer, 0.9))%190) + 10);    // A
        }
        
        uint32_t c = (
            ((rc[0] << 24) & 0xff000000) |
            ((rc[1] << 16) & 0xff0000) |
            ((rc[2] << 8) & 0xff00) |
            ((rc[3]) & 0xff)
        );
        fill(xx, yy,BUTTON_SIZE,BUTTON_SIZE, c);
    }

    float blur_rate = 0.02f;
    float channel_rates[4] = {1.0f, 1.0f, 1.0f, 1.0f};
    if (game_state.timer % 1 == 0) {
        for (uint32_t i = 0; i < SCREEN_HEIGHT; i++) {
            for (uint32_t j = 0; j < SCREEN_WIDTH; j++) {
                for (uint32_t offs = 0; offs < 4; offs++) {
                    backing_framebuffer[(i*SCREEN_WIDTH+j)*4+offs] = (
                        (float)((1.0f - 4.0f*blur_rate*channel_rates[offs])*(float)backing_framebuffer[(i*SCREEN_WIDTH+j)*4+offs])
                        + (float)(blur_rate*channel_rates[offs]*(float)backing_framebuffer[(((i-1)%SCREEN_HEIGHT)*SCREEN_WIDTH+j)*4+offs])
                        + (float)(blur_rate*channel_rates[offs]*(float)backing_framebuffer[(((i+1)%SCREEN_HEIGHT)*SCREEN_WIDTH+j)*4+offs])
                        + (float)(blur_rate*channel_rates[offs]*(float)backing_framebuffer[((i)*SCREEN_WIDTH+(j+1)%SCREEN_WIDTH)*4+offs])
                        + (float)(blur_rate*channel_rates[offs]*(float)backing_framebuffer[((i)*SCREEN_WIDTH+(j-1)%SCREEN_WIDTH)*4+offs])
                    );
                }
            }
        }
    }

    for(int i = 0; i < SCREEN_HEIGHT * SCREEN_WIDTH * FRAMEBUFFER_BYPP; i++) {
        framebuffer[i] = (uint8_t) backing_framebuffer[i];
    }
    
    blit((uint8_t*)&spritesheet, 0, 0, SPRITESHEET_WIDTH, (uint8_t*)&framebuffer, SCREEN_WIDTH / 2 - SPRITESHEET_WIDTH / 2, SCREEN_HEIGHT / 2 - SPRITESHEET_HEIGHT / 2, SCREEN_WIDTH, SPRITESHEET_WIDTH, SPRITESHEET_HEIGHT, 0);
}
