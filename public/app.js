// State variables for the application
let appData = {
  title: "",
  introduction: "",
  timeline: [],
  characters: [],
  bases: [],
  quizzes: []
};

let currentTab = "dashboard";
let searchQuery = "";
let bookmarks = JSON.parse(localStorage.getItem("seiseifu_bookmarks") || "[]");

// Quiz state
let currentQuizIndex = 0;
let quizScore = 0;
let quizAnswers = []; // track user answers

// Fetch the central database on load
window.addEventListener("DOMContentLoaded", () => {
  fetchData();
  updateBookmarkCount();
});

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error("Data fetch failed");
    appData = await response.onJson ? await response.onJson() : await response.json();

    // Initialize UI Text
    document.getElementById("app-title").textContent = appData.title || "征西府探索システム";
    document.getElementById("app-intro").textContent = appData.introduction || "";

    // Initial render
    renderAll();
  } catch (err) {
    console.error("Error loading data:", err);
    document.getElementById("app-intro").innerHTML = `<span class="text-red-400 font-bold">データをロードできませんでした。サーバーの起動状況を確認してください。</span>`;
  }
}

// Navigation Tab Switcher
function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ["dashboard", "timeline", "bases", "characters", "quiz"];

  // Update Buttons style
  tabs.forEach(t => {
    const btn = document.getElementById(`btn-${t}`);
    if (btn) {
      if (t === tabId) {
        btn.className = "px-3 py-2 rounded text-sm font-semibold transition bg-amber-700 text-white shadow";
      } else {
        btn.className = "px-3 py-2 rounded text-sm font-semibold transition hover:bg-stone-700 text-stone-300";
      }
    }

    // Hide/Show panes
    const pane = document.getElementById(`pane-${t}`);
    if (pane) {
      if (t === tabId) {
        pane.classList.remove("hidden");
      } else {
        pane.classList.add("hidden");
      }
    }
  });

  // Re-render because tab changes
  renderAll();
}

// Re-render everything
function renderAll() {
  renderTimeline();
  renderBases();
  renderCharacters();
  // We do not re-render quiz automatically to avoid resetting quiz progress.
}

// Search filtering logic
function handleSearch() {
  searchQuery = document.getElementById("search-input").value.trim().toLowerCase();
  renderAll();
}

// TIMELINE RENDER
function renderTimeline() {
  const container = document.getElementById("timeline-list");
  if (!container) return;

  const filtered = appData.timeline.filter(item => {
    if (!searchQuery) return true;
    return item.event.toLowerCase().includes(searchQuery) ||
           item.description.toLowerCase().includes(searchQuery) ||
           item.details.toLowerCase().includes(searchQuery) ||
           String(item.year).includes(searchQuery);
  });

  document.getElementById("timeline-count").textContent = `全${filtered.length}件`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-stone-500 text-sm">該当する歴史イベントが見つかりません。</div>`;
    return;
  }

  container.innerHTML = filtered.map((item, index) => {
    const isBookmarked = hasBookmark('timeline', item.year);
    return `
      <div class="bg-white p-5 rounded-xl shadow-md border-l-4 border-amber-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:shadow-lg">
        <div class="space-y-1.5 flex-grow">
          <div class="flex items-center space-x-2">
            <span class="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-xs font-bold">${item.year}年</span>
            <h3 class="text-base font-bold text-stone-800">${item.event}</h3>
          </div>
          <p class="text-stone-600 text-sm leading-relaxed">${item.description}</p>
        </div>
        <div class="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button onclick="showDetailModal('${item.event}', '${item.details}')" class="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded border border-stone-200 transition font-bold"><i class="fa-solid fa-book-open mr-1"></i>詳細</button>
          <button onclick="toggleBookmark('timeline', '${item.year}', '${item.event}')" class="text-xs px-3 py-1.5 rounded transition font-bold ${isBookmarked ? 'bg-amber-600 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'}">
            <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark mr-1"></i>${isBookmarked ? 'しおり済' : 'しおり'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// BASES RENDER WITH INLINE MAP DEFINITIONS
function renderBases() {
  const container = document.getElementById("bases-list");
  if (!container) return;

  const filtered = appData.bases.filter(base => {
    if (!searchQuery) return true;
    return base.name.toLowerCase().includes(searchQuery) ||
           base.role.toLowerCase().includes(searchQuery) ||
           base.description.toLowerCase().includes(searchQuery) ||
           base.period.toLowerCase().includes(searchQuery);
  });

  document.getElementById("bases-count").textContent = `全${filtered.length}件`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-stone-500 text-sm">該当する重要拠点が見つかりません。</div>`;
    renderMapPins([]);
    return;
  }

  // Render Base Cards
  container.innerHTML = filtered.map(base => {
    const isBookmarked = hasBookmark('base', base.id);
    return `
      <div id="card-base-${base.id}" class="bg-white p-5 rounded-xl shadow-md border border-stone-200 space-y-3 transition hover:shadow-lg">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">${base.period}</span>
            <h3 class="text-lg font-bold text-stone-800 mt-1">${base.name}</h3>
            <p class="text-xs text-amber-700 font-bold"><i class="fa-solid fa-flag mr-1"></i>${base.role}</p>
          </div>
          <button onclick="toggleBookmark('base', '${base.id}', '${base.name}')" class="text-xs px-2.5 py-1 rounded transition font-bold ${isBookmarked ? 'bg-amber-600 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'}">
            <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark mr-1"></i>${isBookmarked ? 'しおり済' : 'しおり'}
          </button>
        </div>
        <p class="text-stone-600 text-xs md:text-sm leading-relaxed">${base.description}</p>
      </div>
    `;
  }).join('');

  // Update Visual Map pins and lines
  renderMapPins(filtered);
}

