-- Add is_admin column to profiles table if it doesn't exist
alter table public.profiles 
add column if not exists is_admin boolean default false;

-- Assign admin privileges to the dev@gmail.com profile
update public.profiles
set is_admin = true
where lower(email) = 'dev@gmail.com';
