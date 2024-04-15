#include <stdint.h>
#include <stdlib.h>
#include <math.h>

#define FRAMEBUFFER_BYPP 4
#define FRAMEBUFFER_ADDR 0x200
#define CONFIG_ADDR 0x10
#define TOUCH_RINGBUFFER_ADDR 0x20

typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t generation;
} Touch;

Touch* touch_buffer;
int touchBufferSize = 10;


#define SCREEN_WIDTH 160
#define SCREEN_HEIGHT 256

#define MIN(a,b) (((a)<(b))?(a):(b))
#define MAX(a,b) (((a)>(b))?(a):(b))

uint8_t* screen_buffer;
uint16_t* config_buffer;

uint32_t* timer;

const uint8_t btn_color[4] = {0, 0, 0, 255};

#ifndef IMAGE_DATA_H
#define IMAGE_DATA_H

#include <stdint.h>

const uint32_t image_width = 717;
const uint32_t image_height = 628;

#endif // IMAGE_DATA_H



void rect_unchecked(uint16_t sx, const uint16_t sy, const uint16_t ex, const uint16_t ey, const uint8_t color[4]) {
    for (int i = sy; i < ey; i++) {
        for(int j = sx; j < ex; j++) {
            screen_buffer[(i*SCREEN_WIDTH+j) * 4] = color[0]; 
            screen_buffer[(i*SCREEN_WIDTH+j) * 4 + 1] = color[1]; 
            screen_buffer[(i*SCREEN_WIDTH+j) * 4 + 2] = color[2]; 
            screen_buffer[(i*SCREEN_WIDTH+j) * 4 + 3] = color[3]; 
        }
    }
}

void rect(const int16_t sx, const int16_t sy, const uint16_t w, const uint16_t h, const uint8_t color[4]) {
    rect_unchecked(MAX(sx, 0), MAX(sy, 0), MIN(sx+w, SCREEN_WIDTH-1), MIN(sy+h, SCREEN_HEIGHT-1), color);
}

void configure() {
    // Set the screen buffer address
    screen_buffer = (uint8_t*)FRAMEBUFFER_ADDR;  // Assuming the screen buffer starts at memory address 0
    timer = (uint32_t*)(FRAMEBUFFER_ADDR+SCREEN_HEIGHT*SCREEN_WIDTH*FRAMEBUFFER_BYPP);
    config_buffer = (uint16_t*)CONFIG_ADDR;

    config_buffer[0] = SCREEN_WIDTH;
    config_buffer[1] = SCREEN_HEIGHT;

    touch_buffer = (Touch*)TOUCH_RINGBUFFER_ADDR;
}

#define BUTTON_BOTTOM_OFFSET 20
#define BUTTON_SIZE 20

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
    
    // rect(15, SCREEN_HEIGHT - BUTTON_BOTTOM_OFFSET - BUTTON_SIZE,BUTTON_SIZE,BUTTON_SIZE, &btn_color[0]);
    // rect(15, 15,BUTTON_SIZE,BUTTON_SIZE, btn_color);

    // Access touch data from the buffer
    for (int i = 0; i < touchBufferSize; i++) {
        Touch touch = touch_buffer[i];
        uint16_t x = touch.x;
        uint16_t y = touch.y;
        uint16_t generation = touch.generation;

        // Use touch data as needed
        // For example:
        // printf("Touch[%d]: X=%d, Y=%d, Generation=%d\n", i, x, y, generation);
        if (x != 0 && y != 0 && generation) {
            rect(x - BUTTON_SIZE / 2, y - BUTTON_SIZE / 2,BUTTON_SIZE,BUTTON_SIZE, btn_color);
        }

    }
    
}