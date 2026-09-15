create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    fullname text not null,
    email text unique not null,
    role text not null default 'Requester'
);

create table if not exists equipment (
    id bigint generated always as identity primary key,
    item_code text unique not null,
    item_name text not null,
    category text default 'General',
    status text not null default 'Available'
);

create table if not exists borrowing_requests (
    id bigint generated always as identity primary key,
    user_email text not null,
    user_name text,
    item_code text not null,
    item_name text not null,
    status text not null default 'Pending',
    remarks text,
    created_at timestamp default now(),
    updated_at timestamp default now()
);

create table if not exists audit_logs (
    id bigint generated always as identity primary key,
    user_id text,
    user_email text not null,
    action text not null,
    module text not null,
    record_id bigint,
    description text not null,
    created_at timestamp default now()
);

truncate table borrowing_requests, audit_logs, equipment, users restart identity cascade;

alter table users disable row level security;
alter table equipment disable row level security;
alter table borrowing_requests disable row level security;
alter table audit_logs disable row level security;

insert into users (fullname, email, role) values
('Admin User', 'admin@gmail.com', 'Administrator'),
('Lab Staff', 'staff@gmail.com', 'Laboratory Staff'),
('Ryel Maghanoy', 'ryel@gmail.com', 'Requester'),
('Maria Santos', 'maria@gmail.com', 'Requester');

insert into equipment (item_code, item_name, category, status) values
('LAP-001', 'Dell XPS Laptop', 'Laptops', 'Available'),
('LAP-002', 'HP ProBook', 'Laptops', 'Available'),
('PROJ-001', 'Epson HD Projector', 'AV Equipment', 'Available'),
('MON-001', 'Samsung 27" Monitor', 'Monitors', 'Maintenance'),
('PRN-001', 'Canon Laser Printer', 'Printers', 'Available');

insert into borrowing_requests (user_email, user_name, item_code, item_name, status) values
('ryel@gmail.com', 'Ryel Maghanoy', 'LAP-001', 'Dell XPS Laptop', 'Pending'),
('maria@gmail.com', 'Maria Santos', 'PROJ-001', 'Epson HD Projector', 'Approved');

insert into audit_logs (user_email, action, module, record_id, description) values
('admin@gmail.com', 'APPROVED', 'Borrowing', 2, 'Approved borrowing request for PROJ-001 (Epson HD Projector)'),
('admin@gmail.com', 'SYSTEM_INIT', 'System', null, 'System initialized with Laboratory 4 security policies');



