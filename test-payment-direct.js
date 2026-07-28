const { Pdfs, User, Subscription } = require('./models');
const { v4: uuidv4 } = require('uuid');

(async () => {
  try {
    // console.log('🚀 Testing payment creation directly...');

    // Get PDF data
    const pdf = await Pdfs.findOne({
      where: { id: '686c1959-e2da-4028-9776-fd02ce200bc4' },
      attributes: ['id', 'title', 'access_level', 'price', 'currency', 'is_free', 'discount_percentage']
    });

    // console.log('📄 PDF Data:', JSON.stringify(pdf ? pdf.toJSON() : null, null, 2));

    if (!pdf) {
      console.error('❌ PDF not found');
      process.exit(1);
    }

    // Get user data
    const user = await User.findOne({
      where: { email: 'lisa1757839123@test.com' },
      attributes: ['uuid', 'email']
    });

    // console.log('👤 User:', user ? user.uuid : 'Not found');

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    // Calculate amount like the API does
    const basePrice = parseFloat(pdf.price || 0);
    const discountPercentage = parseFloat(pdf.discount_percentage || 0);
    const discountedPrice = discountPercentage > 0
      ? basePrice * (1 - discountPercentage / 100)
      : basePrice;
    const amount = Math.round(discountedPrice * 100); // Convert to paise

    // console.log('💰 Payment calculation:', {
//       basePrice,
//       discountPercentage,
//       discountedPrice,
//       amountInPaise: amount,
//       amountInRupees: amount / 100
//     });

    // Test subscription creation
    // console.log('🔄 Creating test subscription record...');

    const subscriptionData = {
      id: uuidv4(),
      user_id: user.uuid,
      test_series_id: null, // This should now be allowed
      transaction_id: 'test_order_' + Date.now(),
      payment_method: 'razorpay',
      amount_paid: amount / 100,
      currency: 'INR',
      status: 'pending',
      purchase_date: new Date(),
      expiry_date: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)),
      metadata: JSON.stringify({
        plan_type: 'pdf',
        pdf_id: pdf.id,
        test_mode: true
      })
    };

    const subscription = await Subscription.create(subscriptionData);
    // console.log('✅ Subscription created successfully:', subscription.id);

    // Cleanup - delete test subscription
    await subscription.destroy();
    // console.log('🧹 Test subscription cleaned up');

    // console.log('🎉 Payment flow test PASSED! All database operations work correctly.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error in payment test:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
})();