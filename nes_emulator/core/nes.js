// nes_emulator/core/nes.js

// This script assumes CPU, PPU, Cartridge classes are available globally
// or will be imported if using modules. For direct script includes in HTML,
// ensure nes.js is loaded AFTER cpu.js, ppu.js, and cartridge.js.

class NES {
    constructor(canvasContext) {
        console.log("NES Emulator initializing...");
        this.canvasContext = canvasContext;
        
        this.cpu = new CPU(this); // Pass NES reference to CPU for bus-like access
        this.ppu = new PPU(this); // Pass NES reference to PPU
        this.cartridge = new Cartridge(this); // Pass NES reference to Cartridge

        // Controller state (placeholder)
        this.controller1 = {
            buttons: { A: false, B: false, SELECT: false, START: false, UP: false, DOWN: false, LEFT: false, RIGHT: false },
            strobe: false,
            index: 0 // For reading button states sequentially
        };
        // this.controller2 = ... // Placeholder for 2nd controller

        this.isRunning = false;
        this.animationFrameId = null;

        this.cyclesPerFrame = 29780.5; // Approximate PPU cycles per frame (NTSC)
                                     // (341 PPU cycles/scanline * 262 scanlines / frame) / (CPU cycles per PPU cycle = usually 3)
                                     // More accurately, CPU runs at 1.789773 MHz, PPU at 5.369318 MHz.
                                     // Each CPU instruction takes a number of CPU cycles. PPU does 3 cycles for every 1 CPU cycle.

        console.log("NES Emulator components (CPU, PPU, Cartridge) instantiated.");
    }

    // --- ROM Handling ---
    loadROM(romData) { // romData is an ArrayBuffer
        if (!this.cartridge.loadRom(romData)) {
            console.error("Failed to load ROM into cartridge.");
            return false;
        }
        console.log("ROM successfully loaded into cartridge.");
        this.reset();
        return true;
    }

    // --- System Control ---
    reset() {
        console.log("NES System Resetting...");
        this.cpu.reset();
        this.ppu.reset();
        // Cartridge mapper reset might be needed here if it has state
        // this.cartridge.reset(); 
        console.log("NES System Reset complete.");
        // PC should be set by cpu.reset() from reset vector $FFFC read via cartridge
        // For now, cpu.reset() has a placeholder. We need to implement CPU memory mapping to cartridge.
        this.cpu.pc = this.cpuRead(0xFFFC) | (this.cpuRead(0xFFFD) << 8);
        console.log(`CPU PC set from reset vector: 0x${this.cpu.pc.toString(16)}`);

    }

    start() {
        if (!this.cartridge.valid) {
            console.error("Cannot start emulation: No valid ROM loaded.");
            alert("Please load a ROM file first.");
            return;
        }
        if (this.isRunning) {
            console.warn("Emulator is already running.");
            return;
        }
        this.isRunning = true;
        console.log("Starting NES Emulation...");
        this.mainLoop();
    }

    stop() {
        if (!this.isRunning) {
            console.warn("Emulator is not running.");
            return;
        }
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log("NES Emulation Stopped.");
    }

    // --- Main Emulation Loop ---
    mainLoop() {
        if (!this.isRunning) {
            return;
        }

        // Number of CPU cycles to run per frame.
        // PPU runs 3 times faster than CPU. ~29780 PPU cycles per frame.
        // So, ~9926 CPU cycles per frame.
        const targetCpuCyclesPerFrame = this.cyclesPerFrame / 3; 
        let cyclesThisFrame = 0;

        while (cyclesThisFrame < targetCpuCyclesPerFrame) {
            if (!this.cartridge.valid) { // Check if ROM is still valid (e.g. was ejected)
                this.stop();
                return;
            }
            
            // Execute one CPU instruction, returns number of cycles taken by the instruction
            const cpuCycles = this.cpu.step(); // cpu.step() needs to be implemented
            cyclesThisFrame += cpuCycles;

            // PPU runs 3x the speed of CPU.
            for (let i = 0; i < cpuCycles * 3; i++) {
                this.ppu.step(); // ppu.step() advances PPU state by one PPU cycle
                if (this.ppu.frameReady) { // Check if PPU has completed a frame
                    this.renderFrame();
                    this.ppu.frameReady = false; // Reset for next frame
                    // Potentially could break early here if vsyncing to display,
                    // but for fixed loop, we continue until CPU cycles are met.
                }
            }
        }
        
        // Request next frame
        this.animationFrameId = requestAnimationFrame(() => this.mainLoop());
    }

