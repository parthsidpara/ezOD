function getDuration(dayTime) {
    if (!dayTime) return 0;

    let timeString = dayTime;
    if (dayTime.includes(',')) {
        const parts = dayTime.split(',');
        timeString = parts[1].trim();
    }

    const times = timeString.split('-').map(part => part.trim());
    if (times.length !== 2) return 0;

    const startTime = times[0];
    const endTime = times[1];

    const startDate = new Date(`1970/01/01 ${startTime}`);
    const endDate = new Date(`1970/01/01 ${endTime}`);

    let diff = (endDate - startDate) / 60000; // ms to minutes

    if (diff < 0) {
        diff += 24 * 60;
    }

    return diff;
}


async function checkAllCoursesForOnDuty() {
    // get all the class IDs and slot names
    const courseInfo = [];
    document.querySelectorAll(".table tr:not(:first-child)").forEach(row => {
        const viewButton = row.querySelector("a.btn-link");
        if (viewButton) {
            const onClickAttr = viewButton.getAttribute("onclick");
            const match = onClickAttr.match(/processViewAttendanceDetail\('([^']+)',\s*'([^']+)'\)/);
            if (match) {
                courseInfo.push({
                    classId: match[1],
                    slotName: match[2],
                    courseCode: row.querySelector("td:nth-child(2) p")?.textContent.trim(),
                    courseTitle: row.querySelector("td:nth-child(3) p")?.textContent.trim()
                });
            }
        }
    });

    console.log(`Found ${courseInfo.length} courses to check`);

    const csrfToken = document.querySelector("input[name='_csrf']")?.value;
    const authorizedID = document.querySelector("input#authorizedID")?.value;

    if (!csrfToken || !authorizedID) {
        console.error("Could not find CSRF token or authorizedID");
        return [];
    }

    const onDutyEntries = [];

    // check a single course
    async function checkCourse(course) {
        console.log(`Checking course: ${course.courseCode} - ${course.courseTitle}`);

        const formData = new FormData();
        formData.append("_csrf", csrfToken);
        formData.append("classId", course.classId);
        formData.append("slotName", course.slotName);
        formData.append("authorizedID", authorizedID);
        formData.append("x", new Date().toUTCString());

        const response = await fetch("processViewAttendanceDetail", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            console.error(`Failed to fetch details for ${course.courseCode}`);
            return;
        }

        const html = await response.text();

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        const attendanceRows = tempDiv.querySelectorAll(".table tr:not(:first-child)");
        console.log(`Found ${attendanceRows.length} attendance entries for ${course.courseCode}`);

        attendanceRows.forEach(row => {
            const date = row.querySelector("td:nth-child(2)")?.textContent.trim();
            const dayTime = row.querySelector("td:nth-child(4) p")?.textContent.trim();
            const statusCell = row.querySelector("td:nth-child(5)");
            const status = statusCell?.textContent.trim();

            if (status && status.includes("On Duty")) {
                const duration = getDuration(dayTime);
                // OD count: less than 60 minutes(theory slot) => 1, 60 or more minutes(labs) => 2.
                const odCount = (duration < 60) ? 1 : 2;

                onDutyEntries.push({
                    courseCode: course.courseCode,
                    courseTitle: course.courseTitle,
                    slot: course.slotName,
                    date,
                    dayTime,
                    status,
                    odCount
                });

                console.log(`Found On Duty: ${course.courseCode} on ${date} (${dayTime}) with duration ${duration} minutes, OD Count: ${odCount}`);
            }
        });
    }

    // process all courses
    for (const course of courseInfo) {
        await checkCourse(course);
        // small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // results in console
    console.log("=== ON DUTY ATTENDANCE SUMMARY ===");
    if (onDutyEntries.length === 0) {
        console.log("No 'On Duty' entries found in any course");
    } else {
        console.log(`Found ${onDutyEntries.length} 'On Duty' entries:`);
        onDutyEntries.forEach((entry, index) => {
            console.log(`${index + 1}. ${entry.courseCode} - ${entry.courseTitle}`);
            console.log(`   Date: ${entry.date}, Time: ${entry.dayTime}`);
            console.log(`   Status: ${entry.status}`);
            console.log(`   OD Count: ${entry.odCount}`);
            console.log("---");
        });
    }

    displayOnDutyTable(onDutyEntries);

    return onDutyEntries;
}

// display the OD table
function displayOnDutyTable(entries) {
    const container = document.querySelector(".table-responsive");
    if (!container) {
        console.error("Could not find .table-responsive container");
        return;
    }

    const existingTable = document.getElementById("onDutyTableContainer");
    if (existingTable) {
        existingTable.remove();
    }

    const tableContainer = document.createElement("div");
    tableContainer.id = "onDutyTableContainer";
    tableContainer.classList.add("mt-4");

    const heading = document.createElement("h4");
    heading.textContent = "OD Summary";
    heading.classList.add("mb-2", "text-primary");
    tableContainer.appendChild(heading);

    const table = document.createElement("table");
    table.id = "onDutyTable";
    table.className = "table table-bordered table-striped";

    table.innerHTML = `
      <thead class="thead-dark">
        <tr>
          <th>#</th>
          <th>Course Code</th>
          <th>Course Title</th>
          <th>Slot</th>
          <th>Date</th>
          <th>Day/Time</th>
          <th>Status</th>
          <th>OD Count</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;

    const tbody = table.querySelector("tbody");
    let totalOdCount = 0;

    entries.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${index + 1}</td>
        <td>${entry.courseCode}</td>
        <td>${entry.courseTitle}</td>
        <td>${entry.slot}</td>
        <td>${entry.date}</td>
        <td>${entry.dayTime}</td>
        <td>${entry.status}</td>
        <td>${entry.odCount}</td>
      `;
        tbody.appendChild(row);
        totalOdCount += entry.odCount;
    });

    tableContainer.appendChild(table);

    const summaryDiv = document.createElement("div");
    summaryDiv.className = "mt-2 font-weight-bold";
    summaryDiv.innerHTML = `<p>Total OD Count: <span class="text-danger">${totalOdCount}</span></p>`;
    tableContainer.appendChild(summaryDiv);

    container.appendChild(tableContainer);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateODSummary') {
        checkAllCoursesForOnDuty()
            .then(results => {
                sendResponse({ success: true, results });
            })
            .catch(error => {
                console.error('Error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; 
    }
});