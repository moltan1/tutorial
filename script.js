document.addEventListener('DOMContentLoaded', function() {
    const currentMonthYearDisplay = document.getElementById('current-month-year');
    const currentMonthCalendarBody = document.getElementById('current-month-calendar').querySelector('tbody');
    const nextMonthCalendarBody = document.getElementById('next-month-calendar').querySelector('tbody');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');

    let currentDate = new Date(); // This will be our reference for the "current" month view

    function generateCalendar(month, year, tableBody) {
        tableBody.innerHTML = ''; // Clear previous cells
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDay = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)

        // This specific line for header update is now in displayCalendars.
        // currentMonthYearDisplay.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;


        let date = 1;
        for (let i = 0; i < 6; i++) { // Max 6 rows for a month
            const row = document.createElement('tr');
            for (let j = 0; j < 7; j++) {
                const cell = document.createElement('td');
                if (i === 0 && j < startingDay) {
                    // Empty cells before the first day
                    cell.textContent = '';
                } else if (date > daysInMonth) {
                    // Empty cells after the last day
                    cell.textContent = '';
                } else {
                    cell.textContent = date;
                    const today = new Date();
                    if (date === today.getDate() && year === today.getFullYear() && month === today.getMonth()) {
                        cell.classList.add('today');
                    }
                    date++;
                }
                row.appendChild(cell);
            }
            tableBody.appendChild(row);
            if (date > daysInMonth && i >= Math.ceil((daysInMonth + startingDay) / 7) -1) { //Don't create unnecessary rows
                break;
            }
        }
    }

    function updateDayHeaders() {
        const dayNamesJapanese = ["日", "月", "火", "水", "木", "金", "土"];
        const currentCalendarTheads = document.getElementById('current-month-calendar').querySelectorAll('thead th');
        const nextCalendarTheads = document.getElementById('next-month-calendar').querySelectorAll('thead th');

        currentCalendarTheads.forEach((th, index) => {
            th.textContent = dayNamesJapanese[index];
        });
        nextCalendarTheads.forEach((th, index) => {
            th.textContent = dayNamesJapanese[index];
        });
    }

    function displayCalendars() {
        const currentMonth = currentDate.getMonth(); // 0-indexed
        const currentYear = currentDate.getFullYear();

        // Update header display to "YYYY年M月"
        // Japanese month names: 1月, 2月, ..., 12月
        const monthNamesJapanese = ["1月", "2月", "3月", "4月", "5月", "6月",
                                   "7月", "8月", "9月", "10月", "11月", "12月"];
        currentMonthYearDisplay.textContent = `${currentYear}年${monthNamesJapanese[currentMonth]}`;

        // Generate current month's calendar
        generateCalendar(currentMonth, currentYear, currentMonthCalendarBody);

        // Calculate next month
        let nextDisplayMonth = new Date(currentYear, currentMonth + 1, 1);
        generateCalendar(nextDisplayMonth.getMonth(), nextDisplayMonth.getFullYear(), nextMonthCalendarBody);
    }

    prevMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        displayCalendars();
    });

    nextMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        displayCalendars();
    });

    // Initial display
    updateDayHeaders(); // Update day headers to Japanese
    displayCalendars();
});
