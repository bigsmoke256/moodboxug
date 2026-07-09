
DO $$
DECLARE
  new_id uuid := gen_random_uuid();
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE email = 'admin@moodbox.ug';
  IF existing_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      'admin@moodbox.ug', crypt('MoodBoxAdmin2026!', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('full_name','Mood Box Admin'),
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_id::text, new_id,
      jsonb_build_object('sub', new_id::text, 'email', 'admin@moodbox.ug', 'email_verified', true),
      'email', now(), now(), now());
    existing_id := new_id;
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (existing_id, 'Mood Box Admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (existing_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
