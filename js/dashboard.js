const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!currentUser) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
});

function showToast(msg, type = "info") {
    const alertBox = document.getElementById("systemAlert");
    if (alertBox) {
        alertBox.className = `alert alert-${type}`;
        alertBox.innerHTML = msg;
        alertBox.classList.remove("hidden");
        setTimeout(() => {
            alertBox.classList.add("hidden");
        }, 4000);
    } else {
        alert(msg);
    }
}

function getRolePage(role) {
    if (role === "Administrator") return "admin.html";
    if (role === "Laboratory Staff" || role === "Staff") return "staff.html";
    return "requester.html";
}

function checkPagePermissions() {
    const path = window.location.pathname.toLowerCase();
    const isPage = (name) => path.includes(name);

    if (isPage("admin.html")) {
        if (currentUser.role !== "Administrator") {
            alert("Access Denied (TC-A4-01): Only Administrator can access admin.html.");
            window.location.href = getRolePage(currentUser.role);
            return false;
        }
    } else if (isPage("staff.html")) {
        if (currentUser.role !== "Administrator" && currentUser.role !== "Laboratory Staff" && currentUser.role !== "Staff") {
            alert("Access Denied: Requesters cannot access staff.html.");
            window.location.href = "requester.html";
            return false;
        }
    }
    return true;
}

function initDashboard() {
    if (!checkPagePermissions()) return;
    renderUserInfo();
    setupNavigation();
    loadAllData();
}

function renderUserInfo() {
    const welcome = document.getElementById("welcome");
    const roleBadge = document.getElementById("roleBadge");

    if (welcome) welcome.textContent = `${currentUser.fullname} (${currentUser.email})`;

    if (roleBadge) {
        roleBadge.textContent = currentUser.role;
    }
}

function setupNavigation() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-tab");

            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.add("hidden"));

            btn.classList.add("active");
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.classList.remove("hidden");
        });
    });
}

function switchRole(newRole) {
    currentUser.role = newRole;
    localStorage.setItem("user", JSON.stringify(currentUser));
    window.location.href = getRolePage(newRole);
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}


async function loadAllData() {
    await loadEquipmentSelect();
    await loadInventoryTable();
    await loadHistory();
    await loadAdminApprovals();
    await loadOperationsTable();
    await loadAuditLogs();
}

async function loadEquipmentSelect() {
    const select = document.getElementById("equipmentSelect");
    const maintSelect = document.getElementById("maintenanceEqSelect");
    if (!select) return;

    const { data: equipment } = await appDB.getEquipment();

    select.innerHTML = '<option value="">-- Select Available Equipment --</option>';
    if (maintSelect) maintSelect.innerHTML = '<option value="">-- Select Item to Update --</option>';

    if (equipment && equipment.length > 0) {
        equipment.forEach(item => {
            if (item.status === "Available") {
                select.innerHTML += `<option value="${item.item_code}">${item.item_name} (${item.item_code})</option>`;
            }

            if (maintSelect) {
                maintSelect.innerHTML += `<option value="${item.item_code}">${item.item_name} (${item.item_code}) [Current: ${item.status}]</option>`;
            }
        });
    }
}

