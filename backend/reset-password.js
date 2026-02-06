require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('./src/config/supabase');

async function resetPassword() {
  const email = 'elmer@faculty.com';
  const newPassword = 'faculty123';

  try {
    console.log('🔄 Resetting password for:', email);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed successfully');

    // Update in database
    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email)
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log('✅ Password reset successful!');
      console.log('\n📧 Email:', email);
      console.log('🔑 New Password:', newPassword);
      console.log('\nYou can now login with these credentials.');
    } else {
      console.log('❌ User not found with email:', email);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  process.exit(0);
}

resetPassword();
