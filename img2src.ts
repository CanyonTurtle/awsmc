#!/usr/bin/env bun

import { Command } from 'commander';
import sharp from 'sharp';

const program = new Command();

program
  .description('Converts an image to a C code byte array in RGBA format')
  .requiredOption('-i, --image <path>', 'Path to the input image file')
  .parse(process.argv);

const { image } = program.opts();

if (!image) {
  console.error('Please provide a path to an image using -i or --image');
  process.exit(1);
}

sharp(image)
  .ensureAlpha()
  .raw()
  .toBuffer((err, data, info) => {
    if (err) {
      console.error('Error processing image:', err.message);
      process.exit(1);
    }

    const { width, height, channels } = info;
    const imageData = new Uint8Array(width * height * 4);

    for (let i = 0; i < data.length; i += channels) {
      const pixelIndex = i / channels;
      imageData[pixelIndex * 4] = data[i];       // R
      imageData[pixelIndex * 4 + 1] = data[i + 1]; // G
      imageData[pixelIndex * 4 + 2] = data[i + 2]; // B
      imageData[pixelIndex * 4 + 3] = data[i + 3]; // A
    }

    const headerGuard = `#ifndef IMAGE_DATA_H\n#define IMAGE_DATA_H\n\n`;
    const headerIncludes = `#include <stdint.h>\n\n`;
    const imageArrayDeclaration = `const uint8_t image_data[] = {\n`;
    const imageDataStrings = [];
    for (let i = 0; i < imageData.length; i++) {
      imageDataStrings.push(`0x${imageData[i].toString(16).padStart(2, '0')}`);
    }
    const imageArrayContent = imageDataStrings.join(', ');
    const imageArrayClosing = `\n};\n\n`;
    const imageWidthDeclaration = `const uint32_t image_width = ${width};\n`;
    const imageHeightDeclaration = `const uint32_t image_height = ${height};\n\n`;
    const footerGuard = `#endif // IMAGE_DATA_H\n`;

    const cCode = `${headerGuard}${headerIncludes}${imageArrayDeclaration}${imageArrayContent}${imageArrayClosing}${imageWidthDeclaration}${imageHeightDeclaration}${footerGuard}`;

    console.log(cCode);
  });