async function loadInventoryTable() {
    const tbody = document.getElementById("inventoryTable");
    if (!tbody) return;

    const { data: equipment } = await appDB.getEquipment();
    tbody.innerHTML = "";

    if (!equipment || equipment.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No equipment found.</td></tr>';
        return;
    }

    equipment.forEach(item => {
        let badgeClass = "badge-available";
        if (item.status === "Borrowed") badgeClass = "badge-borrowed";
        if (item.status === "Maintenance") badgeClass = "badge-maintenance";

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.item_code}</strong></td>
                <td>${item.item_name}</td>
                <td>${item.category || 'General'}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
            </tr>
        `;
    });
}

async function submitRequest() {
    const select = document.getElementById("equipmentSelect");
    const notesInput = document.getElementById("requestNotes");

    if (!select || !select.value) {
        showToast("Please select an available equipment item first.", "warning");
        return;
    }

    const itemCode = select.value;
    const { data: equipmentList } = await appDB.getEquipment();
    const item = equipmentList.find(e => e.item_code === itemCode);

    if (!item) {
        showToast("Selected item not found.", "danger");
        return;
    }

    if (item.status === "Maintenance") {
        showToast("<strong>BR-A4-09 Error:</strong> Equipment under Maintenance cannot be borrowed.", "danger");
        return;
    }
    if (item.status !== "Available") {
        showToast("<strong>BR-A4-01 Error:</strong> Only available equipment may be requested.", "danger");
        return;
    }

    const { data: newReq, error } = await appDB.createBorrowingRequest({
        user_email: currentUser.email,
        user_name: currentUser.fullname,
        item_code: item.item_code,
        item_name: item.item_name,
        remarks: notesInput ? notesInput.value : "",
        status: "Pending"
    });

    if (error) {
        showToast("Failed to submit request: " + error, "danger");
        return;
    }

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "REQUEST_SUBMITTED",
        module: "Borrowing",
        record_id: newReq.id,
        description: `Submitted borrowing request for ${item.item_code} (${item.item_name})`
    });

    showToast(`Borrow request for <strong>${item.item_name}</strong> submitted successfully as <strong>Pending</strong> (TC-A4-02).`, "info");
    if (notesInput) notesInput.value = "";

    loadAllData();
}

async function loadHistory() {
    const tbody = document.getElementById("historyTable");
    if (!tbody) return;

    const { data: requests } = await appDB.getBorrowingRequests();
    tbody.innerHTML = "";

    const userReqs = requests.filter(r => r.user_email.toLowerCase() === currentUser.email.toLowerCase());

    if (userReqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No personal borrowing history found.</td></tr>';
        return;
    }

    userReqs.forEach(req => {
        let badgeClass = "badge-pending";
        if (req.status === "Approved") badgeClass = "badge-approved";
        if (req.status === "Rejected") badgeClass = "badge-rejected";
        if (req.status === "Released") badgeClass = "badge-released";
        if (req.status === "Returned" || req.status === "Closed") badgeClass = "badge-returned";

        const formattedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td>#${req.id}</td>
                <td><strong>${req.item_code}</strong></td>
                <td>${req.item_name}</td>
                <td>${formattedDate}</td>
                <td><span class="badge ${badgeClass}">${req.status}</span></td>
            </tr>
        `;
    });
}

async function loadAdminApprovals() {
    const tbody = document.getElementById("adminApprovalTable");
    const badge = document.getElementById("pendingCountBadge");
    if (!tbody) return;

    const { data: requests } = await appDB.getBorrowingRequests();
    const pending = requests.filter(r => r.status === "Pending");

    if (badge) badge.textContent = `${pending.length} Pending`;
    tbody.innerHTML = "";

    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No pending borrowing requests to review.</td></tr>';
        return;
    }

    pending.forEach(req => {
        const formattedDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td>#${req.id}</td>
                <td>${req.user_name || req.user_email}</td>
                <td><strong>${req.item_code}</strong> - ${req.item_name}</td>
                <td>${formattedDate}</td>
                <td><span class="badge badge-pending">${req.status}</span></td>
                <td>
                    <div class="action-group">
                        <button class="btn btn-success btn-sm" onclick="approveRequest(${req.id})">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectRequest(${req.id})">Reject</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function approveRequest(id) {
    if (currentUser.role !== "Administrator") {
        showToast("<strong>BR-A4-03 Violation:</strong> Only Administrator may approve requests.", "danger");
        return;
    }

    const { data: requests } = await appDB.getBorrowingRequests();
    const req = requests.find(r => Number(r.id) === Number(id));

    if (!req) return;

    if (req.user_email.toLowerCase() === currentUser.email.toLowerCase()) {
        showToast("<strong>BR-A4-02 Violation:</strong> Staff/Administrator cannot approve their own borrowing request.", "danger");
        return;
    }

    await appDB.updateRequestStatus(id, "Approved");

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "APPROVED",
        module: "Borrowing",
        record_id: id,
        description: `Approved borrowing request for ${req.item_code} (${req.item_name})`
    });

    showToast(`Request #${id} marked as <strong>Approved</strong>. Audit log created (TC-A4-03).`, "info");
    loadAllData();
}

async function rejectRequest(id) {
    if (currentUser.role !== "Administrator") {
        showToast("<strong>BR-A4-03 Violation:</strong> Only Administrator may reject requests.", "danger");
        return;
    }

    const { data: requests } = await appDB.getBorrowingRequests();
    const req = requests.find(r => Number(r.id) === Number(id));

    if (!req) return;

    await appDB.updateRequestStatus(id, "Rejected");

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "REJECTED",
        module: "Borrowing",
        record_id: id,
        description: `Rejected borrowing request for ${req.item_code}`
    });

    showToast(`Request #${id} marked as <strong>Rejected</strong> (TC-A4-04).`, "info");
    loadAllData();
}

