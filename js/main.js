document.addEventListener('DOMContentLoaded', () => {
    const SCREEN_WIDTH = 256;
    const SCREEN_HEIGHT = 240;
    const FRAMEBUFFER_SIZE = SCREEN_WIDTH * SCREEN_HEIGHT;

    const canvas = document.getElementById('nes-screen');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // imageData.dataを32ビット整数のビューとして扱うための準備
    const buf32 = new Uint32Array(imageData.data.buffer);

    let nes;
    let animationFrameId = null;

    // メインループ
    function nes_loop() {
        if (nes) {
            nes.frame();
        }
        animationFrameId = requestAnimationFrame(nes_loop);
    }

    // エミュレータからのフレームバッファをCanvasに描画する関数
    function onFrame(frameBuffer) {
        for (let i = 0; i < FRAMEBUFFER_SIZE; i++) {
            buf32[i] = 0xFF000000 | frameBuffer[i]; // アルファ値を不透明(FF)に設定
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // ROMデータを読み込み、エミュレータを開始する関数
    function startEmulator(romData) {
        // 既に実行中の場合はリセット
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        nes = new jsnes.NES({
            onFrame: onFrame,
        });

        try {
            nes.loadROM(romData);
            animationFrameId = requestAnimationFrame(nes_loop); // メインループを開始
            console.log("エミュレータを開始しました。");
        } catch (error) {
            console.error("ROMの読み込みに失敗:", error);
            alert("無効なROMファイルです。");
        }
    }

    // --- コントローラー入力 ---
    const CONTROLLER_MAP = {
        'up': jsnes.Controller.BUTTON_UP,
        'down': jsnes.Controller.BUTTON_DOWN,
        'left': jsnes.Controller.BUTTON_LEFT,
        'right': jsnes.Controller.BUTTON_RIGHT,
        'a': jsnes.Controller.BUTTON_A,
        'b': jsnes.Controller.BUTTON_B,
        'start': jsnes.Controller.BUTTON_START,
        'select': jsnes.Controller.BUTTON_SELECT,
    };

    function handleButtonDown(e) {
        if (!nes) return;
        const buttonId = e.currentTarget.id;
        const button = CONTROLLER_MAP[buttonId];
        if (button !== undefined) {
            nes.buttonDown(1, button); // プレイヤー1のボタンを押す
        }
        e.preventDefault();
    }

    function handleButtonUp(e) {
        if (!nes) return;
        const buttonId = e.currentTarget.id;
        const button = CONTROLLER_MAP[buttonId];
        if (button !== undefined) {
            nes.buttonUp(1, button); // プレイヤー1のボタンを離す
        }
        e.preventDefault();
    }

    // 各ボタンにイベントリスナーを登録
    for (const buttonId in CONTROLLER_MAP) {
        const element = document.getElementById(buttonId);
        if (element) {
            element.addEventListener('mousedown', handleButtonDown);
            element.addEventListener('mouseup', handleButtonUp);
            element.addEventListener('touchstart', handleButtonDown, { passive: false });
            element.addEventListener('touchend', handleButtonUp, { passive: false });
        }
    }

    // --- ROM読み込み処理 ---
    const loadRomButton = document.getElementById('load-rom');
    const romFileInput = document.getElementById('rom-file-input');

    loadRomButton.addEventListener('click', () => {
        romFileInput.click(); // ボタンクリックでファイル入力をトリガー
    });

    romFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const romData = e.target.result; // これがバイナリ文字列
            startEmulator(romData);
        };
        reader.onerror = (e) => {
            alert('ファイルの読み込みに失敗しました。');
            console.error("File reading error:", e);
        };
        reader.readAsBinaryString(file); // ファイルをバイナリ文字列として読み込む
    });

    console.log("main.jsが読み込まれました。");
});
