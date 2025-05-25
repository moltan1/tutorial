// nes_emulator/core/cartridge.js

class Cartridge {
    constructor(nes) {
        this.nes = nes;

        this.prgRom = null; // Program ROM data
        this.chrRom = null; // Character ROM data (pattern tables)
        
        this.prgBanks = 0;  // Number of 16KB PRG ROM banks
        this.chrBanks = 0;  // Number of 8KB CHR ROM banks
        
        this.mapperId = 0;
        this.mirroring = 0; // 0 for horizontal, 1 for vertical

        this.valid = false;
        console.log("Cartridge object created.");
    }

    loadRom(romData) { // romData is an ArrayBuffer
        const romBytes = new Uint8Array(romData);

        // Check for iNES header (NES<EOF>)
        if (romBytes[0] !== 0x4E || romBytes[1] !== 0x45 || romBytes[2] !== 0x53 || romBytes[3] !== 0x1A) {
            console.error("Invalid iNES header.");
            this.valid = false;
            return false;
        }
        console.log("iNES header found.");

        this.prgBanks = romBytes[4];
        this.chrBanks = romBytes[5];
        
        const flags6 = romBytes[6];
        const flags7 = romBytes[7];
        // const flags8 = romBytes[8]; // PRG RAM size
        // const flags9 = romBytes[9]; // TV system
        // const flags10 = romBytes[10]; // TV system, PRG RAM presence

        this.mapperId = (flags6 >> 4) | (flags7 & 0xF0);
        this.mirroring = (flags6 & 0x01) ? 1 : 0; // 1 for Vertical, 0 for Horizontal

        console.log(`PRG ROM Banks: ${this.prgBanks} (16KB each)`);
        console.log(`CHR ROM Banks: ${this.chrBanks} (8KB each)`);
        console.log(`Mapper ID: ${this.mapperId}`);
        console.log(`Mirroring: ${this.mirroring === 1 ? "Vertical" : "Horizontal"}`);

        // For now, we only support Mapper 0 (NROM)
        if (this.mapperId !== 0) {
            console.warn(`Unsupported mapper ID: ${this.mapperId}. Only Mapper 0 (NROM) is currently supported.`);
            // this.valid = false; // Or try to load it anyway if it's simple enough
            // return false;
        }

        const hasTrainer = (flags6 & 0x04) !== 0;
        console.log(`Trainer present: ${hasTrainer}`);

        let offset = 16; // Header size
        if (hasTrainer) {
            offset += 512; // Skip trainer data
        }

        // Load PRG ROM
        const prgRomSize = this.prgBanks * 16384; // 16KB per bank
        this.prgRom = new Uint8Array(prgRomSize);
        for (let i = 0; i < prgRomSize; i++) {
            this.prgRom[i] = romBytes[offset + i];
        }
        offset += prgRomSize;
        console.log(`Loaded ${prgRomSize / 1024}KB of PRG ROM.`);

        // Load CHR ROM
        if (this.chrBanks > 0) {
            const chrRomSize = this.chrBanks * 8192; // 8KB per bank
            this.chrRom = new Uint8Array(chrRomSize);
            for (let i = 0; i < chrRomSize; i++) {
                this.chrRom[i] = romBytes[offset + i];
            }
            offset += chrRomSize;
            console.log(`Loaded ${chrRomSize / 1024}KB of CHR ROM.`);
        } else {
            // If chrBanks is 0, it means CHR RAM is used (usually 8KB)
            // For Mapper 0, this often means the game uses CHR RAM provided on the PPU board.
            // The PPU will need to handle this (e.g. its VRAM might contain pattern tables).
            this.chrRom = new Uint8Array(8192); // Allocate CHR RAM
            console.log("CHR ROM Banks is 0. Assuming 8KB CHR RAM (to be managed by PPU/Mapper).");
        }
        
        this.valid = true;
        console.log("ROM loaded successfully (or at least parsed).");
        return true;
    }

    // Read/Write methods for CPU access to PRG ROM
    // These will be simple for NROM (Mapper 0)
    // For other mappers, these methods will be more complex.

    // CPU memory map for cartridge space: $8000-$FFFF (PRG ROM)
    // For NROM (Mapper 0):
    // - If 1 PRG bank (16KB), it's mirrored at $8000-$BFFF and $C000-$FFFF.
    // - If 2 PRG banks (32KB), $8000-$BFFF is bank 0, $C000-$FFFF is bank 1.
    //   (Actually, it's usually the full 32KB mapped from $8000-$FFFF)
    readPrg(address) {
        if (!this.valid || !this.prgRom) return 0;

        if (address >= 0x8000 && address <= 0xFFFF) {
            let mappedAddr = address - 0x8000;
            if (this.prgBanks === 1) { // 16KB PRG ROM (mirrored)
                return this.prgRom[mappedAddr % 0x4000];
            } else { // 32KB PRG ROM (or more, but NROM typically max 32KB)
                return this.prgRom[mappedAddr];
            }
        }
        return 0; // Should not happen if memory map is correct
    }

    writePrg(address, value) {
        // Generally, PRG ROM is not writable. Some mappers use writes for bank switching.
        // For NROM (Mapper 0), writes to this area typically do nothing.
        // console.log(`Attempt to write to PRG ROM address ${address.toString(16)} (ignored for NROM)`);
    }

    // Read/Write methods for PPU access to CHR ROM/RAM
    // PPU memory map for pattern tables: $0000-$1FFF
    readChr(address) {
        if (!this.valid || !this.chrRom) return 0;
        
        if (address >= 0x0000 && address <= 0x1FFF) {
            return this.chrRom[address];
        }
        return 0;
    }

    writeChr(address, value) {
        if (!this.valid || !this.chrRom) return;

        // CHR ROM is not writable. If CHR RAM is used (chrBanks === 0), it is writable.
        if (this.chrBanks === 0) { // CHR RAM
            if (address >= 0x0000 && address <= 0x1FFF) {
                this.chrRom[address] = value;
            }
        } else {
            // console.warn(`Attempt to write to CHR ROM address ${address.toString(16)} (ignored)`);
        }
    }
}

// If using ES6 modules: export default Cartridge;
