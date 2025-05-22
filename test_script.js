document.addEventListener('DOMContentLoaded', function() {
    const testResultsContainer = document.getElementById('test-results');
    const originalCurrentDate = new Date(currentDate); // Save original state from script.js

    // --- Test Helper Functions ---
    function runTestSuite(suiteName, tests) {
        let successes = 0;
        let failures = 0;
        let suiteHtml = `<div class="test-suite"><h3>${suiteName}</h3>`;

        for (const testName in tests) {
            let result = false;
            let errorMsg = '';
            try {
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

    // --- Mocking and Setup ---
    // Get DOM elements from test.html (which includes script.js's elements)
    const currentMonthYearDisplay = document.getElementById('current-month-year');
    const currentMonthCalendarBody = document.getElementById('current-month-calendar').querySelector('tbody');
    const nextMonthCalendarBody = document.getElementById('next-month-calendar').querySelector('tbody');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');

    // --- Test Suites ---

    // Test Suite 1: Calendar Generation Logic
    // Note: We are testing the generateCalendar function from script.js
    runTestSuite('Calendar Generation Logic', {
        'testDaysInJanuary2024': function() {
            // January 2024: 31 days, starts on a Monday (day 1)
            currentDate = new Date(2024, 0, 15); // Set script.js's global date
            generateCalendar(0, 2024, currentMonthCalendarBody); // month (0-indexed), year, tableBody
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(31, dayCells.length, 'Number of days in January 2024');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(2)'); // Monday
            assertEquals('1', firstDayCell.textContent, 'January 2024 should start on Monday');
        },
        'testDaysInFebruary2024Leap': function() {
            // February 2024 (leap year): 29 days, starts on Thursday (day 4)
            currentDate = new Date(2024, 1, 15);
            generateCalendar(1, 2024, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(29, dayCells.length, 'Number of days in February 2024 (leap)');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(5)'); // Thursday
            assertEquals('1', firstDayCell.textContent, 'February 2024 should start on Thursday');
        },
        'testDaysInFebruary2023NonLeap': function() {
            // February 2023 (non-leap): 28 days, starts on Wednesday (day 3)
            currentDate = new Date(2023, 1, 15);
            generateCalendar(1, 2023, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(28, dayCells.length, 'Number of days in February 2023');
             const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(4)'); // Wednesday
            assertEquals('1', firstDayCell.textContent, 'February 2023 should start on Wednesday');
        },
        'testDaysInSeptember2023': function() {
            // September 2023: 30 days, starts on Friday (day 5)
            currentDate = new Date(2023, 8, 15);
            generateCalendar(8, 2023, currentMonthCalendarBody);
            const dayCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(30, dayCells.length, 'Number of days in September 2023');
            const firstDayCell = currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(6)'); // Friday
            assertEquals('1', firstDayCell.textContent, 'September 2023 should start on Friday');
        },
        'testTodayHighlighting': function() {
            const today = new Date();
            currentDate = new Date(today.getFullYear(), today.getMonth(), 1); // Set to current month
            generateCalendar(today.getMonth(), today.getFullYear(), currentMonthCalendarBody);
            const todayCell = Array.from(currentMonthCalendarBody.querySelectorAll('td')).find(td => td.textContent === String(today.getDate()));
            assert(todayCell && todayCell.classList.contains('today'), "Today's date should be highlighted");
        }
    });

    // Test Suite 2: Navigation Logic
    // We'll simulate clicks and check the global currentDate and header in script.js
    runTestSuite('Navigation and Display Logic', {
        'testJapaneseDayHeaders': function() {
            // Ensure updateDayHeaders has been called (it's called on DOMContentLoaded in script.js)
            // For an isolated test, we can call it again if needed, but it should have already run.
            // Or, if script.js wasn't loaded, we'd call it: if (typeof updateDayHeaders === "function") updateDayHeaders();
            
            const expectedDayNames = ["日", "月", "火", "水", "木", "金", "土"];
            const currentCalendarTheads = document.getElementById('current-month-calendar').querySelectorAll('thead th');
            const nextCalendarTheads = document.getElementById('next-month-calendar').querySelectorAll('thead th');

            currentCalendarTheads.forEach((th, index) => {
                assertEquals(expectedDayNames[index], th.textContent, `Current calendar day header ${index} should be ${expectedDayNames[index]}`);
            });
            nextCalendarTheads.forEach((th, index) => {
                assertEquals(expectedDayNames[index], th.textContent, `Next calendar day header ${index} should be ${expectedDayNames[index]}`);
            });
        },
        'testInitialDisplay': function() {
            currentDate = new Date(2023, 9, 15); // October 15, 2023
            // updateDayHeaders(); // Called at startup by script.js
            displayCalendars(); // This function is from script.js

            assertEquals('2023年10月', currentMonthYearDisplay.textContent, 'Header displays initial month and year in Japanese format');
            // Check current month calendar (October 2023)
            const currentCalCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(31, currentCalCells.length, 'Initial current calendar (Oct 2023) days');
            assertEquals('1', currentMonthCalendarBody.querySelector('tr:first-child td:first-child').textContent, 'Oct 2023 starts on Sunday');


            // Check next month calendar (November 2023)
            const nextCalCells = Array.from(nextMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(30, nextCalCells.length, 'Initial next calendar (Nov 2023) days');
            assertEquals('1', nextMonthCalendarBody.querySelector('tr:first-child td:nth-child(4)').textContent, 'Nov 2023 starts on Wednesday');
        },
        'testNextMonthButton': function() {
            currentDate = new Date(2023, 9, 15); // October 15, 2023
            // updateDayHeaders();
            displayCalendars(); // Set initial state

            nextMonthButton.click(); // Simulate click
            assertEquals('2023年11月', currentMonthYearDisplay.textContent, 'Header after next click in Japanese format');
            assertEquals(10, currentDate.getMonth(), 'Internal month after next click (0-indexed for November)');
            assertEquals(2023, currentDate.getFullYear(), 'Internal year after next click');

            // Check current month calendar (November 2023)
            const currentCalCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(30, currentCalCells.length, 'Current calendar (Nov 2023) after next click');
            assertEquals('1', currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(4)').textContent, 'Nov 2023 starts on Wednesday');

            // Check next month calendar (December 2023)
            const nextCalCells = Array.from(nextMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(31, nextCalCells.length, 'Next calendar (Dec 2023) after next click');
            assertEquals('1', nextMonthCalendarBody.querySelector('tr:first-child td:nth-child(6)').textContent, 'Dec 2023 starts on Friday');
        },
        'testPrevMonthButton': function() {
            currentDate = new Date(2023, 9, 15); // October 15, 2023
            // updateDayHeaders();
            displayCalendars(); // Set initial state

            prevMonthButton.click(); // Simulate click
            assertEquals('2023年9月', currentMonthYearDisplay.textContent, 'Header after prev click in Japanese format');
            assertEquals(8, currentDate.getMonth(), 'Internal month after prev click (0-indexed for September)');
            assertEquals(2023, currentDate.getFullYear(), 'Internal year after prev click');

             // Check current month calendar (September 2023)
            const currentCalCells = Array.from(currentMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(30, currentCalCells.length, 'Current calendar (Sep 2023) after prev click');
            assertEquals('1', currentMonthCalendarBody.querySelector('tr:first-child td:nth-child(6)').textContent, 'Sep 2023 starts on Friday');

            // Check next month calendar (October 2023)
            const nextCalCells = Array.from(nextMonthCalendarBody.querySelectorAll('td')).filter(td => td.textContent !== '');
            assertEquals(31, nextCalCells.length, 'Next calendar (Oct 2023) after prev click');
            assertEquals('1', nextMonthCalendarBody.querySelector('tr:first-child td:first-child').textContent, 'Oct 2023 starts on Sunday');
        },
        'testMonthRolloverDecemberToJanuary': function() {
            currentDate = new Date(2023, 11, 15); // December 15, 2023
            // updateDayHeaders();
            displayCalendars();

            nextMonthButton.click();
            assertEquals('2024年1月', currentMonthYearDisplay.textContent, 'Header after Dec to Jan rollover in Japanese format');
            assertEquals(0, currentDate.getMonth(), 'Internal month after Dec to Jan (January)');
            assertEquals(2024, currentDate.getFullYear(), 'Internal year after Dec to Jan');
        },
        'testMonthRolloverJanuaryToDecember': function() {
            currentDate = new Date(2024, 0, 15); // January 15, 2024
            // updateDayHeaders();
            displayCalendars();

            prevMonthButton.click();
            assertEquals('2023年12月', currentMonthYearDisplay.textContent, 'Header after Jan to Dec rollover in Japanese format');
            assertEquals(11, currentDate.getMonth(), 'Internal month after Jan to Dec (December)');
            assertEquals(2023, currentDate.getFullYear(), 'Internal year after Jan to Dec');
        }
    });

    // --- Restore original state ---
    // This ensures that if tests are run multiple times or other scripts interact,
    // the calendar returns to a known state.
    currentDate = new Date(originalCurrentDate); // Restore original date from script.js state
    if (typeof updateDayHeaders === "function") updateDayHeaders(); // Ensure headers are in original state if they were changed by tests (not in this case, but good practice)
    if (typeof displayCalendars === "function") displayCalendars(); // Refresh calendar display
});