    renderFrame() {
        if (this.canvasContext && this.ppu.frameBuffer) {
            // Create an ImageData object from the PPU's framebuffer
            const imageData = new ImageData(this.ppu.frameBuffer, 256, 240);
            this.canvasContext.putImageData(imageData, 0, 0);
        }
    }

    // --- CPU Memory Bus (Simplified) ---
    // The CPU needs to read/write to various parts of the system:
    // $0000 - $1FFF: 2KB Internal RAM (mirrored)
    // $2000 - $3FFF: PPU Registers (mirrored)
    // $4000 - $4017: APU and I/O Registers
    // $4018 - $401F: APU and I/O functionality that is normally disabled.
    // $4020 - $FFFF: Cartridge space (PRG ROM, PRG RAM, mapper registers)

    cpuRead(address) {
        address &= 0xFFFF; // Ensure 16-bit address

        if (address >= 0x0000 && address <= 0x1FFF) { // Internal RAM ($0000-$07FF mirrored up to $1FFF)
            return this.cpu.memory[address & 0x07FF]; // Access CPU's internal RAM
        } else if (address >= 0x2000 && address <= 0x3FFF) { // PPU Registers ($2000-$2007 mirrored up to $3FFF)
            return this.ppu.readRegister(0x2000 + (address & 0x0007));
        } else if (address === 0x4016) { // Controller 1 Read
            return this.readController(this.controller1);
        } else if (address === 0x4017) { // Controller 2 Read (placeholder)
            // return this.readController(this.controller2);
            return 0;
        } else if (address >= 0x4020 && address <= 0xFFFF) { // Cartridge Space
            return this.cartridge.readPrg(address);
        } else if (address >= 0x4000 && address <= 0x401F) { // APU/IO Registers
            // TODO: Implement APU/IO register reads
            // console.warn(`NES_cpuRead: Unhandled APU/IO read at $${address.toString(16)}`);
            return 0; // Open bus behavior can vary
        }
        // console.warn(`NES_cpuRead: Unhandled read at $${address.toString(16)}`);
        return 0; // Open bus behavior
    }

    cpuWrite(address, value) {
        address &= 0xFFFF; // Ensure 16-bit address
        value &= 0xFF;     // Ensure 8-bit value

        if (address >= 0x0000 && address <= 0x1FFF) { // Internal RAM
            this.cpu.memory[address & 0x07FF] = value;
        } else if (address >= 0x2000 && address <= 0x3FFF) { // PPU Registers
            this.ppu.writeRegister(0x2000 + (address & 0x0007), value);
        } else if (address === 0x4014) { // OAMDMA register in PPU (but accessed via CPU address space)
            this.ppu.writeRegister(address, value); // PPU handles OAMDMA
        } else if (address === 0x4016) { // Controller Strobe
            this.controller1.strobe = (value & 1) === 1;
            if (this.controller1.strobe) {
                this.controller1.index = 0; // Reset read index on strobe
            }
            // if (this.controller2) this.controller2.strobe = (value & 1) === 1; // etc.
        } else if (address >= 0x4000 && address <= 0x401F) { // APU/IO Registers (excluding 0x4014, 0x4016 handled)
            // TODO: Implement APU/IO register writes
            // console.warn(`NES_cpuWrite: Unhandled APU/IO write to $${address.toString(16)} with value $${value.toString(16)}`);
        } else if (address >= 0x4020 && address <= 0xFFFF) { // Cartridge Space
            this.cartridge.writePrg(address, value);
        } else {
            // console.warn(`NES_cpuWrite: Unhandled write to $${address.toString(16)} with value $${value.toString(16)}`);
        }
    }
    
