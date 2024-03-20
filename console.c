#include <stdint.h>
#include <stdlib.h>
uint8_t* screen_buffer;
const int SCREEN_WIDTH = 1024;
const int SCREEN_HEIGHT = 1024;
const int FRAMEBUFFER_BYPP = 4;
uint32_t* timer;
volatile uint8_t fb[SCREEN_WIDTH * SCREEN_HEIGHT * FRAMEBUFFER_BYPP];
void configure() {
    // Set the screen buffer address
    screen_buffer = (uint8_t*)0;  // Assuming the screen buffer starts at memory address 0
    timer = (uint32_t*)(SCREEN_HEIGHT*SCREEN_WIDTH*FRAMEBUFFER_BYPP);
}

void update() {
    timer[0] += 1;
    // Your game logic here
    // For now, let's just fill the screen buffer with random colors
    for (int i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
        screen_buffer[i * 4] = (i/6 + timer[0]/3) % 256;//(uint8_t)(i % 256);     // R
        screen_buffer[i * 4 + 1] = (i/5 + timer[0]/7) % 256;//(uint8_t)(i % 256); // G
        screen_buffer[i * 4 + 2] = (i/16 + timer[0]/4) % 256;//(uint8_t)(i % 256); // B
        screen_buffer[i * 4 + 3] = (i + timer[0]/2) % 256;                     // A
    }
}