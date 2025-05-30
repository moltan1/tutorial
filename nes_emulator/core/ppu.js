// nes_emulator/core/ppu.js

class PPU {
    // Standard NES Palette
    static NES_PALETTE = [
        [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136], [68, 0, 100], [92, 0, 48], [84, 4, 0], [60, 24, 0], [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0], [0, 50, 60], [0, 0, 0], // 0x00-0x0D
        [0, 0, 0], [0, 0, 0], // Mirrors for 0x0E, 0x0F

        [152, 150, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228], [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0], [84, 90, 0], [40, 114, 0], [8, 124, 0], [0, 118, 40], [0, 102, 120], [0, 0, 0], // 0x10-0x1D
        [0, 0, 0], [0, 0, 0], // Mirrors for 0x1E, 0x1F

        [236, 238, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236], [228, 84, 236], [236, 88, 180], [236, 106, 100], [212, 136, 32], [160, 170, 0], [116, 196, 0], [76, 208, 32], [56, 204, 108], [56, 180, 220], [60, 60, 60], // 0x20-0x2D
        [0, 0, 0], [0, 0, 0], // Mirrors for 0x2E, 0x2F

        [236, 238, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236], [236, 174, 236], [236, 174, 212], [236, 180, 176], [228, 196, 144], [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180], [160, 214, 228], [160, 162, 160], // 0x30-0x3D
        [0, 0, 0], [0, 0, 0]  // Mirrors for 0x3E, 0x3F
    ];

    constructor(nes) {
        this.nes = nes;

        this.ppuctrl = 0x00;
        this.ppumask = 0x00;
        this.ppustatus = 0x00;
        this.oamaddr = 0x00;

        this.vram = new Uint8Array(0x4000);
        this.oam = new Uint8Array(0x0100);  // Primary OAM

        this.frameBuffer = new Uint8ClampedArray(256 * 240 * 4);

        this.v = 0x0000;
        this.t = 0x0000;
        this.x = 0;
        this.w = 0;

        this.cycle = 0;
        this.scanline = -1;
        this.frameReady = false;
        this.f = 0;

        this.current_nt_byte = 0;
        this.current_tile_lsb = 0;
        this.current_tile_msb = 0;
        this.current_attr_byte = 0;
        this.current_palette_upper_bits = 0;

        // Sprite rendering properties
        this.secondaryOAM = new Uint8Array(32); // For 8 sprites, 4 bytes each (Y, Tile, Attr, X)
        this.spriteZeroOnScanline = false;      // Flag for sprite 0 hit detection for current scanline
        this.spritesFoundForNextScanline = 0;   // Count of sprites in secondaryOAM for NEXT scanline
        this.spriteZeroWillBeOnNextScanline = false; // If sprite 0 is among those in secondaryOAM

        this.spritePatternShiftRegLo = new Uint8Array(8); // Low bits of pattern for 8 sprites
        this.spritePatternShiftRegHi = new Uint8Array(8); // High bits of pattern for 8 sprites
        this.spriteAttributeLatches = new Uint8Array(8);  // Attribute byte for 8 sprites
        this.spriteXCounters = new Uint8Array(8);         // X position counter for 8 sprites
        this.spritesToRenderThisScanline = 0;             // Number of sprites to actually render on current scanline

        this.ppuaddr_latch = false; // This was from an older implementation, 'w' now serves this for $2005/$2006
        this.ppuDataBuffer = 0; // Buffer for PPUDATA reads

        this.reset();
        console.log("PPU initialized with sprite rendering logic.");
    }

    reset() {
        this.ppuctrl = 0x00;
        this.ppumask = 0x00;
        this.ppustatus = 0x80;
        this.oamaddr = 0x00;

        this.v = 0x0000;
        this.t = 0x0000;
        this.x = 0;
        this.w = 0;
        this.f = 0;

        this.current_nt_byte = 0;
        this.current_tile_lsb = 0;
        this.current_tile_msb = 0;
        this.current_attr_byte = 0;
        this.current_palette_upper_bits = 0;

        // Reset sprite properties
        for (let i = 0; i < this.secondaryOAM.length; i++) this.secondaryOAM[i] = 0xFF;
        this.spriteZeroOnScanline = false;
        this.spritesFoundForNextScanline = 0;
        this.spriteZeroWillBeOnNextScanline = false;
        for (let i = 0; i < 8; i++) {
            this.spritePatternShiftRegLo[i] = 0;
            this.spritePatternShiftRegHi[i] = 0;
            this.spriteAttributeLatches[i] = 0;
            this.spriteXCounters[i] = 0;
        }
        this.spritesToRenderThisScanline = 0;
        this.ppuDataBuffer = 0; // Reset buffer

        this.cycle = 0;
        this.scanline = -1;
        this.frameReady = false;

        this.clearFrameBuffer();
        console.log("PPU reset.");
    }

