-- SCRIPT DE CORREÇÃO: Funções Administrativas de Usuário (Criar, Alterar Senha, Deletar)
-- Esse script garante que o seu aplicativo tenha as rotinas (RPC) necessárias 
-- para gerenciar a equipe diretamente pelo painel.

-- 1. Admin function to create a new user
CREATE OR REPLACE FUNCTION admin_create_user(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role TEXT,
  user_position TEXT,
  user_phone TEXT
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', user_full_name, 'role', user_role),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    position,
    phone,
    is_active,
    password_record
  )
  VALUES (
    new_user_id,
    user_email,
    user_role,
    user_full_name,
    user_position,
    user_phone,
    TRUE,
    user_password
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Admin function to update user password
CREATE OR REPLACE FUNCTION admin_update_user_password(target_user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  -- Update the password in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  -- Also update the password_record in profiles for visibility
  UPDATE profiles
  SET password_record = new_password
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Admin function to delete a user
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete from profiles
  DELETE FROM public.profiles WHERE id = target_user_id;
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar cache do Supabase para ele encontrar as funções!
NOTIFY pgrst, 'reload schema';
