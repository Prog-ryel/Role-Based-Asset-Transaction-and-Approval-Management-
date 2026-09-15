const supabaseUrl = "https://wgvqicckwbpsezhedbnn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndnFpY2Nrd2Jwc2V6aGVkYm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MzQyNTksImV4cCI6MjEwNTAxMDI1OX0.QynBR5ZVlVrkAg5zmVqB8yJo-yqIJ1rmwS2cIxivJdw";

const isConfigured = Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes("PASTE_") &&
    !supabaseKey.includes("PASTE_")
);

window.supabaseClient = null;

if (window.supabase && isConfigured) {
    try {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    } catch (e) {}
}

const supabaseClient = window.supabaseClient;

const DEFAULT_SEED_DATA = {
    users: [
        { id: "11111111-1111-1111-1111-111111111111", fullname: "Admin User", email: "admin@gmail.com", role: "Administrator" },
        { id: "22222222-2222-2222-2222-222222222222", fullname: "Lab Staff", email: "staff@gmail.com", role: "Laboratory Staff" },
        { id: "33333333-3333-3333-3333-333333333333", fullname: "Ryel Maghanoy", email: "ryel@gmail.com", role: "Requester" },
        { id: "44444444-4444-4444-4444-444444444444", fullname: "Maria Santos", email: "maria@gmail.com", role: "Requester" }
    ],
    equipment: [
        { id: 1, item_code: "LAP-001", item_name: "Dell XPS Laptop", category: "Laptops", status: "Available" },
        { id: 2, item_code: "LAP-002", item_name: "HP ProBook", category: "Laptops", status: "Available" },
        { id: 3, item_code: "PROJ-001", item_name: "Epson HD Projector", category: "AV Equipment", status: "Available" },
        { id: 4, item_code: "MON-001", item_name: "Samsung 27\" Monitor", category: "Monitors", status: "Maintenance" },
        { id: 5, item_code: "PRN-001", item_name: "Canon Laser Printer", category: "Printers", status: "Available" }
    ],
    borrowing_requests: [
        { id: 101, user_email: "ryel@gmail.com", user_name: "Ryel Maghanoy", item_code: "LAP-001", item_name: "Dell XPS Laptop", status: "Pending", created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 102, user_email: "maria@gmail.com", user_name: "Maria Santos", item_code: "PROJ-001", item_name: "Epson HD Projector", status: "Approved", created_at: new Date(Date.now() - 7200000).toISOString() }
    ],
    audit_logs: [
        { id: 1, user_id: "admin@gmail.com", user_email: "admin@gmail.com", action: "APPROVED", module: "Borrowing", record_id: 102, description: "Approved borrowing request for LAP-001", created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, user_id: "admin@gmail.com", user_email: "admin@gmail.com", action: "SYSTEM_INIT", module: "System", record_id: null, description: "System initialized with Laboratory 4 security policies", created_at: new Date().toISOString() }
    ]
};

(function initLocalStorage() {
    Object.keys(DEFAULT_SEED_DATA).forEach(table => {
        const stored = localStorage.getItem(`lab4_${table}`);
        if (!stored) {
            localStorage.setItem(`lab4_${table}`, JSON.stringify(DEFAULT_SEED_DATA[table]));
        }
    });

    const users = JSON.parse(localStorage.getItem("lab4_users") || "[]");
    const admin = users.find(u => u.email === "admin@gmail.com");
    if (admin && admin.role !== "Administrator") {
        admin.role = "Administrator";
        localStorage.setItem("lab4_users", JSON.stringify(users));
    }
    const staff = users.find(u => u.email === "staff@gmail.com");
    if (staff && staff.role !== "Laboratory Staff") {
        staff.role = "Laboratory Staff";
        localStorage.setItem("lab4_users", JSON.stringify(users));
    }
})();


