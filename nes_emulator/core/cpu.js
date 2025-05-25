// nes_emulator/core/cpu.js

class CPU {
    constructor(nes) {
        this.nes = nes; // Reference to the main NES object for memory access, etc.

        // Registers
        this.a = 0;      // Accumulator
        this.x = 0;      // X Index Register
        this.y = 0;      // Y Index Register
        this.pc = 0;     // Program Counter
        this.sp = 0xfd;  // Stack Pointer (typically initialized to $FD)
        
        // Status Register (P)
        // N V _ B D I Z C
        // 7 6 5 4 3 2 1 0
        this.status = {
            carry: false,       // C
            zero: false,        // Z
            interrupt: true,    // I (IRQ disable)
            decimal: false,     // D (Not used in NES)
            break: false,       // B
            unused: true,       // Always 1
            overflow: false,    // V
            negative: false     // N
        };

        // Memory (placeholder - CPU will typically access memory via the NES bus)
        // For now, a simple 64KB array for direct access simulation if needed.
        // In a real setup, memory access goes through a bus connected to RAM, PPU, APU, Cartridge.
        this.memory = new Uint8Array(0x10000); // 64KB RAM

        console.log("CPU initialized");
    }

    // Convert status flags object to a single byte
    getStatusByte() {
        let byte = 0;
        if (this.status.carry) byte |= 0x01;
        if (this.status.zero) byte |= 0x02;
        if (this.status.interrupt) byte |= 0x04;
        if (this.status.decimal) byte |= 0x08;
        if (this.status.break) byte |= 0x10;
        if (this.status.unused) byte |= 0x20; // Unused flag, always set
        if (this.status.overflow) byte |= 0x40;
        if (this.status.negative) byte |= 0x80;
        return byte;
    }

    // Set status flags from a byte
    setStatusByte(byte) {
        this.status.carry = (byte & 0x01) !== 0;
        this.status.zero = (byte & 0x02) !== 0;
        this.status.interrupt = (byte & 0x04) !== 0;
        this.status.decimal = (byte & 0x08) !== 0;
        this.status.break = (byte & 0x10) !== 0;
        this.status.unused = (byte & 0x20) !== 0;
        this.status.overflow = (byte & 0x40) !== 0;
        this.status.negative = (byte & 0x80) !== 0;
    }

    reset() {
        this.a = 0;
        this.x = 0;
        this.y = 0;
        this.sp = 0xfd; 
        this.status.interrupt = true; // IRQs disabled on reset
        this.status.decimal = false;
        this.status.break = false; 
        // this.status.unused should remain true.
        // N, V, Z flags are affected by operations, usually cleared or set by reset sequence.
        // For simplicity, we can clear them, though hardware behavior can be more nuanced.
        this.status.negative = false;
        this.status.overflow = false;
        this.status.zero = false; // Often set by initial values or test
        this.status.carry = false;


        // Typically, PC is loaded from the reset vector ($FFFC-$FFFD)
        // this.pc = this.read16(0xFFFC); 
        // For now, let's set a placeholder if read16 isn't fully implemented yet.
        this.pc = 0x8000; // Common starting point for NROM games, placeholder
        console.log("CPU reset. PC set to placeholder 0x8000");
    }

    // Placeholder for memory read/write methods (will go through bus)
    read(address) {
        // In a real emulator, this would go through a bus to access RAM, PPU regs, APU regs, cart, etc.
        // return this.nes.bus.read(address);
        if (address >= 0x0000 && address < 0x2000) { // Internal RAM mirror
            return this.memory[address % 0x0800];
        }
        // Add more memory map regions here (PPU, APU, Cartridge)
        console.warn(`CPU read from unmapped address: ${address.toString(16)}`);
        return 0; // Or throw error
    }

    write(address, value) {
        // In a real emulator, this would go through a bus
        // this.nes.bus.write(address, value);
         if (address >= 0x0000 && address < 0x2000) { // Internal RAM mirror
            this.memory[address % 0x0800] = value;
            return;
        }
        // Add more memory map regions here
        console.warn(`CPU write to unmapped address: ${address.toString(16)} with value ${value.toString(16)}`);
    }
    
    read16(address) { // Read a 16-bit value (little-endian)
        const lo = this.read(address);
        const hi = this.read(address + 1);
        return (hi << 8) | lo;
    }


    // Placeholder for instruction execution
    step() {
        // Fetch opcode
        // const opcode = this.read(this.pc);
        // this.pc++;
        // Decode and execute opcode
        // console.log(`Executing placeholder step at PC: ${this.pc.toString(16)}`);
        // For now, just a dummy cycle increment or a NOP
        return 1; // Return number of cycles taken
    }

    // Placeholder instruction implementations
    // Example: LDA Immediate
    // lda_immediate() {
    //     this.a = this.read(this.pc);
    //     this.pc++;
    //     this.status.zero = (this.a === 0);
    //     this.status.negative = (this.a & 0x80) !== 0;
    //     // cycles += 2;
    // }

    // sta_zeropage() {
    //     const addr = this.read(this.pc);
    //     this.pc++;
    //     this.write(addr, this.a);
    //     // cycles += 3;
    // }
    
    // jmp_absolute() {
    //    this.pc = this.read16(this.pc);
    //    // cycles += 3;
    // }
}

// To make it available for import in other JS files (e.g., in the browser)
// If using Node.js modules: module.exports = CPU;
// If using ES6 modules: export default CPU;
// For simple browser include, it will be available globally or on a namespace object.
