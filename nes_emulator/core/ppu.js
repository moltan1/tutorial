// nes_emulator/core/ppu.js

class PPU {
    constructor(nes) {
        this.nes = nes; // Reference to the main NES object

        // PPU Registers (simplified placeholders)
        this.ppuctrl = 0x00;   // $2000 PPUCTRL
        this.ppumask = 0x00;   // $2001 PPUMASK
        this.ppustatus = 0x00; // $2002 PPUSTATUS
        this.oamaddr = 0x00;   // $2003 OAMADDR
        this.oamdata = 0x00;   // $2004 OAMDATA (not directly array, but access port)
        this.ppuscroll = 0x00; // $2005 PPUSCROLL
        this.ppuaddr = 0x00;   // $2006 PPUADDR
        this.ppudata = 0x00;   // $2007 PPUDATA (not directly array, but access port)
        // $4014 OAMDMA

        // PPU Memory
        this.vram = new Uint8Array(0x4000); // 16KB VRAM (includes nametables, attribute tables, pattern tables if not in CHR ROM)
        this.oam = new Uint8Array(0x0100);  // 256 bytes OAM (Object Attribute Memory for sprites)
        
        // Internal PPU state
        this.scanline = 0;
        this.cycle = 0;
        
        // Frame buffer for rendering output (256x240 pixels, RGBA)
        this.frameBuffer = new Uint8ClampedArray(256 * 240 * 4);
        this.frameReady = false;

        console.log("PPU initialized");
    }

    reset() {
        this.ppuctrl = 0x00;
        this.ppumask = 0x00;
        // this.ppustatus, bits 7,6,5 are read-only and have specific startup/reset states.
        // For now, let's clear it, but VBlank flag (bit 7) might be set by hardware after warmup.
        this.ppustatus = 0x80; // Often starts in VBlank
        this.oamaddr = 0x00;
        this.ppuscroll = 0x00; // Writes to $2005 are cleared
        this.ppuaddr = 0x00;   // Writes to $2006 are cleared
        // PPUDATA buffer is undefined/unpredictable on reset.
        
        this.scanline = 0; // Or -1 (pre-render scanline)
        this.cycle = 0;
        this.clearFrameBuffer();
        console.log("PPU reset.");
    }

    clearFrameBuffer() {
        for (let i = 0; i < this.frameBuffer.length; i += 4) {
            this.frameBuffer[i + 0] = 0;   // R
            this.frameBuffer[i + 1] = 0;   // G
            this.frameBuffer[i + 2] = 0;   // B
            this.frameBuffer[i + 3] = 255; // A (opaque)
        }
    }

    // Placeholder for PPU memory read/write
    // These would be accessed by CPU via PPU registers $2000-$2007
    readRegister(address) {
        switch (address) {
            case 0x2002: // PPUSTATUS
                // Reading PPUSTATUS clears VBlank flag (bit 7) and address latch for $2005/$2006
                const status = this.ppustatus;
                this.ppustatus &= ~0x80; // Clear VBlank flag
                // TODO: Clear address latch for $2005/$2006
                return status;
            case 0x2007: // PPUDATA
                // Implement read buffer and actual VRAM/CHR ROM read
                // For now, return a dummy value
                let value = this.vram[this.ppuaddr & 0x3FFF]; // Example: direct VRAM read
                // Increment PPUADDR based on PPUCTRL bit 2
                this.ppuaddr += (this.ppuctrl & 0x04) ? 32 : 1;
                return value; 
            // Other registers are mostly write-only or have specific read behaviors
        }
        return 0; // Default for other readable registers if any (or unreadable)
    }

