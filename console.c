#include <stdint.h>
#include <stdlib.h>

#define FRAMEBUFFER_BYPP 4
#define FRAMEBUFFER_ADDR 0x100
#define CONFIG_ADDR 0x10

#define SCREEN_WIDTH 160
#define SCREEN_HEIGHT 256


uint8_t* screen_buffer;
uint16_t* config_buffer;

uint32_t* timer;
void configure() {
    // Set the screen buffer address
    screen_buffer = (uint8_t*)FRAMEBUFFER_ADDR;  // Assuming the screen buffer starts at memory address 0
    timer = (uint32_t*)(FRAMEBUFFER_ADDR+SCREEN_HEIGHT*SCREEN_WIDTH*FRAMEBUFFER_BYPP);
    config_buffer = (uint16_t*)CONFIG_ADDR;

    config_buffer[0] = SCREEN_WIDTH;
    config_buffer[1] = SCREEN_HEIGHT;
}

void update() {
    timer[0] += 1;
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    for (int i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
        screen_buffer[i * 4] = (i*2 + timer[0]/2) % 220;        // R
        screen_buffer[i * 4 + 1] = (i*3 + timer[0]/14) % 256;  // G
        screen_buffer[i * 4 + 2] = (i*5 + timer[0]/8) % 199; // B
        screen_buffer[i * 4 + 3] = (i*11 + timer[0]/22) % 256;    // A
    }
}