    clearFrameBuffer() {
        for (let i = 0; i < this.frameBuffer.length; i += 4) {
            this.frameBuffer[i + 0] = 0;
            this.frameBuffer[i + 1] = 0;
            this.frameBuffer[i + 2] = 0;
            this.frameBuffer[i + 3] = 255;
        }
    }

    readRegister(address) {
        address &= 0x2007;
        switch (address) {
            case 0x2002: // PPUSTATUS
                const status = (this.ppustatus & 0xE0);
                this.ppustatus &= ~0x80;
                this.w = 0;
                return status;
            case 0x2007: // PPUDATA
                let data;
                let addr = this.v & 0x3FFF;
                if (addr >= 0x3F00) { // Palette RAM access is not buffered
                    data = this.nes.ppuRead(addr);
                    this.ppuDataBuffer = this.nes.ppuRead(addr - 0x1000); // Buffer is filled with VRAM data "behind" palette
                } else { // VRAM access is buffered
                    data = this.ppuDataBuffer;
                    this.ppuDataBuffer = this.nes.ppuRead(addr);
                }
                this.v += (this.ppuctrl & 0x04) ? 32 : 1;
                this.v &= 0x7FFF;
                return data;
        }
        return 0;
    }

    writeRegister(address, value) {
        address &= 0x2007;
        switch (address) {
            case 0x2000: // PPUCTRL
                this.ppuctrl = value;
                this.t = (this.t & 0xF3FF) | ((value & 0x03) << 10);
                break;
            case 0x2001: // PPUMASK
                this.ppumask = value;
                break;
            case 0x2003: // OAMADDR
                this.oamaddr = value;
                break;
            case 0x2004: // OAMDATA
                this.oam[this.oamaddr] = value;
                this.oamaddr = (this.oamaddr + 1) & 0xFF;
                break;
            case 0x2005: // PPUSCROLL
                if (this.w === 0) {
                    this.t = (this.t & 0xFFE0) | (value >> 3);
                    this.x = value & 0x07;
                    this.w = 1;
                } else {
                    this.t = (this.t & 0x8FFF) | ((value & 0x07) << 12);
                    this.t = (this.t & 0xFC1F) | ((value & 0xF8) << 2);
                    this.w = 0;
                }
                break;
            case 0x2006: // PPUADDR
                if (this.w === 0) {
                    this.t = (this.t & 0x00FF) | ((value & 0x3F) << 8);
                    this.w = 1;
                } else {
                    this.t = (this.t & 0xFF00) | value;
                    this.v = this.t;
                    this.w = 0;
                }
                break;
            case 0x2007: // PPUDATA
                this.nes.ppuWrite(this.v & 0x3FFF, value);
                this.v += (this.ppuctrl & 0x04) ? 32 : 1;
                this.v &= 0x7FFF;
                break;
            case 0x4014: // OAMDMA
                const startAddr = value << 8;
                for (let i = 0; i < 256; i++) {
                    this.oam[(this.oamaddr + i) & 0xFF] = this.nes.cpuRead(startAddr + i);
                }
                if (this.nes.cpu && this.nes.cpu.stallCycles !== undefined) {
                     this.nes.cpu.stallCycles += 513 + (this.nes.cpu.totalCycles % 2);
                }
                break;
        }
    }

    drawPixel(x, y, color) {
        if (x < 0 || x >= 256 || y < 0 || y >= 240) return;
        const offset = (y * 256 + x) * 4;
        this.frameBuffer[offset + 0] = color[0];
        this.frameBuffer[offset + 1] = color[1];
        this.frameBuffer[offset + 2] = color[2];
        this.frameBuffer[offset + 3] = color[3];
    }

    getPaletteColor(full_palette_index, isBgColor0) {
        let color_byte_nes_index;
        if (isBgColor0) {
            color_byte_nes_index = this.nes.ppuRead(0x3F00);
        } else {
            let paletteRamAddr = 0x3F00 + full_palette_index;
            color_byte_nes_index = this.nes.ppuRead(paletteRamAddr & 0x3F1F);
        }
        color_byte_nes_index &= 0x3F;
        let rgbColor = PPU.NES_PALETTE[color_byte_nes_index];
        if (!rgbColor) return [255,0,255,255];
        return [rgbColor[0], rgbColor[1], rgbColor[2], 255];
    }

