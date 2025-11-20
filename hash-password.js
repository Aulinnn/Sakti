// hash-password.js
import bcrypt from 'bcryptjs';

const plain = process.argv[2];

if (!plain) {
  console.log('Usage: node hash-password.js <plain_password>');
  process.exit(1);
}

const saltRounds = 10;

bcrypt.hash(plain, saltRounds).then((hash) => {
  console.log('Plain :', plain);
  console.log('Hash  :', hash);
  process.exit(0);
});
