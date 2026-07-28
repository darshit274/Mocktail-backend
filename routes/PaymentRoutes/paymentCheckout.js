const express = require('express');
const router = express.Router();

// Payment checkout page
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      keyId, 
      amount, 
      currency = 'INR', 
      name = 'MockTale', 
      description, 
      itemName,
      itemPrice,
      subscriptionId 
    } = req.query;

    if (!orderId || !keyId || !amount || !subscriptionId) {
      return res.status(400).send(`
        <html>
          <head><title>Payment Error</title></head>
          <body>
            <h1>Payment Error</h1>
            <p>Missing required parameters for payment checkout.</p>
            <button onclick="window.close()">Close</button>
          </body>
        </html>
      `);
    }

    // Create HTML using proper string concatenation to avoid template literal issues
    const checkoutHTML = `<!DOCTYPE html>
<html>
<head>
  <title>MockTale Payment</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .payment-container { 
      background: white;
      max-width: 400px; 
      width: 100%;
      padding: 40px; 
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      text-align: center;
    }
    .logo {
      width: 80px;
      height: 80px;
      background: #0A1F66;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    h2 { 
      color: #333; 
      margin-bottom: 10px; 
      font-size: 24px;
    }
    .item-name {
      color: #666;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .amount {
      font-size: 32px;
      font-weight: bold;
      color: #0A1F66;
      margin: 20px 0;
    }
    .payment-button { 
      background: linear-gradient(135deg, #0A1F66 0%, #1e40af 100%);
      color: white; 
      border: none; 
      padding: 16px 40px; 
      border-radius: 50px; 
      font-size: 18px; 
      font-weight: 600;
      cursor: pointer; 
      margin-top: 20px; 
      transition: transform 0.2s, box-shadow 0.2s;
      width: 100%;
    }
    .payment-button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(10, 31, 102, 0.3);
    }
    .payment-button:active {
      transform: translateY(0);
    }
    .secure-text {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .loading {
      display: none;
      color: #666;
    }
    .spinner {
      border: 2px solid #f3f3f3;
      border-top: 2px solid #0A1F66;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error {
      color: #e74c3c;
      background: #ffeaea;
      padding: 15px;
      border-radius: 10px;
      margin-top: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="payment-container">
    <div class="logo">MT</div>
    <h2>Complete Payment</h2>
    <div class="item-name">` + (itemName || description || 'Test Series Subscription') + `</div>
    <div class="amount">₹` + (itemPrice || (amount / 100)) + `</div>
    
    <button class="payment-button" onclick="startPayment()" id="payButton">
      🔒 Pay Securely with Razorpay
    </button>
    
    <div class="loading" id="loading">
      <div class="spinner"></div>
      Processing payment...
    </div>
    
    <div class="error" id="error"></div>
    
    <div class="secure-text">
      🔐 Secured by Razorpay • Your data is encrypted
    </div>
  </div>
  
  <script>
    function showLoading() {
      document.getElementById('payButton').style.display = 'none';
      document.getElementById('loading').style.display = 'block';
    }
    
    function hideLoading() {
      document.getElementById('payButton').style.display = 'block';
      document.getElementById('loading').style.display = 'none';
    }
    
    function showError(message) {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      hideLoading();
    }
    
    function startPayment() {
      showLoading();
      
      const options = {
        key: '` + keyId + `',
        amount: ` + amount + `,
        currency: '` + currency + `',
        name: '` + name + `',
        description: '` + (description || ('Payment for ' + (itemName || 'Test Series'))) + `',
        order_id: '` + orderId + `',
        image: 'https://i.imgur.com/3g7nmJC.png',
        prefill: {
          name: 'User',
          email: 'user@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#0A1F66'
        },
        handler: function (response) {
          // console.log('Payment successful:', response);
          
          document.body.innerHTML = '<div class="payment-container" style="text-align: center; padding: 40px;"><div style="color: #27ae60; font-size: 64px; margin-bottom: 20px;">✅</div><h2 style="color: #27ae60; margin-bottom: 16px;">Payment Successful!</h2><p style="color: #666; margin-bottom: 20px;">Your payment has been processed successfully.</p><div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 8px 0;"><strong>Payment ID:</strong> ' + response.razorpay_payment_id + '</p><p style="margin: 8px 0;"><strong>Order ID:</strong> ' + response.razorpay_order_id + '</p></div><p style="color: #999; font-size: 14px;">You can now close this window and return to the app.</p></div>';
          
          window.history.pushState({}, '', window.location.origin + '/payment-success?payment_id=' + response.razorpay_payment_id + '&order_id=' + response.razorpay_order_id + '&signature=' + response.razorpay_signature);
          
          setTimeout(() => {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: {
                  payment_id: response.razorpay_payment_id,
                  order_id: response.razorpay_order_id,
                  signature: response.razorpay_signature
                }
              }));
            }
          }, 1500);
        },
        modal: {
          ondismiss: function() {
            hideLoading();
            // console.log('Payment modal dismissed');
          }
        }
      };
      
      try {
        const rzp = new Razorpay(options);
        
        rzp.on('payment.failed', function (response) {
          // console.log('Payment failed:', response);
          hideLoading();
          showError('Payment failed: ' + response.error.description);
        });
        
        rzp.open();
      } catch (error) {
        console.error('Error opening Razorpay:', error);
        hideLoading();
        showError('Unable to open payment gateway. Please try again.');
      }
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(checkoutHTML);

  } catch (error) {
    console.error('Error serving checkout page:', error);
    res.status(500).send(`
      <html>
        <head><title>Payment Error</title></head>
        <body>
          <h1>Payment Error</h1>
          <p>Unable to load payment checkout. Please try again.</p>
          <button onclick="window.close()">Close</button>
        </body>
      </html>
    `);
  }
});

module.exports = router;