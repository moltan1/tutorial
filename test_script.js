document.addEventListener('DOMContentLoaded', function() {
    const testResultsContainer = document.getElementById('test-results');
    // Assuming script.js's currentDate is globally accessible for testing purposes
    // If not, tests for currentDate modification by buttons would need to be different (e.g. checking header only)
    const originalCurrentDate = new Date(currentDate); 

    // --- Test Helper Functions ---
    function runTestSuite(suiteName, tests) {
        let successes = 0;
        let failures = 0;
        let suiteHtml = `<div class="test-suite"><h3>${suiteName}</h3>`;

        for (const testName in tests) {
            let result = false;
            let errorMsg = '';
            try {
                // For tests involving UI changes and state from script.js, ensure script.js's functions are called
                tests[testName]();
                result = true;
                successes++;
            } catch (e) {
                result = false;
                failures++;
                errorMsg = e.message;
                console.error(`Test Failed: ${testName}`, e);
            }
            suiteHtml += `<div class="test-case ${result ? 'pass' : 'fail'}">${testName}: ${result ? 'PASS' : `FAIL <pre>${errorMsg}</pre>`}</div>`;
        }
        suiteHtml += `<div>Summary: ${successes} passed, ${failures} failed.</div></div>`;
        testResultsContainer.innerHTML += suiteHtml;
        return failures === 0;
    }

    function assertEquals(expected, actual, message) {
        if (expected !== actual) {
            throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
        }
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    // --- DOM Elements ---
    const currentMonthYearDisplay = document.getElementById('current-month-year');
    const currentMonthCalendarBody = document.getElementById('current-month-calendar').querySelector('tbody');
    const nextMonthCalendarBody = document.getElementById('next-month-calendar').querySelector('tbody');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');

    // Memo section DOM elements (from test.html)
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const memoInput = document.getElementById('memo-input');
    const saveMemoButton = document.getElementById('save-memo-button');

    // --- Test-Specific Helper Functions ---
    function getCellByDayText(tableBody, dayText) {
        const cells = tableBody.querySelectorAll('td');
        for (let cell of cells) {
            if (cell.textContent === String(dayText)) {
                return cell;
            }
        }
        return null;
    }

    function simulateDateCellClick(tableBody, dayText) {
        const cell = getCellByDayText(tableBody, dayText);
        if (cell) {
            cell.click(); // This will trigger event listeners in script.js
            return true;
        }
        // console.warn(`Cell with day text "${dayText}" not found in tableBody for click simulation.`);
        return false;
    }
    
    function formatDateToKey(dateObj) { // dateObj is expected to be a Date object
        if (!dateObj) return null;
        return `memo_${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }

    function beforeEachMemoTest() {
        // Clear any memos from localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('memo_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Reset UI related to memo by manipulating script.js's state and calling its functions
        selectedDate = null; // Reset script.js's global selectedDate (assuming it's accessible)
        
        // Call script.js's function to update memo display, which should handle null selectedDate
        if (typeof displayMemoForSelectedDate === "function") { 
             displayMemoForSelectedDate(); 
        } else { // Fallback if displayMemoForSelectedDate isn't directly callable or exposed
            if(selectedDateDisplay) selectedDateDisplay.textContent = 'メモの対象日: ---';
            if(memoInput) memoInput.value = '';
        }
       
        // Remove .selected class from all cells in both calendars
        document.querySelectorAll('#current-month-calendar td.selected, #next-month-calendar td.selected').forEach(c => c.classList.remove('selected'));
    }

    // --- Test Suites ---

    // Test Suite 1: Calendar Generation Logic
    runTestSuite('Calendar Generation Logic', {
        'testDaysInJanuary2024': function() {
            currentDate = new Date(2024, 0, 15); 
            generateCalendar(0, 2024, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(31, dayCells.length, 'Number of days in January 2024');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(2)');
            assertEquals('1', firstDayCell.textContent, 'January 2024 should start on Monday');
        },
        'testDaysInFebruary2024Leap': function() {
            currentDate = new Date(2024, 1, 15);
            generateCalendar(1, 2024, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(29, dayCells.length, 'Number of days in February 2024 (leap)');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(5)');
            assertEquals('1', firstDayCell.textContent, 'February 2024 should start on Thursday');
        },
        'testDaysInFebruary2023NonLeap': function() {
            currentDate = new Date(2023, 1, 15);
            generateCalendar(1, 2023, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(28, dayCells.length, 'Number of days in February 2023');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(4)');
            assertEquals('1', firstDayCell.textContent, 'February 2023 should start on Wednesday');
        },
        'testDaysInSeptember2023': function() {
            currentDate = new Date(2023, 8, 15);
            generateCalendar(8, 2023, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(30, dayCells.length, 'Number of days in September 2023');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(6)');
            assertEquals('1', firstDayCell.textContent, 'September 2023 should start on Friday');
        },
        'testTodayHighlighting': function() {
            const today = new Date();
            currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            generateCalendar(today.getMonth(), today.getFullYear(), currentMonthCalendarBody);
            const todayCell = Array.from(currentMonthCalendarBody.querySelectorAll('td')).find(td => td.textContent === String(today.getDate()));
            assert(todayCell && todayCell.classList.contains('today'), "Today's date should be highlighted");
        }
    });

    // Test Suite 2: Navigation and Display Logic (including Japanese localization)
    runTestSuite('Navigation and Display Logic', {
        'testJapaneseDayHeaders': function() {
            if (typeof updateDayHeaders === "function") updateDayHeaders(); // Ensure it's run
            const expectedDayNames = ["日", "月", "火", "水", "木", "金", "土"];
            const currentCalendarTheads = document.getElementById('current-month-calendar').querySelectorAll('thead th');
            currentCalendarTheads.forEach((th, index) => {
                assertEquals(expectedDayNames[index], th.textContent, `Current calendar day header ${index}`);
            });
            const nextCalendarTheads = document.getElementById('next-month-calendar').querySelectorAll('thead th');
            nextCalendarTheads.forEach((th, index) => {
                assertEquals(expectedDayNames[index], th.textContent, `Next calendar day header ${index}`);
            });
        },
        'testInitialDisplay': function() {
            currentDate = new Date(2023, 9, 15); // October 15, 2023
            if (typeof displayCalendars === "function") displayCalendars();
            assertEquals('2023年10月', currentMonthYearDisplay.textContent, 'Header: Initial month/year (Japanese)');
        },
        'testNextMonthButton': function() {
            currentDate = new Date(2023, 9, 15); // Oct 15, 2023
            if (typeof displayCalendars === "function") displayCalendars(); // Set initial
            nextMonthButton.click();
            assertEquals('2023年11月', currentMonthYearDisplay.textContent, 'Header: Next month (Japanese)');
            assertEquals(10, currentDate.getMonth(), 'Internal month after next click');
        },
        'testPrevMonthButton': function() {
            currentDate = new Date(2023, 9, 15); // Oct 15, 2023
            if (typeof displayCalendars === "function") displayCalendars(); // Set initial
            prevMonthButton.click();
            assertEquals('2023年9月', currentMonthYearDisplay.textContent, 'Header: Previous month (Japanese)');
            assertEquals(8, currentDate.getMonth(), 'Internal month after prev click');
        },
        'testMonthRolloverDecemberToJanuary': function() {
            currentDate = new Date(2023, 11, 15); // Dec 15, 2023
            if (typeof displayCalendars === "function") displayCalendars();
            nextMonthButton.click();
            assertEquals('2024年1月', currentMonthYearDisplay.textContent, 'Header: Dec to Jan rollover (Japanese)');
            assertEquals(0, currentDate.getMonth(), 'Internal month after Dec to Jan');
            assertEquals(2024, currentDate.getFullYear(), 'Internal year after Dec to Jan');
        },
        'testMonthRolloverJanuaryToDecember': function() {
            currentDate = new Date(2024, 0, 15); // Jan 15, 2024
            if (typeof displayCalendars === "function") displayCalendars();
            prevMonthButton.click();
            assertEquals('2023年12月', currentMonthYearDisplay.textContent, 'Header: Jan to Dec rollover (Japanese)');
            assertEquals(11, currentDate.getMonth(), 'Internal month after Jan to Dec');
            assertEquals(2023, currentDate.getFullYear(), 'Internal year after Jan to Dec');
        }
    });

    // Test Suite 3: Memo Functionality
    runTestSuite('Memo Functionality', {
        'testDateSelectionAndDisplay': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Set to Oct 2023 for predictable calendar
            if (typeof displayCalendars === "function") displayCalendars(); 

            assert(simulateDateCellClick(currentMonthCalendarBody, 10), 'Click on day 10 in current month (Oct)');
            
            // selectedDate is a global in script.js, assume it's accessible for test verification
            const expectedSelectedDateObj = new Date(2023, 9, 10); 
            assert(selectedDate !== null, 'script.js selectedDate should be populated');
            assertEquals(expectedSelectedDateObj.getFullYear(), selectedDate.getFullYear(), 'Selected year check');
            assertEquals(expectedSelectedDateObj.getMonth(), selectedDate.getMonth(), 'Selected month check');
            assertEquals(expectedSelectedDateObj.getDate(), selectedDate.getDate(), 'Selected day check');

            assertEquals('メモの対象日: 2023年10月10日', selectedDateDisplay.textContent, 'Selected date display text after clicking day 10');
            const day10CellCurrent = getCellByDayText(currentMonthCalendarBody, 10);
            assert(day10CellCurrent && day10CellCurrent.classList.contains('selected'), 'Day 10 cell in current month should have .selected class');

            assert(simulateDateCellClick(currentMonthCalendarBody, 15), 'Click on day 15 in current month (Oct)');
            assert(day10CellCurrent && !day10CellCurrent.classList.contains('selected'), 'Day 10 cell (Oct) should lose .selected class');
            const day15CellCurrent = getCellByDayText(currentMonthCalendarBody, 15);
            assert(day15CellCurrent && day15CellCurrent.classList.contains('selected'), 'Day 15 cell (Oct) should now have .selected class');
            assertEquals('メモの対象日: 2023年10月15日', selectedDateDisplay.textContent, 'Selected date display updated to day 15 (Oct)');
        },
        'testMemoSavingAndLoading': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Oct 2023
            if (typeof displayCalendars === "function") displayCalendars();

            simulateDateCellClick(currentMonthCalendarBody, 12); // Select Oct 12
            memoInput.value = "テストメモ12日";
            saveMemoButton.click(); // Simulate save button click (this calls displayCalendars in script.js)

            const dateForMemo = new Date(2023, 9, 12);
            const dateKeyDay12 = formatDateToKey(dateForMemo);
            assertEquals("テストメモ12日", localStorage.getItem(dateKeyDay12), 'Memo for Oct 12 should be saved to localStorage');
            
            const cellDay12 = getCellByDayText(currentMonthCalendarBody, 12);
            assert(cellDay12 && cellDay12.classList.contains('has-memo'), 'Oct 12 cell should have .has-memo class after saving');

            // Clear input and re-select to test loading (and .has-memo again)
            memoInput.value = ''; 
            simulateDateCellClick(currentMonthCalendarBody, 12); // Re-select Oct 12
            assertEquals("テストメモ12日", memoInput.value, 'Memo for Oct 12 should be loaded into input after re-selection');
            assert(cellDay12 && cellDay12.classList.contains('has-memo'), 'Oct 12 cell should still have .has-memo class on re-selection');


            // Select a date with no memo (Oct 13)
            simulateDateCellClick(currentMonthCalendarBody, 13);
            assertEquals('', memoInput.value, 'Memo input should be cleared when selecting Oct 13 (no memo)');
            const cellDay13 = getCellByDayText(currentMonthCalendarBody, 13);
            assert(cellDay13 && !cellDay13.classList.contains('has-memo'), 'Oct 13 cell should NOT have .has-memo class');
        },
        'testHasMemoClassOnInitialLoad': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Set to Oct 2023

            // Pre-save a memo for Oct 10
            const dateOct10 = new Date(2023, 9, 10);
            const keyOct10 = formatDateToKey(dateOct10);
            localStorage.setItem(keyOct10, "Initial memo for Oct 10");

            if (typeof displayCalendars === "function") displayCalendars(); // Initial render

            const cellOct10 = getCellByDayText(currentMonthCalendarBody, 10);
            assert(cellOct10 && cellOct10.classList.contains('has-memo'), 'Oct 10 cell should have .has-memo on initial load');

            const cellOct11 = getCellByDayText(currentMonthCalendarBody, 11); // A day without a pre-saved memo
            assert(cellOct11 && !cellOct11.classList.contains('has-memo'), 'Oct 11 cell should NOT have .has-memo on initial load');
        },
        'testHasMemoClassAcrossNavigation': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Oct 2023
            if (typeof displayCalendars === "function") displayCalendars();

            // Save a memo for Oct 10
            simulateDateCellClick(currentMonthCalendarBody, 10);
            memoInput.value = "Nav test memo for Oct 10";
            saveMemoButton.click(); // This calls displayCalendars

            let cellOct10 = getCellByDayText(currentMonthCalendarBody, 10);
            assert(cellOct10 && cellOct10.classList.contains('has-memo'), 'Oct 10 should have .has-memo after save');

            nextMonthButton.click(); // Navigate to Nov 2023
            prevMonthButton.click(); // Navigate back to Oct 2023

            // Re-fetch cell after navigation and re-render
            cellOct10 = getCellByDayText(currentMonthCalendarBody, 10); 
            assert(cellOct10 && cellOct10.classList.contains('has-memo'), 'Oct 10 should still have .has-memo after navigating away and back');
            
            const cellOct11 = getCellByDayText(currentMonthCalendarBody, 11);
            assert(cellOct11 && !cellOct11.classList.contains('has-memo'), 'Oct 11 (no memo) should NOT have .has-memo after navigation');
        },
        'testMemoAlertsOnSave': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Oct 2023
            if (typeof displayCalendars === "function") displayCalendars();

            let originalAlert = window.alert;
            let alertMessage = '';
            window.alert = (msg) => { alertMessage = msg; }; // Mock alert

            saveMemoButton.click(); // Try saving without selecting a date
            assertEquals('日付を選択してください。', alertMessage, 'Alert message for saving without date selection');

            simulateDateCellClick(currentMonthCalendarBody, 1); // Select Oct 1
            memoInput.value = "Alert test memo content";
            saveMemoButton.click(); // Save with a date selected
            assertEquals('メモを保存しました。', alertMessage, 'Alert message after successful save');

            window.alert = originalAlert; // Restore original alert function
        },
        'testInteractionBetweenCalendarsForSelectionAndMemo': function() {
            beforeEachMemoTest();
            currentDate = new Date(2023, 9, 1); // Current: Oct 2023, Next: Nov 2023
            if (typeof displayCalendars === "function") displayCalendars();

            const dateForNextMonthMemo = new Date(2023, 10, 7); // Month 10 is November
            const nextMonthMemoKey = formatDateToKey(dateForNextMonthMemo);
            localStorage.setItem(nextMonthMemoKey, "11月7日のメモ"); // Pre-save a memo for Nov 7

            simulateDateCellClick(currentMonthCalendarBody, 5); // Select Oct 5
            const oct5Cell = getCellByDayText(currentMonthCalendarBody, 5);
            assert(oct5Cell && oct5Cell.classList.contains('selected'), 'Oct 5 cell in current month should be selected');
            assertEquals('メモの対象日: 2023年10月5日', selectedDateDisplay.textContent, 'Selected date display for Oct 5');
            assertEquals('', memoInput.value, 'Memo input for Oct 5 (no memo) should be empty');

            assert(simulateDateCellClick(nextMonthCalendarBody, 7), 'Click on Nov 7 in next month calendar');
            
            assert(oct5Cell && !oct5Cell.classList.contains('selected'), 'Oct 5 cell (current month) should lose .selected class');
            const nov7Cell = getCellByDayText(nextMonthCalendarBody, 7);
            assert(nov7Cell && nov7Cell.classList.contains('selected'), 'Nov 7 cell in next month should be selected');
            assertEquals('メモの対象日: 2023年11月7日', selectedDateDisplay.textContent, 'Selected date display for Nov 7');
            assertEquals("11月7日のメモ", memoInput.value, 'Memo for Nov 7 should be loaded');
        }
    });

    // --- Restore original state after all tests ---
    currentDate = new Date(originalCurrentDate); 
    selectedDate = null; // Assuming selectedDate is a global in script.js that tests might alter
    if (typeof updateDayHeaders === "function") updateDayHeaders(); 
    if (typeof displayCalendars === "function") displayCalendars(); 
    if (typeof displayMemoForSelectedDate === "function") displayMemoForSelectedDate();
});
