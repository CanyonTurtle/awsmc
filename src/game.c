#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>


// The framebuffer is 4 bytes per pixel - r, g, b, A.
#define FRAMEBUFFER_BYPP 4

// The buffer specifying all the config must live at 0x10.
#define CONFIG_ADDR 0x10
uint16_t* config_buffer = (uint16_t*)CONFIG_ADDR;

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

uint32_t* timer;

const uint8_t btn_color[4] = {0, 0, 0, 255};

// This is the configuration that will be sent to the runtime from here.
typedef struct {
    uint32_t* framebuffer_addr;
    uint32_t* info_addr;
    uint16_t logical_width_px;
    uint16_t logical_height_px;
    uint16_t max_n_players;
} AwsmConfig;

// Here we fill in the settings.
AwsmConfig awsm_config = {
    .framebuffer_addr= (uint32_t*)FRAMEBUFFER_ADDR,
    .info_addr = (uint32_t*)0x20,
    .logical_width_px = SCREEN_WIDTH,
    .logical_height_px = SCREEN_HEIGHT,
    .max_n_players = 1,
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
void configure(void) {

    // Set the screen buffer address
    timer = (uint32_t*)(awsm_config.framebuffer_addr+SCREEN_HEIGHT*SCREEN_WIDTH*FRAMEBUFFER_BYPP);

    memcpy(config_buffer, &awsm_config, sizeof(awsm_config));
}

#define BUTTON_BOTTOM_OFFSET 20
#define BUTTON_SIZE 20

// This function is expected to be in the .wasm to update the screen, etc...
void update(void) {
    timer[0] += 1;
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    for (uint32_t i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
        framebuffer[i * 4] = (uint8_t)(((uint32_t)pow(i*2, 1.4) + timer[0]/2) % 256);        // R
        framebuffer[i * 4 + 1] = (uint8_t)(((uint32_t)pow(i*3, 0.9) + timer[0]/14) % 256);  // G
        framebuffer[i * 4 + 2] = (uint8_t)(((uint32_t)pow(i, 2)/10 + timer[0]/8) % 256); // B
        framebuffer[i * 4 + 3] = (uint8_t)(((uint32_t)sqrt(i*2) + timer[0] / 100) % 256);    // A
    }

    // Access touch data from the buffer
    for (int i = 0; i < touchBufferSize; i++) {
        Touch touch = touch_buffer[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        if (x != 0 && y != 0 && generation) {
            rect(framebuffer, x - BUTTON_SIZE / 2, y - BUTTON_SIZE / 2,BUTTON_SIZE,BUTTON_SIZE, btn_color);
        }

    }
    
}