// Render dynamic elements for Map
function renderMapPins(activeBases) {
  const pinsContainer = document.getElementById("map-pins-container");
  const svgLines = document.getElementById("map-svg-lines");
  if (!pinsContainer || !svgLines) return;

  pinsContainer.innerHTML = "";
  svgLines.innerHTML = "";

  if (activeBases.length === 0) return;

  // Render Pins
  activeBases.forEach((base, index) => {
    const pin = document.createElement("div");
    pin.className = "absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20";
    pin.style.left = `${base.coordinates.x}%`;
    pin.style.top = `${base.coordinates.y}%`;

    // Click pin to scroll to card
    pin.onclick = () => {
      const card = document.getElementById(`card-base-${base.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add("ring-2", "ring-amber-500");
        setTimeout(() => card.classList.remove("ring-2", "ring-amber-500"), 2000);
      }
    };

    pin.innerHTML = `
      <div class="relative flex items-center justify-center">
        <!-- Pulse effect -->
        <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-amber-400 opacity-75"></span>
        <!-- Main dot -->
        <span class="relative inline-flex rounded-full h-4 w-4 bg-amber-600 border border-white items-center justify-center text-[9px] text-white font-bold">${index + 1}</span>

        <!-- Tooltip on hover -->
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none z-30 font-bold">
          ${base.name} (${base.period})
        </div>
      </div>
    `;
    pinsContainer.appendChild(pin);
  });

  // Render svg chronological flow lines
  // Let's draw lines connecting bases if there are multiple active bases
  if (activeBases.length > 1) {
    let linePath = "";
    for (let i = 0; i < activeBases.length - 1; i++) {
      const start = activeBases[i].coordinates;
      const end = activeBases[i+1].coordinates;

      // Calculate coordinates dynamically based on parent size
      // Svg lines are scaled 0-100% since we can use vector-effect="non-scaling-stroke"
      // or viewbox coordinates. Let's make viewbox 100 100 to map perfectly with % coordinates.
      svgLines.setAttribute("viewBox", "0 0 100 100");

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", start.x);
      line.setAttribute("y1", start.y);
      line.setAttribute("x2", end.x);
      line.setAttribute("y2", end.y);
      line.setAttribute("stroke", "#d97706");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "3 2");
      svgLines.appendChild(line);
    }
  }
}

// CHARACTERS RENDER
function renderCharacters() {
  const container = document.getElementById("characters-grid");
  if (!container) return;

  const filtered = appData.characters.filter(char => {
    if (!searchQuery) return true;
    return char.name.toLowerCase().includes(searchQuery) ||
           char.role.toLowerCase().includes(searchQuery) ||
           char.description.toLowerCase().includes(searchQuery);
  });

  document.getElementById("characters-count").textContent = `全${filtered.length}件`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-stone-500 text-sm col-span-full">該当する人物が見つかりません。</div>`;
    return;
  }

  container.innerHTML = filtered.map(char => {
    const isBookmarked = hasBookmark('character', char.id);
    return `
      <div class="bg-white rounded-xl shadow-md p-5 border border-stone-200 flex space-x-4 items-start transition hover:shadow-lg">
        <div class="bg-amber-50 border border-amber-200 text-3xl w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner">
          ${char.image}
        </div>
        <div class="space-y-2 flex-grow">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-bold text-stone-800 text-base md:text-lg">${char.name}</h3>
              <p class="text-xs text-amber-700 font-bold">${char.role}</p>
            </div>
            <button onclick="toggleBookmark('character', '${char.id}', '${char.name}')" class="text-xs px-2.5 py-1 rounded transition font-bold ${isBookmarked ? 'bg-amber-600 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'}">
              <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
            </button>
          </div>
          <p class="text-stone-600 text-xs md:text-sm leading-relaxed">${char.description}</p>
        </div>
      </div>
    `;
  }).join('');
}

// INTERACTIVE HISTORICAL QUIZ
function startQuiz() {
  currentQuizIndex = 0;
  quizScore = 0;
  quizAnswers = [];

  // Hide Landing, Show active panel
  document.getElementById("quiz-start-view").classList.add("hidden");
  document.getElementById("quiz-result-view").classList.add("hidden");
  document.getElementById("quiz-active-view").classList.remove("hidden");

  loadQuizQuestion();
}

function loadQuizQuestion() {
  const quiz = appData.quizzes[currentQuizIndex];

  // Update progress UI
  document.getElementById("quiz-progress-bar").style.width = `${((currentQuizIndex + 1) / appData.quizzes.length) * 100}%`;
  document.getElementById("quiz-question-number").textContent = `第 ${currentQuizIndex + 1} 問 / ${appData.quizzes.length}問`;
  document.getElementById("quiz-score-indicator").textContent = `現在の正解数: ${quizScore}`;

  // Set Question Text
  document.getElementById("quiz-question-text").textContent = quiz.question;

  // Set Options
  const optionsContainer = document.getElementById("quiz-options-container");
  optionsContainer.innerHTML = quiz.options.map((option, index) => {
    return `
      <button onclick="submitQuizAnswer(${index})" class="quiz-opt-btn bg-white hover:bg-amber-50 text-stone-700 font-bold py-3 px-4 rounded-lg border-2 border-stone-200 text-left text-xs md:text-sm transition flex justify-between items-center group">
        <span>${index + 1}. ${option}</span>
        <i class="fa-solid fa-circle-chevron-right text-stone-300 group-hover:text-amber-500 transition"></i>
      </button>
    `;
  }).join('');

  // Hide Feedback Panel
  document.getElementById("quiz-feedback").classList.add("hidden");
}

function submitQuizAnswer(selectedIndex) {
  const quiz = appData.quizzes[currentQuizIndex];
  const isCorrect = selectedIndex === quiz.answer;

  if (isCorrect) {
    quizScore++;
  }

  // Update indicators
  document.getElementById("quiz-score-indicator").textContent = `現在の正解数: ${quizScore}`;

  // Render options disabled with colors
  const optionButtons = document.querySelectorAll(".quiz-opt-btn");
  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === quiz.answer) {
      btn.className = "quiz-opt-btn bg-green-50 text-green-800 font-bold py-3 px-4 rounded-lg border-2 border-green-500 text-left text-xs md:text-sm transition flex justify-between items-center";
      btn.innerHTML += `<i class="fa-solid fa-circle-check text-green-600 text-lg"></i>`;
    } else if (idx === selectedIndex) {
      btn.className = "quiz-opt-btn bg-red-50 text-red-800 font-bold py-3 px-4 rounded-lg border-2 border-red-400 text-left text-xs md:text-sm transition flex justify-between items-center";
      btn.innerHTML += `<i class="fa-solid fa-circle-xmark text-red-500 text-lg"></i>`;
    } else {
      btn.className = "quiz-opt-btn bg-stone-50 text-stone-400 py-3 px-4 rounded-lg border border-stone-200 text-left text-xs md:text-sm transition opacity-60 flex justify-between items-center";
    }
  });

  // Render Feedback Detail Panel
  const feedbackPanel = document.getElementById("quiz-feedback");
  const resultIcon = document.getElementById("quiz-result-icon");
  const resultText = document.getElementById("quiz-result-text");

  if (isCorrect) {
    feedbackPanel.className = "p-4 rounded-lg border bg-green-50/60 border-green-200 text-green-900 leading-relaxed text-sm";
    resultIcon.className = "fa-solid fa-circle-check text-green-600 text-lg";
    resultText.textContent = "正解です！";
  } else {
    feedbackPanel.className = "p-4 rounded-lg border bg-red-50/60 border-red-200 text-red-900 leading-relaxed text-sm";
    resultIcon.className = "fa-solid fa-triangle-exclamation text-red-500 text-lg";
    resultText.textContent = `不合格！ 正解は「${quiz.options[quiz.answer]}」です。`;
  }

  document.getElementById("quiz-explanation-text").textContent = quiz.explanation;
  feedbackPanel.classList.remove("hidden");
}

