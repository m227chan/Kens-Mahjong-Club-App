-- Keep the built-in universal club aligned with the application brand.
update clubs
set name = 'Mahjong Messiah Score Tracker'
where id = 'KEN'
  and universal = true
  and name is distinct from 'Mahjong Messiah Score Tracker';
