function showAlert(msg, type = "info") {
    const alertBox = document.getElementById("authAlert");
    if (alertBox) {
        alertBox.className = `alert alert-${type}`;
        alertBox.textContent = msg;
        alertBox.classList.remove("hidden");
    } else {
        alert(msg);
    }
}

function getRolePage(role) {
    if (role === "Administrator") return "admin.html";
    if (role === "Laboratory Staff" || role === "Staff") return "staff.html";
    return "requester.html";
}

async function registerUser() {
    const fullnameInput = document.getElementById("fullname");
    const emailInput = document.getElementById("email");
    const roleInput = document.getElementById("role");

    if (!fullnameInput || !emailInput) {
        showAlert("Registration form missing required input fields.", "danger");
        return;
    }

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const role = roleInput ? roleInput.value : "Requester";

    if (!fullname || !email) {
        showAlert("Please enter both full name and email address to register.", "warning");
        return;
    }

    const { data: existingUser } = await appDB.getUserByEmail(email);
    if (existingUser) {
        existingUser.role = role;
        await appDB.updateUserRole(email, role);
        localStorage.setItem("user", JSON.stringify(existingUser));
        showAlert(`Account already registered. Role set to ${role}. Redirecting...`, "info");
        setTimeout(() => { window.location.href = getRolePage(role); }, 800);
        return;
    }

    const { data: newUser, error } = await appDB.addUser({ fullname, email, role });

    if (error) {
        showAlert("Registration failed: " + (error.message || error), "danger");
        return;
    }

    await appDB.addAuditLog({
        user_id: email,
        user_email: email,
        action: "USER_REGISTERED",
        module: "User",
        record_id: null,
        description: `New user registered: ${fullname} (${role})`
    });

    localStorage.setItem("user", JSON.stringify(newUser));
    showAlert("Registration successful! Redirecting to your role page...", "info");
    setTimeout(() => { window.location.href = getRolePage(newUser.role); }, 800);
}

async function login() {
    const emailInput = document.getElementById("email");
    const roleInput = document.getElementById("role");

    if (!emailInput) {
        showAlert("Email field not found in page.", "danger");
        return;
    }

    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
        showAlert("Please enter your email address.", "warning");
        return;
    }

    let { data: user } = await appDB.getUserByEmail(email);

    const selectedRole = roleInput ? roleInput.value : "Requester";

    if (!user) {
        const fallbackName = email.split("@")[0];
        let roleToAssign = selectedRole;
        if (email.includes("admin")) roleToAssign = "Administrator";
        if (email.includes("staff")) roleToAssign = "Laboratory Staff";

        const { data: createdUser } = await appDB.addUser({
            fullname: fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
            email: email,
            role: roleToAssign
        });
        user = createdUser;
    } else {
        if (email.includes("admin")) {
            user.role = "Administrator";
            await appDB.updateUserRole(email, "Administrator");
        } else if (email.includes("staff")) {
            user.role = "Laboratory Staff";
            await appDB.updateUserRole(email, "Laboratory Staff");
        } else if (roleInput && roleInput.value && roleInput.value !== "Requester") {
            user.role = roleInput.value;
            await appDB.updateUserRole(email, roleInput.value);
        }
    }

    localStorage.setItem("user", JSON.stringify(user));
    showAlert(`Welcome back, ${user.fullname}! Redirecting to ${user.role} page...`, "info");
    setTimeout(() => { window.location.href = getRolePage(user.role); }, 600);
}