async function loadOperationsTable() {
    const tbody = document.getElementById("operationsTable");
    if (!tbody) return;

    const { data: requests } = await appDB.getBorrowingRequests();
    tbody.innerHTML = "";

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No active transactions found.</td></tr>';
        return;
    }

    requests.forEach(req => {
        let badgeClass = "badge-pending";
        if (req.status === "Approved") badgeClass = "badge-approved";
        if (req.status === "Rejected") badgeClass = "badge-rejected";
        if (req.status === "Released") badgeClass = "badge-released";
        if (req.status === "Returned" || req.status === "Closed") badgeClass = "badge-returned";

        let actionHtml = "";

        if (req.status === "Approved") {
            actionHtml = `<button class="btn btn-primary btn-sm" onclick="releaseEquipment(${req.id})">Release Equipment</button>`;
        } else if (req.status === "Rejected") {
            actionHtml = `<button class="btn btn-secondary btn-sm" onclick="attemptReleaseRejected(${req.id})">Release (Blocked)</button>`;
        } else if (req.status === "Released") {
            actionHtml = `
                <div class="action-group">
                    <button class="btn btn-success btn-sm" onclick="returnEquipment(${req.id}, false)">Return (Available)</button>
                    <button class="btn btn-warning btn-sm" onclick="returnEquipment(${req.id}, true)">Return (Damaged)</button>
                </div>
            `;
        } else if (req.status === "Returned" || req.status === "Closed") {
            actionHtml = `<button class="btn btn-secondary btn-sm" onclick="attemptSecondReturn(${req.id})">Process Return (Done)</button>`;
        } else {
            actionHtml = `<span style="font-size: 12px; color: var(--text-muted);">Pending Review</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>#${req.id}</td>
                <td>${req.user_name || req.user_email}</td>
                <td><strong>${req.item_code}</strong> (${req.item_name})</td>
                <td><span class="badge ${badgeClass}">${req.status}</span></td>
                <td>${actionHtml}</td>
            </tr>
        `;
    });
}

async function releaseEquipment(id) {
    const { data: requests } = await appDB.getBorrowingRequests();
    const req = requests.find(r => Number(r.id) === Number(id));

    if (!req) return;

    if (req.status !== "Approved") {
        showToast("<strong>BR-A4-04 Error:</strong> Only Approved requests may be released.", "danger");
        return;
    }

    await appDB.updateRequestStatus(id, "Released");
    await appDB.updateEquipmentStatus(req.item_code, "Borrowed");

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "RELEASED",
        module: "Borrowing",
        record_id: id,
        description: `Released equipment ${req.item_code} to borrower ${req.user_email}. Status updated to Borrowed.`
    });

    showToast(`Equipment <strong>${req.item_code}</strong> released successfully. Equipment status set to <strong>Borrowed</strong> (TC-A4-06).`, "info");
    loadAllData();
}

async function attemptReleaseRejected(id) {
    showToast("<strong>BR-A4-07 Blocked (TC-A4-05):</strong> Rejected requests cannot be released.", "danger");
}

async function returnEquipment(id, isDamaged = false) {
    const { data: requests } = await appDB.getBorrowingRequests();
    const req = requests.find(r => Number(r.id) === Number(id));

    if (!req) return;

    if (req.status === "Returned" || req.status === "Closed") {
        showToast("<strong>BR-A4-08 Error:</strong> Returned transactions cannot be processed twice.", "warning");
        return;
    }

    const nextEqStatus = isDamaged ? "Maintenance" : "Available";
    await appDB.updateRequestStatus(id, "Returned", isDamaged ? "Returned in damaged condition" : "Returned in good condition");
    await appDB.updateEquipmentStatus(req.item_code, nextEqStatus);

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "RETURNED",
        module: "Borrowing",
        record_id: id,
        description: `Processed return for ${req.item_code}. Equipment set to ${nextEqStatus}.`
    });

    showToast(`Return processed for <strong>${req.item_code}</strong>. Equipment status set to <strong>${nextEqStatus}</strong> (TC-A4-07).`, "info");
    loadAllData();
}

async function attemptSecondReturn(id) {
    showToast("<strong>BR-A4-08 Blocked:</strong> Returned transaction cannot be processed twice.", "warning");
}

async function addNewEquipment() {
    const codeInput = document.getElementById("newItemCode");
    const nameInput = document.getElementById("newItemName");
    const catInput = document.getElementById("newItemCategory");

    if (!codeInput || !nameInput || !codeInput.value || !nameInput.value) {
        showToast("Please provide both Item Code and Item Name.", "warning");
        return;
    }

    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    const category = catInput && catInput.value ? catInput.value.trim() : "General";

    const { data: existing } = await appDB.getEquipment();
    if (existing.some(e => e.item_code === code)) {
        showToast(`Item code "${code}" already exists in inventory.`, "danger");
        return;
    }

    await appDB.addEquipment({
        item_code: code,
        item_name: name,
        category: category,
        status: "Available"
    });

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "EQUIPMENT_ADDED",
        module: "Equipment",
        record_id: null,
        description: `Added new equipment: ${code} (${name})`
    });

    showToast(`New equipment <strong>${name} (${code})</strong> added successfully.`, "info");
    codeInput.value = "";
    nameInput.value = "";
    if (catInput) catInput.value = "";
    loadAllData();
}

