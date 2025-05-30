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
        // This internal memory is for $0000-$07FF RAM, accessed via _memRead/_memWrite helpers now.
        this.memory = new Uint8Array(0x0800); // 2KB Internal RAM

        this.stallCycles = 0; // For DMA, etc.
        this.totalCycles = 0; // For tracking overall cycles for PPU sync

        // Cycle lookup table for instructions
        this.opCycles = {
            0xA9: 2, /* LDA Imm */ 0xA5: 3, /* LDA ZP */  0xB5: 4, /* LDA ZPX */
            0xAD: 4, /* LDA Abs */ 0xBD: 4, /* LDA AbsX */0xB9: 4, /* LDA AbsY */
            0xA1: 6, /* LDA IndX */0xB1: 5, /* LDA IndY */
            0x85: 3, /* STA ZP */  0x95: 4, /* STA ZPX */ 0x8D: 4, /* STA Abs */
            0x9D: 5, /* STA AbsX */0x99: 5, /* STA AbsY */0x81: 6, /* STA IndX */
            0x91: 6, /* STA IndY */
            0xA2: 2, /* LDX Imm */ 0xA6: 3, /* LDX ZP */  0xB6: 4, /* LDX ZPY */
            0xAE: 4, /* LDX Abs */ 0xBE: 4, /* LDX AbsY */
            0xA0: 2, /* LDY Imm */ 0xA4: 3, /* LDY ZP */  0xB4: 4, /* LDY ZPX */
            0xAC: 4, /* LDY Abs */ 0xBC: 4, /* LDY AbsX */
            0x86: 3, /* STX ZP */  0x96: 4, /* STX ZPY */ 0x8E: 4, /* STX Abs */
            0x84: 3, /* STY ZP */  0x94: 4, /* STY ZPX */ 0x8C: 4, /* STY Abs */
            0xAA: 2, /* TAX */ 0xA8: 2, /* TAY */ 0x8A: 2, /* TXA */ 0x98: 2, /* TYA */
            0xBA: 2, /* TSX */ 0x9A: 2, /* TXS */
            0x48: 3, /* PHA */ 0x68: 4, /* PLA */ 0x08: 3, /* PHP */ 0x28: 4, /* PLP */
            // ADC
            0x69: 2, /* ADC Imm */ 0x65: 3, /* ADC ZP */  0x75: 4, /* ADC ZPX */
            0x6D: 4, /* ADC Abs */ 0x7D: 4, /* ADC AbsX */0x79: 4, /* ADC AbsY */
            0x61: 6, /* ADC IndX */0x71: 5, /* ADC IndY */
            // SBC
            0xE9: 2, /* SBC Imm */ 0xE5: 3, /* SBC ZP */  0xF5: 4, /* SBC ZPX */
            0xED: 4, /* SBC Abs */ 0xFD: 4, /* SBC AbsX */0xF9: 4, /* SBC AbsY */
            0xE1: 6, /* SBC IndX */0xF1: 5, /* SBC IndY */
            // AND
            0x29: 2, /* AND Imm */ 0x25: 3, /* AND ZP */  0x35: 4, /* AND ZPX */
            0x2D: 4, /* AND Abs */ 0x3D: 4, /* AND AbsX */0x39: 4, /* AND AbsY */
            0x21: 6, /* AND IndX */0x31: 5, /* AND IndY */
            // EOR
            0x49: 2, /* EOR Imm */ 0x45: 3, /* EOR ZP */  0x55: 4, /* EOR ZPX */
            0x4D: 4, /* EOR Abs */ 0x5D: 4, /* EOR AbsX */0x59: 4, /* EOR AbsY */
            0x41: 6, /* EOR IndX */0x51: 5, /* EOR IndY */
            // ORA
            0x09: 2, /* ORA Imm */ 0x05: 3, /* ORA ZP */  0x15: 4, /* ORA ZPX */
            0x0D: 4, /* ORA Abs */ 0x1D: 4, /* ORA AbsX */0x19: 4, /* ORA AbsY */
            0x01: 6, /* ORA IndX */0x11: 5, /* ORA IndY */
            // CMP
            0xC9: 2, /* CMP Imm */ 0xC5: 3, /* CMP ZP */  0xD5: 4, /* CMP ZPX */
            0xCD: 4, /* CMP Abs */ 0xDD: 4, /* CMP AbsX */0xD9: 4, /* CMP AbsY */
            0xC1: 6, /* CMP IndX */0xD1: 5, /* CMP IndY */
            // CPX
            0xE0: 2, /* CPX Imm */ 0xE4: 3, /* CPX ZP */ 0xEC: 4, /* CPX Abs */
            // CPY
            0xC0: 2, /* CPY Imm */ 0xC4: 3, /* CPY ZP */ 0xCC: 4, /* CPY Abs */
            // INC
            0xE6: 5, /* INC ZP */ 0xF6: 6, /* INC ZPX */ 0xEE: 6, /* INC Abs */ 0xFE: 7, /* INC AbsX */
            // DEC
            0xC6: 5, /* DEC ZP */ 0xD6: 6, /* DEC ZPX */ 0xCE: 6, /* DEC Abs */ 0xDE: 7, /* DEC AbsX */
            // Register Inc/Dec
            0xE8: 2, /* INX */ 0xC8: 2, /* INY */ 0xCA: 2, /* DEX */ 0x88: 2, /* DEY */
            // ASL
            0x0A: 2, /* ASL A */ 0x06: 5, /* ASL ZP */ 0x16: 6, /* ASL ZPX */ 0x0E: 6, /* ASL Abs */ 0x1E: 7, /* ASL AbsX */
            // LSR
            0x4A: 2, /* LSR A */ 0x46: 5, /* LSR ZP */ 0x56: 6, /* LSR ZPX */ 0x4E: 6, /* LSR Abs */ 0x5E: 7, /* LSR AbsX */
            // ROL
            0x2A: 2, /* ROL A */ 0x26: 5, /* ROL ZP */ 0x36: 6, /* ROL ZPX */ 0x2E: 6, /* ROL Abs */ 0x3E: 7, /* ROL AbsX */
            // ROR
            0x6A: 2, /* ROR A */ 0x66: 5, /* ROR ZP */ 0x76: 6, /* ROR ZPX */ 0x6E: 6, /* ROR Abs */ 0x7E: 7, /* ROR AbsX */
            // Branches (base cycles, step() adds more for taken/pagecross)
            0x10: 2, /* BPL */ 0x30: 2, /* BMI */ 0x50: 2, /* BVC */ 0x70: 2, /* BVS */
            0x90: 2, /* BCC */ 0xB0: 2, /* BCS */ 0xD0: 2, /* BNE */ 0xF0: 2, /* BEQ */
            // Jumps
            0x4C: 3, /* JMP Abs */ 0x6C: 5, /* JMP Ind */
            // Subroutines
            0x20: 6, /* JSR Abs */ 0x60: 6, /* RTS */
            // Interrupt
            0x00: 7, /* BRK */ 0x40: 6, /* RTI */
            // Bit Test
            0x24: 3, /* BIT ZP */ 0x2C: 4, /* BIT Abs */
            // Flags
            0x18: 2, /* CLC */ 0x38: 2, /* SEC */ 0x58: 2, /* CLI */ 0x78: 2, /* SEI */
            0xB8: 2, /* CLV */ 0xD8: 2, /* CLD */ 0xF8: 2, /* SED */
            0xEA: 2, /* NOP */
        };

        console.log("CPU initialized with new instruction implementations.");
    }

    // Convert status flags object to a single byte
    getStatusByte() {
        let byte = 0;
        if (this.status.carry) byte |= 0x01;
        if (this.status.zero) byte |= 0x02;
        if (this.status.interrupt) byte |= 0x04;
        if (this.status.decimal) byte |= 0x08;
        if (this.status.break) byte |= 0x10;
        if (this.status.unused) byte |= 0x20;
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
        // B flag (bit 4) is not set from stack for PLP/RTI; it's handled by context.
        // this.status.break = (byte & 0x10) !== 0; // Not directly set like this from PLP/RTI
        this.status.unused = true;
        this.status.overflow = (byte & 0x40) !== 0;
        this.status.negative = (byte & 0x80) !== 0;
    }

    reset() {
        this.a = 0;
        this.x = 0;
        this.y = 0;
        this.sp = 0xfd;
        this.status.interrupt = true;
        this.status.decimal = false;
        this.status.break = false;
        this.status.unused = true;
        this.status.negative = false;
        this.status.overflow = false;
        this.status.zero = false;
        this.status.carry = false;

        this.stallCycles = 0;
        this.totalCycles = 0; // Reset total cycles as well
        this.pc = 0;
        console.log("CPU reset. PC will be set by NES from reset vector.");
    }

    // --- Memory Access Helpers (using NES bus) ---
    _memRead(address) {
        return this.nes.cpuRead(address);
    }

    _memRead16(address) {
        const lo = this._memRead(address);
        const hi = this._memRead(address + 1);
        return (hi << 8) | lo;
    }

    _memRead16_zp_bug(address) {
        const lo = this._memRead(address & 0xFF);
        const hi = this._memRead((address + 1) & 0xFF);
        return (hi << 8) | lo;
    }

    _memWrite(address, value) {
        this.nes.cpuWrite(address, value);
    }

    // --- Addressing Modes ---
    addr_immediate() {
        const addr = this.pc;
        this.pc = (this.pc + 1) & 0xFFFF;
        return addr;
    }

    addr_zero_page() {
        const addr = this._memRead(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        return addr;
    }

    addr_zero_page_x() {
        const baseAddr = this._memRead(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        return (baseAddr + this.x) & 0xFF;
    }

    addr_zero_page_y() {
        const baseAddr = this._memRead(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        return (baseAddr + this.y) & 0xFF;
    }

    addr_absolute() {
        const addr = this._memRead16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        return addr;
    }

    addr_absolute_x() {
        const baseAddr = this._memRead16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        return (baseAddr + this.x) & 0xFFFF;
    }

    addr_absolute_y() {
        const baseAddr = this._memRead16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        return (baseAddr + this.y) & 0xFFFF;
    }

    addr_indirect_x() {
        const zeroPageAddr = (this._memRead(this.pc) + this.x) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        return this._memRead16_zp_bug(zeroPageAddr);
    }

    addr_indirect_y() {
        const zeroPageAddr = this._memRead(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        const baseAddr = this._memRead16_zp_bug(zeroPageAddr);
        return (baseAddr + this.y) & 0xFFFF;
    }

    // --- Stack Operations ---
    pushStack(value) {
        this._memWrite(0x0100 + this.sp, value & 0xFF);
        this.sp = (this.sp - 1) & 0xFF;
    }

    popStack() {
        this.sp = (this.sp + 1) & 0xFF;
        return this._memRead(0x0100 + this.sp);
    }

    // --- Status Flag Update ---
    _updateZeroNegativeFlags(value) {
        this.status.zero = (value === 0);
        this.status.negative = (value & 0x80) !== 0;
    }

    // --- Instruction Implementations ---
    _lda(address) {
        this.a = this._memRead(address);
        this._updateZeroNegativeFlags(this.a);
    }

    _ldx(address) {
        this.x = this._memRead(address);
        this._updateZeroNegativeFlags(this.x);
    }

    _ldy(address) {
        this.y = this._memRead(address);
        this._updateZeroNegativeFlags(this.y);
    }

    _sta(address) {
        this._memWrite(address, this.a);
    }

    _stx(address) {
        this._memWrite(address, this.x);
    }

    _sty(address) {
        this._memWrite(address, this.y);
    }

    _tax() { this.x = this.a; this._updateZeroNegativeFlags(this.x); }
    _tay() { this.y = this.a; this._updateZeroNegativeFlags(this.y); }
    _txa() { this.a = this.x; this._updateZeroNegativeFlags(this.a); }
    _tya() { this.a = this.y; this._updateZeroNegativeFlags(this.a); }

    _tsx() { this.x = this.sp; this._updateZeroNegativeFlags(this.x); }
    _txs() { this.sp = this.x; }

    _pha() { this.pushStack(this.a); }
    _pla() { this.a = this.popStack(); this._updateZeroNegativeFlags(this.a); }

    _php() {
        this.pushStack(this.getStatusByte() | 0x30); // Set B (0x10) and Unused (0x20)
    }
    _plp() {
        const newStatus = this.popStack();
        // B flag (bit 4) is ignored from stack, Unused (bit 5) is always set.
        // Current this.status.break is preserved.
        this.setStatusByte((newStatus & ~0x10 & ~0x20) | (this.status.break ? 0x10 : 0) | 0x20);
    }

    // --- Arithmetic Instructions ---
    _adc(address) {
        const operand = this._memRead(address);
        const temp = this.a + operand + (this.status.carry ? 1 : 0);
        this.status.overflow = ((this.a ^ temp) & (operand ^ temp) & 0x80) !== 0;
        this.status.carry = temp > 0xFF;
        this.a = temp & 0xFF;
        this._updateZeroNegativeFlags(this.a);
    }

    _sbc(address) {
        const operand = this._memRead(address) ^ 0xFF;
        const temp = this.a + operand + (this.status.carry ? 1 : 0);
        this.status.overflow = ((this.a ^ temp) & (operand ^ temp) & 0x80) !== 0;
        this.status.carry = temp > 0xFF;
        this.a = temp & 0xFF;
        this._updateZeroNegativeFlags(this.a);
    }

    // --- Logical Instructions ---
    _and(address) {
        this.a &= this._memRead(address);
        this._updateZeroNegativeFlags(this.a);
    }

    _eor(address) {
        this.a ^= this._memRead(address);
        this._updateZeroNegativeFlags(this.a);
    }

    _ora(address) {
        this.a |= this._memRead(address);
        this._updateZeroNegativeFlags(this.a);
    }

    // --- Compare Instructions ---
    _compare(reg_val, mem_val) {
        const temp = reg_val - mem_val;
        this.status.carry = (reg_val >= mem_val);
        this.status.zero = (temp & 0xFF) === 0;
        this.status.negative = (temp & 0x80) !== 0;
    }

    _cmp(address) {
        const operand = this._memRead(address);
        this._compare(this.a, operand);
    }

    _cpx(address) {
        const operand = this._memRead(address);
        this._compare(this.x, operand);
    }

    _cpy(address) {
        const operand = this._memRead(address);
        this._compare(this.y, operand);
    }

    // --- Increment/Decrement Instructions ---
    _inc(address) {
        let value = (this._memRead(address) + 1) & 0xFF;
        this._memWrite(address, value);
        this._updateZeroNegativeFlags(value);
    }

    _dec(address) {
        let value = (this._memRead(address) - 1) & 0xFF;
        this._memWrite(address, value);
        this._updateZeroNegativeFlags(value);
    }

    _inx() { this.x = (this.x + 1) & 0xFF; this._updateZeroNegativeFlags(this.x); }
    _iny() { this.y = (this.y + 1) & 0xFF; this._updateZeroNegativeFlags(this.y); }
    _dex() { this.x = (this.x - 1) & 0xFF; this._updateZeroNegativeFlags(this.x); }
    _dey() { this.y = (this.y - 1) & 0xFF; this._updateZeroNegativeFlags(this.y); }

    // --- Shift and Rotate Instructions ---
    _asl(address, isAccumulatorMode = false) {
        let value;
        if (isAccumulatorMode) {
            value = this.a;
        } else {
            value = this._memRead(address);
        }
        this.status.carry = (value & 0x80) !== 0;
        value = (value << 1) & 0xFF;
        if (isAccumulatorMode) {
            this.a = value;
        } else {
            this._memWrite(address, value);
        }
        this._updateZeroNegativeFlags(value);
    }

    _lsr(address, isAccumulatorMode = false) {
        let value;
        if (isAccumulatorMode) {
            value = this.a;
        } else {
            value = this._memRead(address);
        }
        this.status.carry = (value & 0x01) !== 0;
        value >>= 1;
        if (isAccumulatorMode) {
            this.a = value;
        } else {
            this._memWrite(address, value);
        }
        this._updateZeroNegativeFlags(value);
    }

    _rol(address, isAccumulatorMode = false) {
        let value;
        if (isAccumulatorMode) {
            value = this.a;
        } else {
            value = this._memRead(address);
        }
        const oldCarry = this.status.carry ? 1 : 0;
        this.status.carry = (value & 0x80) !== 0;
        value = ((value << 1) | oldCarry) & 0xFF;
        if (isAccumulatorMode) {
            this.a = value;
        } else {
            this._memWrite(address, value);
        }
        this._updateZeroNegativeFlags(value);
    }

    _ror(address, isAccumulatorMode = false) {
        let value;
        if (isAccumulatorMode) {
            value = this.a;
        } else {
            value = this._memRead(address);
        }
        const oldCarry = this.status.carry ? 1 : 0;
        this.status.carry = (value & 0x01) !== 0;
        value = (value >> 1) | (oldCarry << 7);
        if (isAccumulatorMode) {
            this.a = value;
        } else {
            this._memWrite(address, value);
        }
        this._updateZeroNegativeFlags(value);
    }

    // --- Branch Instructions ---
    _branch(condition) {
        const offset = this._memRead(this.addr_immediate());
        let cyclesAdded = 0;
        if (condition) {
            cyclesAdded++;
            const oldPC = this.pc;
            if (offset & 0x80) {
                this.pc -= (0x100 - offset);
            } else {
                this.pc += offset;
            }
            this.pc &= 0xFFFF;
            if ((oldPC & 0xFF00) !== (this.pc & 0xFF00)) {
                cyclesAdded++;
            }
        }
        return cyclesAdded;
    }

    // --- Jump and Subroutine Instructions ---
    _jmp_absolute() {
        this.pc = this.addr_absolute();
    }

    _jmp_indirect() {
        const indirectAddr = this.addr_absolute();
        if ((indirectAddr & 0x00FF) === 0x00FF) {
            const lo = this._memRead(indirectAddr);
            const hi = this._memRead(indirectAddr & 0xFF00);
            this.pc = (hi << 8) | lo;
        } else {
            this.pc = this._memRead16(indirectAddr);
        }
    }

    _jsr() {
        const targetAddr = this.addr_absolute();
        this.pushStack((this.pc - 1 >> 8) & 0xFF);
        this.pushStack((this.pc - 1) & 0xFF);
        this.pc = targetAddr;
    }

    _rts() {
        const pcl = this.popStack();
        const pch = this.popStack();
        this.pc = ((pch << 8) | pcl) + 1;
        this.pc &= 0xFFFF;
    }

    _rti() {
        const newStatusByte = this.popStack();
        // B flag (bit 4) is not set from stack. Current B flag is kept. Unused (bit 5) is always set true.
        this.setStatusByte((newStatusByte & ~0x10 & ~0x20) | (this.status.break ? 0x10 : 0) | 0x20);

        const pcl = this.popStack();
        const pch = this.popStack();
        this.pc = (pch << 8) | pcl;
        this.pc &= 0xFFFF;
    }

    // --- Bit Test ---
    _bit(address) {
        const value = this._memRead(address);
        this.status.zero = (this.a & value) === 0;
        this.status.negative = (value & 0x80) !== 0;
        this.status.overflow = (value & 0x40) !== 0;
    }

    // --- Flag Instructions ---
    _clc() { this.status.carry = false; }
    _sec() { this.status.carry = true; }
    _cli() { this.status.interrupt = false; }
    _sei() { this.status.interrupt = true; }
    _clv() { this.status.overflow = false; }
    _cld() { this.status.decimal = false; }
    _sed() { this.status.decimal = true; }

    // --- No Operation ---
    _nop() { /* Does nothing */ }

    // NMI, IRQ, and general interrupt handling
    _interrupt(vectorAddress, isBreakInstruction) {
        // BRK instruction increments PC before pushing, so PC is already pointing at the byte after BRK's operand (if any).
        // For NMI/IRQ, PC is pointing at the next instruction to be executed.
        // The PC pushed to stack should be the address of the *next* instruction for NMI/IRQ,
        // or PC+1 for BRK (because BRK's PC was already advanced by 1 in step(), then _interrupt is called)
        // The current PC value is already correct for NMI/IRQ.
        // For BRK, the step method handles the initial PC increment.

        this.pushStack((this.pc >> 8) & 0xFF);
        this.pushStack(this.pc & 0xFF);

        let statusToPush = this.getStatusByte();
        if (isBreakInstruction) {
            statusToPush |= 0x10; // Set B flag for BRK
        } else {
            statusToPush &= ~0x10; // Clear B flag for NMI/IRQ
        }
        statusToPush |= 0x20; // Ensure Unused flag is set
        this.pushStack(statusToPush);

        this.status.interrupt = true;
        this.pc = this._memRead16(vectorAddress);
    }

    nmi() {
        console.log("NMI triggered");
        this._interrupt(0xFFFA, false);
        // Cycle count for NMI (7) should be handled by the main loop or by returning from here.
        // For now, NES.js mainLoop adds cycles for CPU steps. NMI is outside that.
    }

    irq() {
        if (!this.status.interrupt) {
            console.log("IRQ triggered");
            this._interrupt(0xFFFE, false);
            // Cycle count for IRQ (7) also handled outside typical step.
        }
    }

    // --- CPU Step ---
    step() {
        if (this.stallCycles > 0) {
            this.stallCycles--;
            this.totalCycles++; // Stall still counts as a cycle from CPU's perspective for timing
            return 1; // Return 1 cycle for the stall
        }

        if (this.nes === undefined || this.nes.cartridge === undefined || !this.nes.cartridge.valid) {
            // This case should ideally not happen if ROM is loaded and NES is running.
            // If it does, it indicates a problem elsewhere or an attempt to run without a ROM.
            console.warn("CPU step called without valid NES/Cartridge context.");
            return 1; // Minimal cycle count to prevent infinite loops if called incorrectly
        }

        const currentPC = this.pc;
        const opcode = this._memRead(this.pc);
        // PC is incremented by addressing mode functions now, or by BRK itself.
        // So, don't increment PC here, except for BRK that needs special handling.
        // For BRK (0x00), it's 1 byte, but effectively acts like 2 for PC push.
        if (opcode !== 0x00) { // All instructions except BRK will have PC advanced by addr_mode or here
            this.pc = (this.pc + 1) & 0xFFFF;
        }

        let cycles = this.opCycles[opcode] || 2; // Default cycles for unknown/NOP
        let addr;
        let pageCrossCycles = 0;

        const checkPageCross = (baseAddr, finalAddr) => {
            if ((baseAddr & 0xFF00) !== (finalAddr & 0xFF00)) {
                pageCrossCycles = 1;
            }
        };

        switch (opcode) {
            // BRK
            case 0x00:
                // PC is currently PC_of_BRK_opcode.
                // For BRK, PC_of_BRK_opcode + 2 should be pushed onto the stack.
                // The _interrupt function pushes the current value of this.pc.
                // So, set this.pc to PC_of_BRK_opcode + 2 before calling _interrupt.
                // The base cycle count for BRK (7) in opCycles accounts for the whole operation.
                // Note: The initial PC increment at the top of step() is skipped for BRK.
                this.pc = (this.pc + 2) & 0xFFFF;
                this._interrupt(0xFFFE, true); // true for isBreakInstruction
                break;

            // LDA
            case 0xA9: this._lda(this.addr_immediate()); break;
            case 0xA5: this._lda(this.addr_zero_page()); break;
            case 0xB5: this._lda(this.addr_zero_page_x()); break;
            case 0xAD: this._lda(this.addr_absolute()); break;
            case 0xBD: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._lda(addr); break;
            case 0xB9: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._lda(addr); break;
            case 0xA1: this._lda(this.addr_indirect_x()); break;
            case 0xB1: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._lda(addr); break;

            // LDX
            case 0xA2: this._ldx(this.addr_immediate()); break;
            case 0xA6: this._ldx(this.addr_zero_page()); break;
            case 0xB6: this._ldx(this.addr_zero_page_y()); break;
            case 0xAE: this._ldx(this.addr_absolute()); break;
            case 0xBE: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._ldx(addr); break;

            // LDY
            case 0xA0: this._ldy(this.addr_immediate()); break;
            case 0xA4: this._ldy(this.addr_zero_page()); break;
            case 0xB4: this._ldy(this.addr_zero_page_x()); break;
            case 0xAC: this._ldy(this.addr_absolute()); break;
            case 0xBC: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._ldy(addr); break;

            // STA
            case 0x85: this._sta(this.addr_zero_page()); break;
            case 0x95: this._sta(this.addr_zero_page_x()); break;
            case 0x8D: this._sta(this.addr_absolute()); break;
            case 0x9D: this._sta(this.addr_absolute_x()); break;
            case 0x99: this._sta(this.addr_absolute_y()); break;
            case 0x81: this._sta(this.addr_indirect_x()); break;
            case 0x91: this._sta(this.addr_indirect_y()); break;

            // STX
            case 0x86: this._stx(this.addr_zero_page()); break;
            case 0x96: this._stx(this.addr_zero_page_y()); break;
            case 0x8E: this._stx(this.addr_absolute()); break;

            // STY
            case 0x84: this._sty(this.addr_zero_page()); break;
            case 0x94: this._sty(this.addr_zero_page_x()); break;
            case 0x8C: this._sty(this.addr_absolute()); break;

            // Transfer Instructions
            case 0xAA: this._tax(); break;
            case 0xA8: this._tay(); break;
            case 0x8A: this._txa(); break;
            case 0x98: this._tya(); break;
            case 0xBA: this._tsx(); break;
            case 0x9A: this._txs(); break;

            // Stack Instructions
            case 0x48: this._pha(); break;
            case 0x68: this._pla(); break;
            case 0x08: this._php(); break;
            case 0x28: this._plp(); break;

            // ADC
            case 0x69: this._adc(this.addr_immediate()); break;
            case 0x65: this._adc(this.addr_zero_page()); break;
            case 0x75: this._adc(this.addr_zero_page_x()); break;
            case 0x6D: this._adc(this.addr_absolute()); break;
            case 0x7D: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._adc(addr); break;
            case 0x79: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._adc(addr); break;
            case 0x61: this._adc(this.addr_indirect_x()); break;
            case 0x71: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._adc(addr); break;

            // SBC
            case 0xE9: this._sbc(this.addr_immediate()); break;
            case 0xE5: this._sbc(this.addr_zero_page()); break;
            case 0xF5: this._sbc(this.addr_zero_page_x()); break;
            case 0xED: this._sbc(this.addr_absolute()); break;
            case 0xFD: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._sbc(addr); break;
            case 0xF9: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._sbc(addr); break;
            case 0xE1: this._sbc(this.addr_indirect_x()); break;
            case 0xF1: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._sbc(addr); break;

            // AND
            case 0x29: this._and(this.addr_immediate()); break;
            case 0x25: this._and(this.addr_zero_page()); break;
            case 0x35: this._and(this.addr_zero_page_x()); break;
            case 0x2D: this._and(this.addr_absolute()); break;
            case 0x3D: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._and(addr); break;
            case 0x39: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._and(addr); break;
            case 0x21: this._and(this.addr_indirect_x()); break;
            case 0x31: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._and(addr); break;

            // EOR
            case 0x49: this._eor(this.addr_immediate()); break;
            case 0x45: this._eor(this.addr_zero_page()); break;
            case 0x55: this._eor(this.addr_zero_page_x()); break;
            case 0x4D: this._eor(this.addr_absolute()); break;
            case 0x5D: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._eor(addr); break;
            case 0x59: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._eor(addr); break;
            case 0x41: this._eor(this.addr_indirect_x()); break;
            case 0x51: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._eor(addr); break;

            // ORA
            case 0x09: this._ora(this.addr_immediate()); break;
            case 0x05: this._ora(this.addr_zero_page()); break;
            case 0x15: this._ora(this.addr_zero_page_x()); break;
            case 0x0D: this._ora(this.addr_absolute()); break;
            case 0x1D: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._ora(addr); break;
            case 0x19: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._ora(addr); break;
            case 0x01: this._ora(this.addr_indirect_x()); break;
            case 0x11: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._ora(addr); break;

            // CMP
            case 0xC9: this._cmp(this.addr_immediate()); break;
            case 0xC5: this._cmp(this.addr_zero_page()); break;
            case 0xD5: this._cmp(this.addr_zero_page_x()); break;
            case 0xCD: this._cmp(this.addr_absolute()); break;
            case 0xDD: addr = this.addr_absolute_x(); checkPageCross(addr - this.x, addr); this._cmp(addr); break;
            case 0xD9: addr = this.addr_absolute_y(); checkPageCross(addr - this.y, addr); this._cmp(addr); break;
            case 0xC1: this._cmp(this.addr_indirect_x()); break;
            case 0xD1: addr = this.addr_indirect_y(); checkPageCross(addr - this.y, addr); this._cmp(addr); break;

            // CPX
            case 0xE0: this._cpx(this.addr_immediate()); break;
            case 0xE4: this._cpx(this.addr_zero_page()); break;
            case 0xEC: this._cpx(this.addr_absolute()); break;

            // CPY
            case 0xC0: this._cpy(this.addr_immediate()); break;
            case 0xC4: this._cpy(this.addr_zero_page()); break;
            case 0xCC: this._cpy(this.addr_absolute()); break;

            // INC
            case 0xE6: this._inc(this.addr_zero_page()); break;
            case 0xF6: this._inc(this.addr_zero_page_x()); break;
            case 0xEE: this._inc(this.addr_absolute()); break;
            case 0xFE: this._inc(this.addr_absolute_x()); break;

            // DEC
            case 0xC6: this._dec(this.addr_zero_page()); break;
            case 0xD6: this._dec(this.addr_zero_page_x()); break;
            case 0xCE: this._dec(this.addr_absolute()); break;
            case 0xDE: this._dec(this.addr_absolute_x()); break;

            // Register Inc/Dec
            case 0xE8: this._inx(); break;
            case 0xC8: this._iny(); break;
            case 0xCA: this._dex(); break;
            case 0x88: this._dey(); break;

            // ASL
            case 0x0A: this._asl(null, true); break;
            case 0x06: this._asl(this.addr_zero_page()); break;
            case 0x16: this._asl(this.addr_zero_page_x()); break;
            case 0x0E: this._asl(this.addr_absolute()); break;
            case 0x1E: this._asl(this.addr_absolute_x()); break;

            // LSR
            case 0x4A: this._lsr(null, true); break;
            case 0x46: this._lsr(this.addr_zero_page()); break;
            case 0x56: this._lsr(this.addr_zero_page_x()); break;
            case 0x4E: this._lsr(this.addr_absolute()); break;
            case 0x5E: this._lsr(this.addr_absolute_x()); break;

            // ROL
            case 0x2A: this._rol(null, true); break;
            case 0x26: this._rol(this.addr_zero_page()); break;
            case 0x36: this._rol(this.addr_zero_page_x()); break;
            case 0x2E: this._rol(this.addr_absolute()); break;
            case 0x3E: this._rol(this.addr_absolute_x()); break;

            // ROR
            case 0x6A: this._ror(null, true); break;
            case 0x66: this._ror(this.addr_zero_page()); break;
            case 0x76: this._ror(this.addr_zero_page_x()); break;
            case 0x6E: this._ror(this.addr_absolute()); break;
            case 0x7E: this._ror(this.addr_absolute_x()); break;

            // Branch Instructions
            case 0x10: cycles += this._branch(!this.status.negative); break;
            case 0x30: cycles += this._branch(this.status.negative); break;
            case 0x50: cycles += this._branch(!this.status.overflow); break;
            case 0x70: cycles += this._branch(this.status.overflow); break;
            case 0x90: cycles += this._branch(!this.status.carry); break;
            case 0xB0: cycles += this._branch(this.status.carry); break;
            case 0xD0: cycles += this._branch(!this.status.zero); break;
            case 0xF0: cycles += this._branch(this.status.zero); break;

            // Jumps
            case 0x4C: this._jmp_absolute(); break;
            case 0x6C: this._jmp_indirect(); break;

            // Subroutines & Interrupt
            case 0x20: this._jsr(); break;
            case 0x60: this._rts(); break;
            case 0x40: this._rti(); break;

            // Bit Test
            case 0x24: this._bit(this.addr_zero_page()); break;
            case 0x2C: this._bit(this.addr_absolute()); break;

            // Flag Clears/Sets
            case 0x18: this._clc(); break;
            case 0x38: this._sec(); break;
            case 0x58: this._cli(); break;
            case 0x78: this._sei(); break;
            case 0xB8: this._clv(); break;
            case 0xD8: this._cld(); break;
            case 0xF8: this._sed(); break;

            case 0xEA: this._nop(); break;

            default:
                console.warn(`CPU: Unimplemented opcode $${opcode.toString(16)} at PC $${currentPC.toString(16)}`);
                // If PC wasn't advanced by an addressing mode or BRK, advance it here for unknown opcodes
                // to prevent infinite loop on unknown single-byte opcodes.
                // However, a robust solution would be to define all 256 opcodes, even if many are NOPs.
                // For now, the default PC increment at the start of step (if opcode != 0x00) handles this.
                break;
        }
        const totalInstructionCycles = cycles + pageCrossCycles;
        this.totalCycles += totalInstructionCycles;
        return totalInstructionCycles;
    }
}

// If using ES6 modules: export default CPU;
