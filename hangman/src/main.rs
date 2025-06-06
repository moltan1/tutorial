use rand::seq::SliceRandom;
use std::io::{self, Write}; // Write を追加して flush を使えるようにする

const WORDS: &[&str] = &["rust", "hangman", "programming", "computer", "keyboard"];

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
    println!("Welcome to Hangman!");
    let mut game = initialize_game();

    loop {
        display_game_state(&game);

        // 画面クリアは display_game_state 内で制御するか、ここに入れる
        // print!("[2J[1;1H"); // display_game_stateの先頭にあるなら不要

        let guess = match get_player_guess(&game.guessed_letters) {
            Ok(g) => g,
            Err(e) => {
                println!("Input error: {}", e);
                // 短いポーズを入れるとユーザーがエラーを認識しやすい (オプション)
                // std::thread::sleep(std::time::Duration::from_secs(1));
                continue;
            }
        };

        if process_guess(&mut game, guess) {
            println!("Correct guess: '{}' is in the word!", guess);
        } else {
            println!("Incorrect guess: '{}' is not in the word.", guess);
        }

        // 短いポーズ (オプション)
        // std::thread::sleep(std::time::Duration::from_secs(1));

        let status = check_game_status(&game);

        if status != GameStatus::Playing {
            display_game_state(&game); // 最終状態を表示
            println!("
========================");
            if status == GameStatus::Won {
                println!("Congratulations! You won!");
                println!("The word was: {}", game.secret_word);
            } else { // GameStatus::Lost
                println!("Game Over! You ran out of guesses.");
                println!("The word was: {}", game.secret_word);
            }
            println!("========================");
            break;
        }
    }
    println!("Thanks for playing!");
}

fn get_player_guess(guessed_letters: &[char]) -> Result<char, String> {
    print!("Please enter your guess (a single letter): ");
    io::stdout().flush().unwrap(); // プロンプトをすぐに表示するために flush

    let mut guess = String::new();
    io::stdin().read_line(&mut guess)
        .map_err(|e| format!("Failed to read line: {}", e))?;

    let trimmed_guess = guess.trim();
    if trimmed_guess.len() != 1 {
        return Err("Please enter a single letter.".to_string());
    }

    let guessed_char = trimmed_guess.chars().next().unwrap().to_ascii_lowercase();

    if !guessed_char.is_alphabetic() {
        return Err("Please enter an alphabet character.".to_string());
    }

    if guessed_letters.contains(&guessed_char) {
        return Err(format!("You have already guessed '{}'. Try another letter.", guessed_char));
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
    // オプション: 画面クリア
    // print!("[2J[1;1H");

    println!("
+----------------------+");
    println!("|      H A N G M A N   |");
    println!("+----------------------+");

    // ハングマンのAA表示エリア (今回はシンプルに)
    // display_hangman_art(game_state.remaining_guesses); // 将来的に実装

    println!("
Word: {}", game_state.displayed_word.chars().map(|c| c.to_string()).collect::<Vec<String>>().join(" "));
    println!("Guesses left: {}", game_state.remaining_guesses);

    let guessed_letters_str = game_state.guessed_letters.iter().map(|c| c.to_string()).collect::<Vec<String>>().join(", ");
    println!("Guessed letters: [{}]", guessed_letters_str);
    println!("------------------------");
}
