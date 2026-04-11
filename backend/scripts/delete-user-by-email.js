require('dotenv').config();

const supabase = require('../src/config/supabase');
const { deleteAuthUserByEmail } = require('../src/utils/supabaseAuth');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Usage: node scripts/delete-user-by-email.js <email>');
  }

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!user) {
    console.log(`No public user found for ${email}`);
    return;
  }

  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', user.id);

  if (deleteError) {
    throw deleteError;
  }

  let authDeleted = false;
  try {
    authDeleted = await deleteAuthUserByEmail(email);
  } catch (error) {
    console.error(`Deleted public user but failed to delete auth user for ${email}: ${error.message}`);
  }

  console.log(JSON.stringify({
    deletedUserId: user.id,
    email,
    authDeleted,
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
