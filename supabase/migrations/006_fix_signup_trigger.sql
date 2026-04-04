-- Migration 006: Fix f11_handle_new_user trigger
-- Handles username uniqueness conflicts and permission issues.
-- Run this in Supabase SQL Editor.

-- Grant necessary permissions so the trigger can write to public tables
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Replace the trigger function with a more robust version
CREATE OR REPLACE FUNCTION f11_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_suffix   int := 0;
BEGIN
  -- Derive base username from metadata or email local part
  v_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  -- Sanitize: lowercase, only alphanumeric + underscore
  v_username := regexp_replace(lower(v_username), '[^a-z0-9_]', '', 'g');
  -- Ensure minimum length
  IF length(v_username) < 3 THEN
    v_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  -- Handle username uniqueness: append suffix until unique
  LOOP
    BEGIN
      INSERT INTO f11_profiles (id, username, display_name, wallet_balance)
      VALUES (
        NEW.id,
        CASE WHEN v_suffix = 0 THEN v_username ELSE v_username || v_suffix::text END,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), v_username),
        10000.00
      );
      EXIT; -- success, exit loop
    EXCEPTION WHEN unique_violation THEN
      v_suffix := v_suffix + 1;
      IF v_suffix > 99 THEN
        -- Fallback: use part of UUID
        v_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
        v_suffix := 0;
      END IF;
    END;
  END LOOP;

  -- Log signup bonus transaction
  INSERT INTO f11_transactions (user_id, type, amount, reason, balance_after)
  VALUES (NEW.id, 'credit', 10000.00, 'Signup bonus', 10000.00);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Last resort: don't block auth even if profile creation fails
  RAISE WARNING 'f11_handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger (drop first in case it already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE f11_handle_new_user();
