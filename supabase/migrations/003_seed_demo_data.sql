insert into public.organizations (organization_id, organization_name, legal_name, industry)
values ('00000000-0000-0000-0000-000000000001', 'Demo Operations Group', 'Demo Operations Group LLC', 'F&B / QSR / Retail')
on conflict do nothing;

insert into public.locations (organization_id, location_code, location_name, brand_name, region, city, manager_name, status)
values
('00000000-0000-0000-0000-000000000001', 'DXB-001', 'Dubai Mall Flagship', 'Demo Brand', 'UAE', 'Dubai', 'Nadine Haddad', 'active'),
('00000000-0000-0000-0000-000000000001', 'BEY-002', 'Beirut Central Kitchen', 'Demo Brand', 'Lebanon', 'Beirut', 'Omar Chatila', 'active'),
('00000000-0000-0000-0000-000000000001', 'AMS-003', 'Amsterdam Central', 'Demo Brand EU', 'Netherlands', 'Amsterdam', 'Sanne De Vries', 'setup')
on conflict do nothing;