function nextQuiz() {
  currentQuizIndex++;
  if (currentQuizIndex < appData.quizzes.length) {
    loadQuizQuestion();
  } else {
    showQuizResults();
  }
}

function showQuizResults() {
  document.getElementById("quiz-active-view").classList.add("hidden");

  const resultView = document.getElementById("quiz-result-view");
  const badgeIcon = document.getElementById("quiz-badge-icon");
  const rankTitle = document.getElementById("quiz-rank-title");
  const rankDescription = document.getElementById("quiz-rank-description");
  const finalScore = document.getElementById("quiz-final-score");

  finalScore.textContent = quizScore;

  // Determine title based on score
  if (quizScore === 5) {
    badgeIcon.className = "text-7xl text-amber-500 fa-solid fa-crown animate-pulse";
    rankTitle.textContent = "称号：西海の覇者「征西大将軍」";
    rankDescription.textContent = "素晴らしい！あなたは征西府の波乱に満ちた歴史を完璧にマスターしました。懐良親王や菊池武光と共に、西海の地を統率するにふさわしい知識の持ち主です。";
  } else if (quizScore >= 3) {
    badgeIcon.className = "text-7xl text-stone-500 fa-solid fa-shield-halved";
    rankTitle.textContent = "称号：征西府の参謀「五条頼元」級";
    rankDescription.textContent = "合格レベルです！征西府の重要な転換点や功績をしっかりと理解しています。あと一歩で満点「征西大将軍」に届きます。";
  } else {
    badgeIcon.className = "text-7xl text-amber-800 fa-solid fa-feather";
    rankTitle.textContent = "称号：西国探訪の旅人";
    rankDescription.textContent = "征西府の歴史は奥深く一筋縄ではいきません。システム内の年表や主要拠点、人物事典をもう一度よく読み込んで、再挑戦してみましょう！";
  }

  resultView.classList.remove("hidden");
}