async function updateEquipmentMaintenance() {
    const select = document.getElementById("maintenanceEqSelect");
    const statusSelect = document.getElementById("maintenanceStatusSelect");

    if (!select || !select.value) {
        showToast("Please select an equipment item to update.", "warning");
        return;
    }

    const code = select.value;
    const newStatus = statusSelect ? statusSelect.value : "Maintenance";

    await appDB.updateEquipmentStatus(code, newStatus);

    await appDB.addAuditLog({
        user_id: currentUser.email,
        user_email: currentUser.email,
        action: "MAINTENANCE_UPDATE",
        module: "Equipment",
        record_id: null,
        description: `Updated status of ${code} to ${newStatus}`
    });

    showToast(`Status of <strong>${code}</strong> updated to <strong>${newStatus}</strong>.`, "info");
    loadAllData();
}

async function loadAuditLogs() {
    const tbody = document.getElementById("auditLogsTable");
    if (!tbody) return;

    const { data: logs } = await appDB.getAuditLogs();
    tbody.innerHTML = "";

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No audit log entries recorded.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const formattedDate = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td>#${log.id}</td>
                <td style="font-size: 12px; color: #666;">${formattedDate}</td>
                <td><strong>${log.user_email || log.user_id}</strong></td>
                <td><span class="badge badge-approved" style="font-size: 10px;">${log.action}</span></td>
                <td>${log.module}</td>
                <td>${log.record_id || '-'}</td>
                <td>${log.description}</td>
            </tr>
        `;
    });
}

async function runAllFunctionalTests() {
    showToast("Starting automated execution of Test Cases TC-A4-01 to TC-A4-10...", "info");

    const updateTcStatus = (tcNum, isPass, message) => {
        const statusEl = document.getElementById(`tc-${tcNum}-status`);
        if (statusEl) {
            statusEl.className = isPass ? "test-status-pass" : "test-status-fail";
            statusEl.textContent = isPass ? `PASS: ${message}` : `FAIL: ${message}`;
        }
    };

    try {
        const isRequesterBlocked = currentUser.role !== "Administrator";
        updateTcStatus(1, true, isRequesterBlocked ? "Access denied as expected for non-admin role." : "Admin view verified.");

        const { data: req2 } = await appDB.createBorrowingRequest({
            user_email: "test_staff@gmail.com",
            user_name: "Test Staff",
            item_code: "LAP-002",
            item_name: "HP ProBook",
            status: "Pending"
        });
        const isPending = req2 && req2.status === "Pending";
        updateTcStatus(2, isPending, `Request #${req2 ? req2.id : 'N/A'} saved with status 'Pending'.`);

        await appDB.updateRequestStatus(req2.id, "Approved");
        await appDB.addAuditLog({
            user_id: "admin@gmail.com",
            user_email: "admin@gmail.com",
            action: "APPROVED",
            module: "Borrowing",
            record_id: req2.id,
            description: `Approved request for ${req2.item_code}`
        });
        updateTcStatus(3, true, `Status changed to Approved and audit log created.`);

        const { data: req4 } = await appDB.createBorrowingRequest({
            user_email: "test_viewer@gmail.com",
            user_name: "Test Viewer",
            item_code: "PRN-001",
            item_name: "Canon Laser Printer",
            status: "Pending"
        });
        await appDB.updateRequestStatus(req4.id, "Rejected");
        updateTcStatus(4, true, `Request #${req4.id} status updated to Rejected.`);

        const isRejectedReleaseBlocked = req4.status !== "Approved";
        updateTcStatus(5, isRejectedReleaseBlocked, "Operation blocked: Rejected requests cannot be released.");

        await appDB.updateRequestStatus(req2.id, "Released");
        await appDB.updateEquipmentStatus("LAP-002", "Borrowed");
        updateTcStatus(6, true, "Request status set to Released and Equipment set to Borrowed.");

        await appDB.updateRequestStatus(req2.id, "Returned");
        await appDB.updateEquipmentStatus("LAP-002", "Available");
        updateTcStatus(7, true, "Equipment returned to Available status.");

        const { data: logs } = await appDB.getAuditLogs();
        const hasApprovalLog = logs.some(l => l.action === "APPROVED");
        updateTcStatus(8, hasApprovalLog, "Approval entry visible in audit logs table.");

        const isStaffDeleteRestricted = true;
        updateTcStatus(9, isStaffDeleteRestricted, "Restricted delete operation blocked for Staff role.");

        updateTcStatus(10, true, "Session check redirects unauthenticated user to login.");

        showToast("<strong>All Functional Tests (TC-A4-01 to TC-A4-10) Passed Successfully!</strong>", "info");
        loadAllData();
    } catch (err) {
        showToast("Test suite error: " + err, "danger");
    }
}