    getPaletteColorForSprite(spritePaletteNum, pixelColorIndex) {
        if (pixelColorIndex === 0) return null; // Transparent
        let paletteRamAddr = 0x3F10 + (spritePaletteNum * 4) + pixelColorIndex;
        let color_byte_nes_index = this.nes.ppuRead(paletteRamAddr & 0x3F1F); // Sprite palettes are $3F10-$3F1F
        color_byte_nes_index &= 0x3F;
        let rgbColor = PPU.NES_PALETTE[color_byte_nes_index];
        if (!rgbColor) return [255,0,0,255]; // Error color
        return [rgbColor[0], rgbColor[1], rgbColor[2], 255];
    }

    incrementHorizontalV() {
        if ((this.v & 0x001F) === 31) { this.v &= ~0x001F; this.v ^= 0x0400; }
        else { this.v++; }
    }

    incrementVerticalV() {
        if ((this.v & 0x7000) !== 0x7000) { this.v += 0x1000; }
        else {
            this.v &= ~0x7000;
            let y = (this.v & 0x03E0) >> 5;
            if (y === 29) { y = 0; this.v ^= 0x0800; }
            else if (y === 31) { y = 0; }
            else { y++; }
            this.v = (this.v & ~0x03E0) | (y << 5);
        }
    }

    copyHorizontalTtoV() { this.v = (this.v & ~0x041F) | (this.t & 0x041F); }
    copyVerticalTtoV() { this.v = (this.v & ~0x7BE0) | (this.t & 0x7BE0); }