    writeRegister(address, value) {
        switch (address) {
            case 0x2000: // PPUCTRL
                this.ppuctrl = value;
                break;
            case 0x2001: // PPUMASK
                this.ppumask = value;
                break;
            case 0x2003: // OAMADDR
                this.oamaddr = value;
                break;
            case 0x2004: // OAMDATA
                this.oam[this.oamaddr] = value;
                this.oamaddr = (this.oamaddr + 1) & 0xFF; // Increment OAMADDR
                break;
            case 0x2005: // PPUSCROLL
                // Implement write latch logic
                this.ppuscroll = value; // Simplified
                break;
            case 0x2006: // PPUADDR
                // Implement write latch logic
                // For now, a simplified direct set, assuming two writes.
                // This needs a latch: first write is high byte, second is low byte.
                // A common way is to use a flag.
                if (!this.ppuaddr_latch) {
                    this.ppuaddr = (value & 0x3F) << 8; // First write (bits 0-5 of value, top 2 bits of address are 0)
                    this.ppuaddr_latch = true;
                } else {
                    this.ppuaddr |= value; // Second write
                    this.ppuaddr_latch = false;
                }
                this.ppuaddr &= 0x3FFF; // PPU address space is 14-bit ($0000-$3FFF)
                break;
            case 0x2007: // PPUDATA
                this.vram[this.ppuaddr & 0x3FFF] = value; // Example: direct VRAM write
                // Increment PPUADDR based on PPUCTRL bit 2
                this.ppuaddr += (this.ppuctrl & 0x04) ? 32 : 1;
                this.ppuaddr &= 0x3FFF;
                break;
            case 0x4014: // OAMDMA
                // Initiate OAM DMA transfer from CPU memory page specified by `value`
                // For example, if value is $02, data is copied from $0200-$02FF in CPU memory
                const startAddr = value << 8;
                for (let i = 0; i < 256; i++) {
                    this.oam[i] = this.nes.cpu.read(startAddr + i); // Accessing CPU memory via nes reference
                }
                // This process also stalls the CPU for ~513-514 cycles.
                // TODO: Add CPU cycle penalty
                break;
        }
    }

    // Placeholder for PPU rendering logic
    step() {
        // This method will be called repeatedly to simulate PPU cycles.
        // It should handle scanline rendering, sprite evaluation, NMI generation, etc.

        // For now, let's just fill the framebuffer with a solid color (e.g., blue)
        // to indicate it's doing *something*.
        if (this.scanline === 0 && this.cycle === 0) {
            this.frameReady = false;
        }
        
        // Simple placeholder: Render a full "blank" frame once then set frameReady.
        // A real PPU steps through ~341 cycles per scanline, for 262 scanlines.
        // Visible scanlines are 0-239.
        
        if (this.scanline < 240 && this.cycle === 0) { // At the start of a visible scanline
            for (let x = 0; x < 256; x++) {
                const offset = (this.scanline * 256 + x) * 4;
                this.frameBuffer[offset + 0] = 50;  // R
                this.frameBuffer[offset + 1] = 50;  // G
                this.frameBuffer[offset + 2] = 150; // B (Blue-ish)
                this.frameBuffer[offset + 3] = 255; // A
            }
        }


        this.cycle++;
        if (this.cycle >= 341) { // End of a scanline
            this.cycle = 0;
            this.scanline++;

            if (this.scanline === 241) { // Start of VBlank period
                this.ppustatus |= 0x80; // Set VBlank flag
                if (this.ppuctrl & 0x80) { // If NMI enabled in PPUCTRL
                    this.nes.cpu.nmi(); // Trigger NMI on CPU (nes.cpu.nmi() needs to be implemented)
                }
            } else if (this.scanline >= 261) { // End of VBlank (pre-render line in some diagrams)
                this.scanline = -1; // Or 0, depending on model (pre-render line)
                this.ppustatus &= ~0x80; // Clear VBlank flag
                this.frameReady = true; // Mark frame as ready to be drawn
                // Clear other flags like sprite overflow, sprite 0 hit (TODO)
            }
        }
        return this.frameReady; // Indicates if a new frame is available
    }
}

// If using ES6 modules: export default PPU;