    // --- PPU Memory Bus (Simplified) ---
    // The PPU has its own address space for CHR ROM/RAM, Nametables, Palettes
    // $0000 - $1FFF: Pattern Tables (from Cartridge CHR ROM or CHR RAM)
    // $2000 - $2FFF: Nametables (VRAM)
    // $3000 - $3EFF: Mirrors of $2000-$2EFF
    // $3F00 - $3F1F: Palette RAM
    // $3F20 - $3FFF: Mirrors of $3F00-$3F1F

    ppuRead(address) {
        address &= 0x3FFF; // PPU addresses are 14-bit

        if (address >= 0x0000 && address <= 0x1FFF) { // Pattern Tables (CHR ROM/RAM)
            return this.cartridge.readChr(address);
        } else if (address >= 0x2000 && address <= 0x3EFF) { // Nametables (VRAM)
            // Handle mirroring (TODO: This needs to be configurable by cartridge.mirroring)
            // Simple NROM mirroring:
            // Horizontal: $2000=$2400, $2800=$2C00
            // Vertical:   $2000=$2800, $2400=$2C00
            const mirroredAddr = this.mapNametableAddress(address);
            return this.ppu.vram[mirroredAddr]; // Access PPU's internal VRAM for nametables
        } else if (address >= 0x3F00 && address <= 0x3FFF) { // Palette RAM
            let paletteAddr = address & 0x001F;
            // Mirroring: $3F10, $3F14, $3F18, $3F1C are mirrors of $3F00, $3F04, $3F08, $3F0C
            if (paletteAddr === 0x10 || paletteAddr === 0x14 || paletteAddr === 0x18 || paletteAddr === 0x1C) {
                paletteAddr -= 0x10;
            }
            return this.ppu.vram[0x3F00 + paletteAddr]; // Palettes are often stored at the end of PPU VRAM or in dedicated RAM
        }
        // console.warn(`NES_ppuRead: Unhandled read at PPU address $${address.toString(16)}`);
        return 0;
    }

    ppuWrite(address, value) {
        address &= 0x3FFF;
        value &= 0xFF;

        if (address >= 0x0000 && address <= 0x1FFF) { // Pattern Tables (CHR RAM if available)
            this.cartridge.writeChr(address, value); // Cartridge handles if CHR is RAM
        } else if (address >= 0x2000 && address <= 0x3EFF) { // Nametables (VRAM)
            const mirroredAddr = this.mapNametableAddress(address);
            this.ppu.vram[mirroredAddr] = value;
        } else if (address >= 0x3F00 && address <= 0x3FFF) { // Palette RAM
            let paletteAddr = address & 0x001F;
            if (paletteAddr === 0x10 || paletteAddr === 0x14 || paletteAddr === 0x18 || paletteAddr === 0x1C) {
                paletteAddr -= 0x10;
            }
            this.ppu.vram[0x3F00 + paletteAddr] = value;
        } else {
            // console.warn(`NES_ppuWrite: Unhandled write to PPU address $${address.toString(16)} with value $${value.toString(16)}`);
        }
    }
    
