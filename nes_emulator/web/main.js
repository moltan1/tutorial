// nes_emulator/web/main.js
console.log("main.js loaded. NES Emulator web interface starting.");

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('nes-screen');
    const ctx = canvas.getContext('2d');
    const romFileInput = document.getElementById('rom-file');

    if (!canvas || !ctx || !romFileInput) {
        console.error("Required HTML elements (canvas, romFile input) not found!");
        alert("Error: Essential page elements are missing. Emulator cannot start.");
        return;
    }
    console.log("Canvas and ROM input found.");

    // Initialize NES Emulator
    let nes = null;
    try {
        nes = new NES(ctx); // Pass canvas context to NES
        console.log("NES object created.");
    } catch (error) {
        console.error("Error creating NES instance:", error);
        alert("Failed to initialize the NES emulator components. Check console for details.");
        return;
    }

    // Initial screen clear or welcome message
    ctx.fillStyle = 'rgb(10, 10, 30)'; // Darker blue
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "16px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Select a ROM file to start", canvas.width / 2, canvas.height / 2);
    console.log("Initial screen drawn on canvas.");


    // ROM Loading Logic
    romFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && nes) {
            console.log(`ROM selected: ${file.name}`);
            const reader = new FileReader();
            reader.onload = (e) => {
                const romData = e.target.result; // ArrayBuffer
                console.log(`ROM data loaded, size: ${romData.byteLength} bytes.`);
                if (nes.loadROM(romData)) {
                    console.log("ROM loaded into NES, attempting to start.");
                    nes.start(); // Start the emulation loop
                    alert(`ROM "${file.name}" loaded and emulation started (or attempted).`);
                } else {
                    console.error("Failed to load ROM in NES instance.");
                    alert(`Failed to load ROM "${file.name}". Check console.`);
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading ROM file:", e);
                alert("Error reading ROM file.");
            };
            reader.readAsArrayBuffer(file);
        }
    });

    // Controller Input Handling
    const buttons = {
        'btn-up': 'UP', 'btn-left': 'LEFT', 'btn-right': 'RIGHT', 'btn-down': 'DOWN',
        'btn-select': 'SELECT', 'btn-start': 'START', 'btn-A': 'A', 'btn-B': 'B'
    };

    const handleButtonPress = (buttonName, isPressed) => {
        if (nes && nes.controller1) { // Check if nes and controller1 are initialized
            // console.log(`Controller: ${buttonName} ${isPressed ? 'pressed' : 'released'}`);
            nes.setControllerButtonState(1, buttonName, isPressed);
        }
    };

    for (const [id, keyName] of Object.entries(buttons)) {
        const buttonElement = document.getElementById(id);
        if (buttonElement) {
            buttonElement.addEventListener('mousedown', () => handleButtonPress(keyName, true));
            buttonElement.addEventListener('mouseup', () => handleButtonPress(keyName, false));
            buttonElement.addEventListener('mouseleave', () => handleButtonPress(keyName, false)); // Release if mouse leaves button while pressed
            buttonElement.addEventListener('touchstart', (e) => { e.preventDefault(); handleButtonPress(keyName, true); });
            buttonElement.addEventListener('touchend', (e) => { e.preventDefault(); handleButtonPress(keyName, false); });
        } else {
            console.warn(`Button with ID ${id} not found.`);
        }
    }

    const keyMap = {
        'arrowup': 'UP', 'arrowdown': 'DOWN', 'arrowleft': 'LEFT', 'arrowright': 'RIGHT',
        'enter': 'START', 'shift': 'SELECT',
        'z': 'A', 'x': 'B', // Common keyboard mappings
        'a': 'A', 's': 'B'  // Alternative common keyboard mappings
    };

    document.addEventListener('keydown', (event) => {
        const keyName = keyMap[event.key.toLowerCase()] || keyMap[event.key]; // Check for both cases and original key
        if (keyName) {
            handleButtonPress(keyName, true);
            event.preventDefault();
        }
    });

    document.addEventListener('keyup', (event) => {
        const keyName = keyMap[event.key.toLowerCase()] || keyMap[event.key];
        if (keyName) {
            handleButtonPress(keyName, false);
            event.preventDefault();
        }
    });

    console.log("main.js initialization complete. NES emulator instance created. Waiting for ROM.");
    // At this point, the PPU's default framebuffer (e.g. solid blue from its step/reset)
    // should be visible if nes.start() and nes.mainLoop() are working correctly
    // and call nes.renderFrame() after PPU produces a frame.
    // The initial blank screen is now handled by nes.start() -> nes.mainLoop() -> nes.renderFrame()
    // after a ROM is loaded. Before that, a placeholder message is on canvas.
});
