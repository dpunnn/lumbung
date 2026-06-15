DELETE FROM users
WHERE email LIKE '%@harapan.test'
   OR email LIKE '%@padiwangi.test'
   OR email = 'admin@lumbung.test';