    mapNametableAddress(address) {
        address &= 0x2FFF; // Work with $2000-$2FFF range
        const table = (address >> 10) & 0x3; // Which nametable (0, 1, 2, 3)
        
        // Default to mapper-controlled or NROM for now
        // NROM Mirroring (fixed for now, should be set by cartridge.mirroring)
        // 0 = Horizontal (A B / A B) -> Tables 0 and 1 are distinct, 2 is mirror of 0, 3 is mirror of 1
        // 1 = Vertical   (A A / B B) -> Tables 0 and 2 are distinct, 1 is mirror of 0, 3 is mirror of 2
        
        // This logic is simplified and assumes internal VRAM for nametables.
        // Real nametable mapping is complex and PPU VRAM might only hold 2 nametables.
        // For now, let's use a simplified mapping: map all to a base 2KB region in ppu.vram
        // e.g., ppu.vram[0x2000-0x23FF], ppu.vram[0x2400-0x27FF] etc.
        // The PPU's vram array is 16KB, but only 2KB is typically for nametables on the NES itself.
        // The cartridge can provide more, or map CIRAM ($A000 on cart) to these addresses.
        
        // Simplified for now: use first 2KB of PPU.vram for nametables,
        // and apply mirroring based on cartridge.mirroring.
        // Base address for nametables within the PPU's VRAM might be 0x2000, or could be 0x0000 if CHR RAM is used for pattern tables.
        // Let's assume ppu.vram[0x2000-0x2FFF] is the target region.
        // The PPU VRAM itself (this.ppu.vram) needs to be large enough.
        // This example assumes PPU.vram is directly used for nametables starting at its own index 0 for simplicity.
        // A more accurate model uses CIRAM (on PPU) and maps it.

        const baseAddress = address & 0x03FF; // Offset within a 1KB nametable
        if (this.cartridge.mirroring === 0) { // Horizontal
            // Table 0 (0x2000-0x23FF) -> CIRAM 0
            // Table 1 (0x2400-0x27FF) -> CIRAM 1
            // Table 2 (0x2800-0x2BFF) -> CIRAM 0 (mirror of Table 0)
            // Table 3 (0x2C00-0x2FFF) -> CIRAM 1 (mirror of Table 1)
            if (table === 0) return 0x2000 + baseAddress; // Nametable 0 in PPU VRAM
            if (table === 1) return 0x2400 + baseAddress; // Nametable 1 in PPU VRAM
            if (table === 2) return 0x2000 + baseAddress; // Mirror of Nametable 0
            if (table === 3) return 0x2400 + baseAddress; // Mirror of Nametable 1
        } else { // Vertical
            // Table 0 (0x2000-0x23FF) -> CIRAM 0
            // Table 1 (0x2400-0x27FF) -> CIRAM 0 (mirror of Table 0)
            // Table 2 (0x2800-0x2BFF) -> CIRAM 1
            // Table 3 (0x2C00-0x2FFF) -> CIRAM 1 (mirror of Table 2)
            if (table === 0) return 0x2000 + baseAddress; // Nametable 0
            if (table === 1) return 0x2000 + baseAddress; // Mirror of Nametable 0
            if (table === 2) return 0x2400 + baseAddress; // Nametable 1
            if (table === 3) return 0x2400 + baseAddress; // Mirror of Nametable 1
        }
        return address; // Fallback, should be covered by above
    }


    // --- Controller Handling ---
    setControllerButtonState(player, button, pressed) { // button is 'A', 'B', etc.
        if (player === 1) {
            if (this.controller1.buttons.hasOwnProperty(button)) {
                this.controller1.buttons[button] = pressed;
            }
        }
        // Add player 2 if needed
    }
    
    readController(controller) {
        let data = 0;
        if (controller.strobe) {
            // When strobe is high, reads return current state of 'A' button
            data = controller.buttons.A ? 1 : 0;
        } else {
            // When strobe is low, subsequent reads return button states sequentially
            switch (controller.index) {
                case 0: data = controller.buttons.A ? 1 : 0; break;
                case 1: data = controller.buttons.B ? 1 : 0; break;
                case 2: data = controller.buttons.SELECT ? 1 : 0; break;
                case 3: data = controller.buttons.START ? 1 : 0; break;
                case 4: data = controller.buttons.UP ? 1 : 0; break;
                case 5: data = controller.buttons.DOWN ? 1 : 0; break;
                case 6: data = controller.buttons.LEFT ? 1 : 0; break;
                case 7: data = controller.buttons.RIGHT ? 1 : 0; break;
                default: data = 1; // After 8 reads, it often returns 1s
            }
            controller.index++;
            if (controller.index > 23) { // Some sources say 24 reads for standard controller? Typically 8 are useful.
                 controller.index = 8; // Or clamp to 8 to just repeat the 1s
            }
        }
        // Standard NES controllers return 0 for pressed, 1 for not pressed, usually.
        // But CPU side often expects 1 for pressed.
        // The actual data read from $4016/$4017 is bit 0.
        // Let's ensure our button state (true=pressed) translates to 1.
        return data & 0x01;
    }

    // NMI, IRQ handlers (called by PPU, APU, or mappers)
    triggerNmi() {
        this.cpu.nmi(); // Assumes CPU has an nmi method
    }

    triggerIrq() {
        this.cpu.irq(); // Assumes CPU has an irq method
    }
}

// If using ES6 modules: export default NES;
// Make sure CPU, PPU, Cartridge are defined before this script if not using modules.
