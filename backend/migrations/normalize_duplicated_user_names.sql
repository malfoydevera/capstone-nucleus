update public.users
set
  middle_name = null,
  last_name = btrim(substr(last_name, char_length(first_name) + 2)),
  full_name = btrim(first_name || ' ' || btrim(substr(last_name, char_length(first_name) + 2))),
  updated_at = now()
where middle_name is not null
  and middle_name = last_name
  and char_length(last_name) > char_length(first_name)
  and left(last_name, char_length(first_name) + 1) = first_name || ' ';

update public.users
set
  middle_name = null,
  last_name = '',
  full_name = first_name,
  updated_at = now()
where coalesce(middle_name, '') = first_name
  and last_name = first_name
  and full_name = trim(concat_ws(' ', first_name, middle_name, last_name));