const appDB = {
    getLocal(table) {
        try {
            return JSON.parse(localStorage.getItem(`lab4_${table}`) || "[]");
        } catch (e) {
            return [];
        }
    },
    setLocal(table, data) {
        localStorage.setItem(`lab4_${table}`, JSON.stringify(data));
    },

    async getUsers() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("users").select("*");
                if (!error && data && data.length > 0) return { data, error: null };
            } catch (e) {}
        }
        return { data: this.getLocal("users"), error: null };
    },

    async getUserByEmail(email) {
        const normalized = email.trim().toLowerCase();
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("users").select("*").eq("email", normalized).limit(1);
                if (!error && data && data.length > 0) return { data: data[0], error: null };
            } catch (e) {}
        }
        const users = this.getLocal("users");
        const found = users.find(u => u.email.toLowerCase() === normalized);
        return { data: found || null, error: found ? null : "User not found" };
    },

    async updateUserRole(email, role) {
        const normalized = email.trim().toLowerCase();
        if (supabaseClient) {
            try {
                await supabaseClient.from("users").update({ role }).eq("email", normalized);
            } catch (e) {}
        }
        const users = this.getLocal("users");
        const target = users.find(u => u.email.toLowerCase() === normalized);
        if (target) {
            target.role = role;
            this.setLocal("users", users);
        }
    },


    async addUser(userObj) {
        userObj.email = userObj.email.trim().toLowerCase();
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("users").insert([userObj]).select();
                if (!error && data && data.length > 0) return { data: data[0], error: null };
            } catch (e) {}
        }
        const users = this.getLocal("users");
        if (users.some(u => u.email.toLowerCase() === userObj.email)) {
            return { data: null, error: { message: "Email already registered" } };
        }
        const newUser = { id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`, ...userObj };
        users.push(newUser);
        this.setLocal("users", users);
        return { data: newUser, error: null };
    },

    async getEquipment() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("equipment").select("*").order("id", { ascending: true });
                if (!error && data && data.length > 0) return { data, error: null };
            } catch (e) {}
        }
        return { data: this.getLocal("equipment"), error: null };
    },

    async updateEquipmentStatus(code, status) {
        if (supabaseClient) {
            try {
                await supabaseClient.from("equipment").update({ status }).eq("item_code", code);
            } catch (e) {}
        }
        const eqList = this.getLocal("equipment");
        const item = eqList.find(e => e.item_code === code);
        if (item) {
            item.status = status;
            this.setLocal("equipment", eqList);
        }
    },

    async addEquipment(eqObj) {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("equipment").insert([eqObj]).select();
                if (!error && data && data.length > 0) return { data: data[0], error: null };
            } catch (e) {}
        }
        const list = this.getLocal("equipment");
        const newEq = { id: Date.now(), ...eqObj };
        list.push(newEq);
        this.setLocal("equipment", list);
        return { data: newEq, error: null };
    },

    async getBorrowingRequests() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("borrowing_requests").select("*").order("id", { ascending: false });
                if (!error && data) return { data, error: null };
            } catch (e) {}
        }
        return { data: this.getLocal("borrowing_requests"), error: null };
    },

    async createBorrowingRequest(reqObj) {
        reqObj.created_at = new Date().toISOString();
        reqObj.status = "Pending";
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("borrowing_requests").insert([reqObj]).select();
                if (!error && data && data.length > 0) return { data: data[0], error: null };
            } catch (e) {}
        }
        const reqs = this.getLocal("borrowing_requests");
        const newReq = { id: Date.now(), ...reqObj };
        reqs.unshift(newReq);
        this.setLocal("borrowing_requests", reqs);
        return { data: newReq, error: null };
    },

    async updateRequestStatus(id, status, remarks = "") {
        if (supabaseClient) {
            try {
                await supabaseClient.from("borrowing_requests").update({ status, remarks, updated_at: new Date().toISOString() }).eq("id", id);
            } catch (e) {}
        }
        const reqs = this.getLocal("borrowing_requests");
        const target = reqs.find(r => Number(r.id) === Number(id));
        if (target) {
            target.status = status;
            target.remarks = remarks;
            target.updated_at = new Date().toISOString();
            this.setLocal("borrowing_requests", reqs);
        }
    },

    async deleteBorrowingRequest(id) {
        if (supabaseClient) {
            try {
                await supabaseClient.from("borrowing_requests").delete().eq("id", id);
            } catch (e) {}
        }
        let reqs = this.getLocal("borrowing_requests");
        reqs = reqs.filter(r => Number(r.id) !== Number(id));
        this.setLocal("borrowing_requests", reqs);
    },

    async getAuditLogs() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from("audit_logs").select("*").order("created_at", { ascending: false });
                if (!error && data) return { data, error: null };
            } catch (e) {}
        }
        return { data: this.getLocal("audit_logs"), error: null };
    },

    async addAuditLog(logObj) {
        logObj.created_at = new Date().toISOString();
        if (supabaseClient) {
            try {
                await supabaseClient.from("audit_logs").insert([logObj]);
            } catch (e) {}
        }
        const logs = this.getLocal("audit_logs");
        const newLog = { id: Date.now(), ...logObj };
        logs.unshift(newLog);
        this.setLocal("audit_logs", logs);
        return { data: newLog, error: null };
    },

    resetLocalSeed() {
        Object.keys(DEFAULT_SEED_DATA).forEach(table => {
            localStorage.setItem(`lab4_${table}`, JSON.stringify(DEFAULT_SEED_DATA[table]));
        });
    }
};

window.appDB = appDB;
