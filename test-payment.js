const jwt = require('jsonwebtoken');
const { User } = require('./models');

(async () => {
  try {
    // Get test user
    const user = await User.findOne({
      where: { email: 'lisa1757839123@test.com' },
      attributes: ['uuid', 'email']
    });

    if (!user) {
      console.error('Test user not found');
      process.exit(1);
    }

    // console.log('Test user:', user.uuid, user.email);

    // Generate token
    const tokenPayload = {
      uuid: user.uuid,
      email: user.email
    };

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    // console.log('\nGenerated token for testing:');
    // console.log(token);
    // console.log('\nNow testing payment API...\n');

    // Test payment creation
    const axios = require('axios');
    try {
      const response = await axios.post('http://localhost:3000/api/payments/create-order', {
        pdfId: '686c1959-e2da-4028-9776-fd02ce200bc4',
        planType: 'pdf'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // console.log('Payment API Response:');
      // console.log(JSON.stringify(response.data, null, 2));

    } catch (apiError) {
      console.error('Payment API Error:');
      console.error('Status:', apiError.response?.status);
      console.error('Data:', JSON.stringify(apiError.response?.data, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();