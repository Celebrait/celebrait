import 'dotenv/config';
import { birthdayProfile } from '../routes/admin-card-lab';
for (const a of [3, 5, 12, 13, 16, 17, 18, 21, 25, 26, 30, 40, 49, 50, 60, 65, 66, 70, 76, 80]) {
  const line = birthdayProfile('funny', a).brief.split('\n').filter((l) => l.startsWith('AGE BAND'))[0] ?? 'NONE';
  console.log(String(a).padStart(3) + '  ' + line.slice(11, 62));
}