// BOOKMARK / FAVORITES LOGIC
function hasBookmark(category, id) {
  return bookmarks.some(b => b.category === category && b.id === id);
}

function toggleBookmark(category, id, title) {
  const index = bookmarks.findIndex(b => b.category === category && b.id === id);
  if (index >= 0) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push({ category, id, title, timestamp: Date.now() });
  }

  localStorage.setItem("seiseifu_bookmarks", JSON.stringify(bookmarks));
  updateBookmarkCount();

  // Re-render only active tab elements to show changes instantly
  if (currentTab === 'timeline') renderTimeline();
  if (currentTab === 'bases') renderBases();
  if (currentTab === 'characters') renderCharacters();
}

function updateBookmarkCount() {
  document.getElementById("bookmark-count").textContent = bookmarks.length;
}

function showBookmarkedItems() {
  const container = document.getElementById("bookmarked-list-container");
  if (!container) return;

  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 space-y-3">
        <i class="fa-solid fa-bookmark text-stone-300 text-4xl"></i>
        <p class="text-stone-500 text-sm">しおり（お気に入り）は登録されていません。</p>
        <p class="text-[11px] text-stone-400">年表、拠点、人物カードにある「しおり」ボタンを押すことでここに表示されます。</p>
      </div>
    `;
  } else {
    container.innerHTML = bookmarks.map(b => {
      let categoryLabel = "";
      let icon = "";
      if (b.category === 'timeline') { categoryLabel = "歴史年表"; icon = "fa-clock-rotate-left"; }
      if (b.category === 'base') { categoryLabel = "重要拠点"; icon = "fa-map-location-dot"; }
      if (b.category === 'character') { categoryLabel = "主要人物"; icon = "fa-user-shield"; }

      return `
        <div class="bg-stone-50 p-3.5 rounded-lg border border-stone-200 flex justify-between items-center gap-4 text-xs">
          <div class="space-y-1">
            <span class="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded font-bold inline-flex items-center">
              <i class="fa-solid ${icon} mr-1"></i>${categoryLabel}
            </span>
            <h4 class="font-bold text-stone-800 text-sm">${b.title}</h4>
          </div>
          <button onclick="removeBookmarkDirectly('${b.category}', '${b.id}')" class="text-red-600 hover:text-red-700 font-bold transition flex items-center space-x-1 p-1">
            <i class="fa-solid fa-trash-can"></i>
            <span>削除</span>
          </button>
        </div>
      `;
    }).join('');
  }

  document.getElementById("bookmarks-modal").classList.remove("hidden");
}

function removeBookmarkDirectly(category, id) {
  bookmarks = bookmarks.filter(b => !(b.category === category && b.id === id));
  localStorage.setItem("seiseifu_bookmarks", JSON.stringify(bookmarks));
  updateBookmarkCount();
  showBookmarkedItems(); // Re-render modal list

  // Sync back to standard panels
  if (currentTab === 'timeline') renderTimeline();
  if (currentTab === 'bases') renderBases();
  if (currentTab === 'characters') renderCharacters();
}

function closeBookmarksModal() {
  document.getElementById("bookmarks-modal").classList.add("hidden");
}


// DETAIL POPUP MODAL LOGIC
function showDetailModal(title, details) {
  document.getElementById("detail-modal-title").textContent = title;
  document.getElementById("detail-modal-content").innerHTML = `
    <p class="leading-relaxed text-stone-700">${details}</p>
  `;
  document.getElementById("detail-modal").classList.remove("hidden");
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.add("hidden");
}
