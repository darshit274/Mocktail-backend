// const bcrypt = require('bcryptjs');
import bcrypt from "bcryptjs"
const hashedPassword = await bcrypt.hash('mocktale.academy@admin.com', 10);

// console.log(hashedPassword);
