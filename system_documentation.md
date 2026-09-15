# Laboratory Asset and Service Management System
## System Documentation & Architecture Overview

---

### 1. Updated Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        uuid id PK
        string fullname
        string email UK
        string role
    }

    EQUIPMENT {
        bigint id PK
        string item_code UK
        string item_name
        string category
        string status
    }

    BORROWING_REQUESTS {
        bigint id PK
        string user_email FK
        string user_name
        string item_code FK
        string item_name
        string status
        string remarks
        timestamp created_at
        timestamp updated_at
    }

    AUDIT_LOGS {
        bigint id PK
        string user_id
        string user_email FK
        string action
        string module
        bigint record_id
        string description
        timestamp created_at
    }

    USERS ||--o{ BORROWING_REQUESTS : "submits"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    EQUIPMENT ||--o{ BORROWING_REQUESTS : "is requested in"
```

---

### 2. Use Case Diagram

```mermaid
graph TD
    subgraph System Boundary: Laboratory Asset Management
        UC1[Login & Authenticate]
        UC2[View Available Inventory]
        UC3[Submit Borrowing Request]
        UC4[View Personal History]
        UC5[Approve / Reject Requests]
        UC6[Release Approved Equipment]
        UC7[Process Equipment Return]
        UC8[Add New Equipment]
        UC9[Manage Equipment Maintenance]
        UC10[View System Audit Logs]
    end

    Requester(("Requester / Viewer"))
    Staff(("Laboratory Staff"))
    Admin(("Administrator"))

    Requester --> UC1
    Requester --> UC2
    Requester --> UC3
    Requester --> UC4

    Staff --> UC1
    Staff --> UC2
    Staff --> UC6
    Staff --> UC7
    Staff --> UC9

    Admin --> UC1
    Admin --> UC2
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
```

---

### 3. Role-Permission Matrix

| Functional Feature / Operation | Requester / Viewer | Laboratory Staff | Administrator |
| :--- | :---: | :---: | :---: |
| **Authenticate & Login** | Allowed | Allowed | Allowed |
| **View Equipment Inventory** | Allowed | Allowed | Allowed |
| **Submit Borrowing Request** | Allowed | Allowed | Allowed |
| **View Own Borrowing History** | Allowed | Allowed | Allowed |
| **Approve / Reject Borrow Requests** | Denied | Denied | Allowed |
| **Approve Own Borrow Request** | Denied | Denied | Denied (Blocked by BR-A4-02) |
| **Release Equipment to Borrower** | Denied | Allowed | Allowed |
| **Process Equipment Returns** | Denied | Allowed | Allowed |
| **Add New Inventory Items** | Denied | Denied | Allowed |
| **Set Equipment Maintenance Status** | Denied | Allowed | Allowed |
| **View System Audit Trail** | Denied | Denied | Allowed |

---

### 4. Workflow Diagram (Transaction & State Progression)

```mermaid
stateDiagram-v2
    [*] --> Available : Equipment Added to Inventory
    
    state "Borrowing Request Workflow" as RequestWorkflow {
        [*] --> Pending : Requester submits borrow request (BR-A4-01)
        
        Pending --> Rejected : Admin rejects request (BR-A4-03)
        Pending --> Approved : Admin approves request (BR-A4-02, BR-A4-03)
        
        Rejected --> [*] : Cannot be released (BR-A4-07)
        
        Approved --> Released : Staff/Admin releases equipment (BR-A4-04)
        note right of Released
            Equipment Status changes 
            from Available -> Borrowed (BR-A4-05)
        end note
        
        Released --> Returned : Borrower returns equipment
        note right of Returned
            Equipment Status changes 
            from Borrowed -> Available (BR-A4-06)
            OR Borrowed -> Maintenance (if damaged)
        end note
        
        Returned --> Closed : Process complete (BR-A4-08)
        Closed --> [*]
    }

    state "Equipment Maintenance Workflow" as MaintenanceWorkflow {
        Available --> Maintenance : Admin/Staff updates status (BR-A4-09)
        Maintenance --> Available : Maintenance resolved
    }
```

---

### 5. Business Rules Specification

| Rule ID | Rule Name | Enforced Behavior / Condition |
| :--- | :--- | :--- |
| **BR-A4-01** | Equipment Availability | Borrow requests can only be placed on equipment currently marked as `Available`. |
| **BR-A4-02** | Self-Approval Restriction | Administrators and Staff cannot approve their own submitted borrowing requests. |
| **BR-A4-03** | Approval Authority | Only users with the `Administrator` role are authorized to Approve or Reject pending borrowing requests. |
| **BR-A4-04** | Release Pre-requisite | Only requests in `Approved` status can be transitioned to `Released`. |
| **BR-A4-05** | Equipment State on Release | Releasing equipment automatically sets the corresponding equipment's inventory status to `Borrowed`. |
| **BR-A4-06** | Equipment State on Return | Returning equipment transitions the request to `Returned` and resets equipment status to `Available` (or `Maintenance` if flagged damaged). |
| **BR-A4-07** | Rejected Request Lockout | Requests in `Rejected` status are locked and can never be released. |
| **BR-A4-08** | Single Return Enforcement | A returned transaction (`Returned` / `Closed`) cannot be processed for return a second time. |
| **BR-A4-09** | Maintenance Lockout | Equipment with `Maintenance` status is excluded from the available request choices. |
| **BR-A4-10** | Audit Log Accountability | All critical system events (Request, Approval, Rejection, Release, Return, Asset Creation, Status Changes) must automatically generate an immutable entry in `audit_logs`. |