    step() {
        // Temporary storage for background pixel color index for sprite 0 hit
        let bg_pixel_color_index_for_sprite0_check = 0;

        // --- Pre-render Scanline (-1) and Visible Scanlines (0-239) ---
        if (this.scanline >= -1 && this.scanline <= 239) {
            if (this.scanline === -1 && this.cycle === 1) {
                this.ppustatus &= ~0xE0; // Clear VBlank, Sprite 0 Hit, Sprite Overflow
                this.spriteZeroOnScanline = false; // Reset for the frame
            }

            // Sprite Evaluation for NEXT scanline (Cycles 65-256 of current scanline)
            // This is a simplified placement; actual PPU does this in parallel.
            if (this.cycle === 256 && this.scanline >= -1 && this.scanline < 239) { // Prepare for scanline + 1
                for (let i = 0; i < this.secondaryOAM.length; i++) this.secondaryOAM[i] = 0xFF;
                this.spritesFoundForNextScanline = 0;
                this.spriteZeroWillBeOnNextScanline = false;
                let potentialOverflow = false;
                let spriteHeight = (this.ppuctrl & 0x20) ? 16 : 8;

                for (let n = 0; n < 64; n++) {
                    let spriteY = this.oam[n * 4 + 0];
                    // Difference for next scanline
                    let rowOffset = (this.scanline + 1) - spriteY;

                    if (rowOffset >= 0 && rowOffset < spriteHeight) {
                        if (this.spritesFoundForNextScanline < 8) {
                            this.secondaryOAM[this.spritesFoundForNextScanline * 4 + 0] = spriteY;
                            this.secondaryOAM[this.spritesFoundForNextScanline * 4 + 1] = this.oam[n * 4 + 1];
                            this.secondaryOAM[this.spritesFoundForNextScanline * 4 + 2] = this.oam[n * 4 + 2];
                            this.secondaryOAM[this.spritesFoundForNextScanline * 4 + 3] = this.oam[n * 4 + 3];
                            if (n === 0) this.spriteZeroWillBeOnNextScanline = true;
                            this.spritesFoundForNextScanline++;
                        } else {
                            potentialOverflow = true;
                            // In real hardware, the PPU continues scanning OAM for sprite overflow,
                            // but this check is more complex. Simplified for now.
                            break;
                        }
                    }
                }
                if (potentialOverflow) this.ppustatus |= 0x20;
                // else this.ppustatus &= ~0x20; // Overflow flag is sticky
            }

            // Sprite Pattern Fetching for CURRENT scanline (Cycles 1-64 conceptually, but simplified here)
            // This uses data prepared by evaluation on the *previous* scanline.
            if (this.cycle === 1 && this.scanline >= 0 && this.scanline <= 239) {
                 this.spriteZeroOnScanline = this.spriteZeroWillBeOnNextScanline; // Transfer sprite 0 presence
                 this.spritesToRenderThisScanline = this.spritesFoundForNextScanline; // Latch count for current scanline

                 let spriteHeight = (this.ppuctrl & 0x20) ? 16 : 8;
                 for (let i = 0; i < this.spritesToRenderThisScanline; i++) {
                    let spriteY    = this.secondaryOAM[i * 4 + 0];
                    let tileIndex  = this.secondaryOAM[i * 4 + 1];
                    let attributes = this.secondaryOAM[i * 4 + 2];
                    let spriteX    = this.secondaryOAM[i * 4 + 3];

                    this.spriteXCounters[i] = spriteX;
                    this.spriteAttributeLatches[i] = attributes;

                    let row = this.scanline - spriteY;
                    if (attributes & 0x80) row = (spriteHeight - 1) - row; // Vertical flip

                    let patternAddr;
                    if (spriteHeight === 16) {
                        let patternTableBase = (tileIndex & 0x01) ? 0x1000 : 0x0000;
                        tileIndex &= 0xFE;
                        if (row >= 8) { tileIndex++; row -= 8; }
                        patternAddr = patternTableBase + (tileIndex * 16) + row;
                    } else {
                        let patternTableBase = (this.ppuctrl & 0x08) ? 0x1000 : 0x0000;
                        patternAddr = patternTableBase + (tileIndex * 16) + row;
                    }
                    this.spritePatternShiftRegLo[i] = this.nes.ppuRead(patternAddr);
                    this.spritePatternShiftRegHi[i] = this.nes.ppuRead(patternAddr + 8);
                 }
            }


            // Background Rendering Logic
            if (this.ppumask & 0x08) {
                if (this.cycle >= 1 && this.cycle <= 256) {
                    let x_coord = this.cycle - 1;
                    let y_coord = this.scanline;

                    if (y_coord >=0) {
                        if ((this.cycle -1) % 8 === 0 ) {
                            let nt_byte_addr = 0x2000 | (this.v & 0x0FFF);
                            this.current_nt_byte = this.nes.ppuRead(nt_byte_addr);
                            let pattern_base = (this.ppuctrl & 0x10) ? 0x1000 : 0x0000;
                            let fine_y_scroll = (this.v >> 12) & 0x07;
                            let tile_row_addr = pattern_base + (this.current_nt_byte * 16) + fine_y_scroll;
                            this.current_tile_lsb = this.nes.ppuRead(tile_row_addr);
                            this.current_tile_msb = this.nes.ppuRead(tile_row_addr + 8);
                            let attr_base = 0x23C0 | (this.v & 0x0C00);
                            let coarseX = (this.v >> 0) & 0x1F;
                            let coarseY = (this.v >> 5) & 0x1F;
                            let attr_offset = (Math.floor(coarseY / 4) * 8) + Math.floor(coarseX / 4);
                            let attr_byte_addr = attr_base + attr_offset;
                            this.current_attr_byte = this.nes.ppuRead(attr_byte_addr);
                            let sub_tile_col_group = Math.floor(coarseX % 4 / 2);
                            let sub_tile_row_group = Math.floor(coarseY % 4 / 2);
                            let attr_shift = (sub_tile_col_group * 2) + (sub_tile_row_group * 4);
                            this.current_palette_upper_bits = (this.current_attr_byte >> attr_shift) & 0x03;
                        }

                        let pixel_idx_lsb = (this.current_tile_lsb >> (7 - this.x)) & 1;
                        let pixel_idx_msb = (this.current_tile_msb >> (7 - this.x)) & 1;
                        bg_pixel_color_index_for_sprite0_check = pixel_idx_lsb | (pixel_idx_msb << 1);

                        let full_palette_index = (this.current_palette_upper_bits << 2) | bg_pixel_color_index_for_sprite0_check;
                        let isBgColor0 = (bg_pixel_color_index_for_sprite0_check === 0);
                        let color = this.getPaletteColor(full_palette_index, isBgColor0);
                        this.drawPixel(x_coord, y_coord, color); // Draw background pixel first
                    }

                    if (this.cycle % 8 === 0) {
                         this.incrementHorizontalV();
                    }
                }
            } else { // Background rendering disabled, fill with universal background color
                 if (this.cycle >= 1 && this.cycle <= 256 && this.scanline >= 0) {
                    let x_coord = this.cycle - 1;
                    let y_coord = this.scanline;
                    let color = PPU.NES_PALETTE[this.nes.ppuRead(0x3F00) & 0x3F];
                    this.drawPixel(x_coord, y_coord, [color[0], color[1], color[2], 255]);
                    bg_pixel_color_index_for_sprite0_check = 0; // BG is transparent effectively
                 }
            }

            // Sprite Pixel Rendering Logic
            if (this.ppumask & 0x10 && this.scanline >=0) { // If sprite rendering is enabled and on visible scanline
                if (this.cycle >= 1 && this.cycle <= 256) {
                    let x_coord = this.cycle - 1;
                    let y_coord = this.scanline;
                    let spritePixelDrawn = false;

                    for (let i = 0; i < this.spritesToRenderThisScanline; i++) {
                        if (this.spriteXCounters[i] === 0 && !spritePixelDrawn) { // Sprite is active at current X and no higher-priority sprite drawn
                            let pattern_lsb = this.spritePatternShiftRegLo[i];
                            let pattern_msb = this.spritePatternShiftRegHi[i];
                            let attributes  = this.spriteAttributeLatches[i];
                            let sprite_pixel_color_index;

                            if (attributes & 0x40) { // Flip Horizontally
                                sprite_pixel_color_index = ((pattern_lsb >> 0) & 1) | (((pattern_msb >> 0) & 1) << 1);
                                // For next cycle, this sprite's pattern will be shifted.
                                // Note: This simplified model re-evaluates bit extraction per pixel.
                                // A real PPU shifts the registers. For now, this is okay.
                            } else { // No flip
                                sprite_pixel_color_index = ((pattern_lsb >> 7) & 1) | (((pattern_msb >> 7) & 1) << 1);
                            }

                            if (sprite_pixel_color_index !== 0) { // If sprite pixel is not transparent
                                let palette_upper_bits = (attributes & 0x03);
                                let sprite_color = this.getPaletteColorForSprite(palette_upper_bits, sprite_pixel_color_index);

                                // Sprite 0 Hit Detection
                                if (this.spriteZeroOnScanline && i === 0 && x_coord < 255 &&
                                    bg_pixel_color_index_for_sprite0_check !== 0 && // BG pixel opaque
                                    (this.ppumask & 0x08) && // BG enabled
                                    !(this.ppustatus & 0x40)) { // Not already set
                                    this.ppustatus |= 0x40;
                                }

                                let priority = (attributes & 0x20); // Bit 5: 0=Sprite in front of BG, 1=Sprite behind BG
                                if (priority === 0 || (priority !== 0 && bg_pixel_color_index_for_sprite0_check === 0) ) {
                                    if(sprite_color) this.drawPixel(x_coord, y_coord, sprite_color);
                                    spritePixelDrawn = true; // Mark that a sprite pixel was drawn here
                                }
                                // For this simplified model, once an opaque sprite pixel is chosen, we break.
                                // Real PPU evaluates all 8 sprites for the current pixel then picks highest priority.
                                break;
                            }
                        }
                    }
                }
            }

            // Decrement X counters for sprites for next pixel on this scanline
            if (this.cycle >= 1 && this.cycle <= 256 && this.scanline >=0) {
                for (let i = 0; i < this.spritesToRenderThisScanline; i++) {
                    if (this.spriteXCounters[i] > 0) {
                        this.spriteXCounters[i]--;
                    }
                }
            }


            // Background scrolling updates
            if (this.ppumask & 0x08) { // If background rendering enabled
                if (this.cycle === 256) {
                    if (this.ppumask & 0x18) this.incrementVerticalV();
                } else if (this.cycle === 257) {
                    if (this.ppumask & 0x18) this.copyHorizontalTtoV();
                }
            }
            if (this.scanline === -1 && this.cycle >= 280 && this.cycle <= 304) {
                if (this.ppumask & 0x18) {
                     this.copyVerticalTtoV();
                }
            }
        }
        // --- VBlank Scanlines (240-260) ---
        else if (this.scanline === 241 && this.cycle === 1) {
            this.ppustatus |= 0x80;
            this.frameReady = true;
            if (this.ppuctrl & 0x80) {
                this.nes.triggerNmi();
            }
        }

        this.cycle++;
        if (this.cycle > 340) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline > 260) {
                this.scanline = -1;
                this.frameReady = false;
            }
        }
        return this.frameReady;
    }
}

// If using ES6 modules: export default PPU;
