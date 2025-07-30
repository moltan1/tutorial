use rand::seq::SliceRandom;
use std::io::{self, Write}; // Write を追加して flush を使えるようにする

const HANGMAN_STAGES: [&str; 7] = [
    // 0 guesses left (full hangman)
    r"
  -----
  |   |
  |   O
  |  /|\
  |  / \
  |
-------",
    // 1 guess left
    r"
  -----
  |   |
  |   O
  |  /|\
  |  /
  |
-------",
    // 2 guesses left
    r"
  -----
  |   |
  |   O
  |  /|\
  |
  |
-------",
    // 3 guesses left
    r"
  -----
  |   |
  |   O
  |  /|
  |
  |
-------",
    // 4 guesses left
    r"
  -----
  |   |
  |   O
  |   |
  |
  |
-------",
    // 5 guesses left
    r"
  -----
  |   |
  |   O
  |
  |
  |
-------",
    // 6 guesses left (initial state)
    r"
  -----
  |   |
  |
  |
  |
  |
-------",
];

const WORDS: &[&str] = &["rust", "hangman", "programming", "computer", "keyboard"];

fn get_hangman_art(remaining_guesses: u32) -> &'static str {
    let stage_index = remaining_guesses as usize;
    // Ensure index is within bounds, flip logic so 0 remaining = last stage (full hangman)
    // and max remaining = first stage (empty gallows).
    // Our HANGMAN_STAGES is defined with 0 being full hangman, 6 being empty.
    if stage_index < HANGMAN_STAGES.len() {
        HANGMAN_STAGES[stage_index]
    } else {
        HANGMAN_STAGES[0] // Should not happen if remaining_guesses is kept <= 6
    }
}

fn select_word() -> &'static str {
    let mut rng = rand::thread_rng();
    WORDS.choose(&mut rng).unwrap_or(&"default") // エラー処理としてデフォルトワードも用意
}

struct GameState {
    secret_word: &'static str,
    remaining_guesses: u32,
    displayed_word: String,
    guessed_letters: Vec<char>,
}

fn initialize_game() -> GameState {
    let secret_word = select_word();
    let displayed_word = "_".repeat(secret_word.len());
    GameState {
        secret_word,
        remaining_guesses: 6,
        displayed_word,
        guessed_letters: Vec::new(),
    }
}

fn main() {
    println!("ハングマンへようこそ！");
    let mut game = initialize_game();

    loop {
        display_game_state(&game);

        // 画面クリアは display_game_state 内で制御するか、ここに入れる
        // print!("[2J[1;1H"); // display_game_stateの先頭にあるなら不要

        let guess = match get_player_guess(&game.guessed_letters) {
            Ok(g) => g,
            Err(e) => {
                println!("入力エラー: {}", e);
                // 短いポーズを入れるとユーザーがエラーを認識しやすい (オプション)
                // std::thread::sleep(std::time::Duration::from_secs(1));
                continue;
            }
        };

        if process_guess(&mut game, guess) {
            println!("正解！ '{}' は単語に含まれています。", guess);
        } else {
            println!("不正解 '{}' は単語に含まれていません。", guess);
        }

        // 短いポーズ (オプション)
        // std::thread::sleep(std::time::Duration::from_secs(1));

        let status = check_game_status(&game);

        if status != GameStatus::Playing {
            display_game_state(&game); // 最終状態を表示
            println!("
========================");
            if status == GameStatus::Won {
                println!("おめでとうございます！あなたの勝ちです！");
                println!("正解の単語は: {}", game.secret_word);
            } else { // GameStatus::Lost
                println!("ゲームオーバー！推測回数を使い果たしました。");
                println!("正解の単語は: {}", game.secret_word);
            }
            println!("========================");
            break;
        }
    }
    println!("遊んでくれてありがとう！");
}

fn get_player_guess(guessed_letters: &[char]) -> Result<char, String> {
    print!("一文字推測してください: "); // プロンプトも日本語化
    io::stdout().flush().map_err(|e| format!("プロンプト表示に失敗: {}", e))?;

    let mut guess_input = String::new(); // 変数名を変更して 'guess' と区別
    io::stdin().read_line(&mut guess_input)
        .map_err(|e| format!("入力の読み取りに失敗しました: {}", e))?;

    let trimmed_guess = guess_input.trim();
    if trimmed_guess.chars().count() != 1 { // .len() はバイト長なので .chars().count() を使う
        return Err("一文字だけ入力してください。".to_string());
    }

    let guessed_char = trimmed_guess.chars().next().unwrap().to_ascii_lowercase();

    if !guessed_char.is_alphabetic() {
        return Err("アルファベットを入力してください。".to_string());
    }

    if guessed_letters.contains(&guessed_char) {
        return Err(format!("文字「{}」は既に推測済みです。別の文字を入力してください。", guessed_char));
    }

    Ok(guessed_char)
}

fn process_guess(game_state: &mut GameState, guess: char) -> bool {
    game_state.guessed_letters.push(guess);
    // 推測された文字をソートして表示を一貫させる（オプション）
    game_state.guessed_letters.sort_unstable();
    game_state.guessed_letters.dedup(); // 重複削除も念のため

    let mut correct_guess = false;
    let mut new_displayed_word = String::new();
    for (i, secret_char) in game_state.secret_word.chars().enumerate() {
        if secret_char == guess {
            new_displayed_word.push(secret_char);
            correct_guess = true;
        } else if game_state.displayed_word.chars().nth(i).unwrap_or('_') != '_' {
            // 既に明らかになっている文字
            new_displayed_word.push(game_state.displayed_word.chars().nth(i).unwrap());
        } else {
            new_displayed_word.push('_');
        }
    }

    if correct_guess {
        game_state.displayed_word = new_displayed_word;
    } else {
        game_state.remaining_guesses -= 1;
    }

    correct_guess
}

#[derive(Debug, PartialEq)] // PartialEq を追加して比較できるようにする
enum GameStatus {
    Playing,
    Won,
    Lost,
}

fn check_game_status(game_state: &GameState) -> GameStatus {
    if game_state.displayed_word == game_state.secret_word {
        return GameStatus::Won;
    }
    if game_state.remaining_guesses == 0 {
        return GameStatus::Lost;
    }
    GameStatus::Playing
}

fn display_game_state(game_state: &GameState) {
    print!("\x1B[2J\x1B[1;1H"); // 画面クリアとカーソルを左上に移動
    // オプション: 画面クリア
    // print!("[2J[1;1H");

    println!("
+----------------------+");
    println!("|      H A N G M A N   |");
    println!("+----------------------+");

    println!("{}", get_hangman_art(game_state.remaining_guesses)); // AA表示を追加

    // ハングマンのAA表示エリア (今回はシンプルに)
    // display_hangman_art(game_state.remaining_guesses); // 将来的に実装

    // 表示も一部日本語化
    println!("
単語: {}", game_state.displayed_word.chars().map(|c| c.to_string()).collect::<Vec<String>>().join(" "));
    println!("残り推測回数: {}", game_state.remaining_guesses);

    let guessed_letters_str = game_state.guessed_letters.iter().map(|c| c.to_string()).collect::<Vec<String>>().join(", ");
    println!("推測済みの文字: [{}]", guessed_letters_str);
    println!("------------------------");
}
