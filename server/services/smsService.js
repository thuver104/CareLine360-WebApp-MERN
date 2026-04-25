const https = require("https");
const querystring = require("querystring");

/**
 * Send an SMS via SMSLenz API
 * https://smslenz.lk/api/send-sms
 *
 * Required ENV vars:
 *   SMSLENZ_USER_ID   – User ID from your SMSLenz settings page
 *   SMSLENZ_API_KEY   – API key from your SMSLenz settings page
 *   SMSLENZ_SENDER_ID – Your approved Sender ID (use "SMSlenzDEMO" for testing, case-sensitive)
 */
const sendSMS = async ({ to, message }) => {
  const userId = process.env.SMSLENZ_USER_ID;
  const apiKey = process.env.SMSLENZ_API_KEY;
  const senderId = process.env.SMSLENZ_SENDER_ID || "SMSlenzDEMO";

  if (!userId || !apiKey) {
    console.error(
      "SMSLENZ_USER_ID or SMSLENZ_API_KEY not configured – SMS not sent",
    );
    return { success: false, error: "SMS not configured" };
  }

  if (!to) {
    console.error("No phone number provided – SMS not sent");
    return { success: false, error: "No phone number" };
  }

  // Normalize Sri Lankan numbers: ensure +94 prefix
  let phone = to.replace(/\s+/g, "");
  if (phone.startsWith("0")) {
    phone = "+94" + phone.slice(1);
  } else if (phone.startsWith("94") && !phone.startsWith("+")) {
    phone = "+" + phone;
  } else if (!phone.startsWith("+")) {
    phone = "+94" + phone;
  }

  // Truncate message to 1500 chars (SMSLenz limit)
  const smsMessage = message.slice(0, 1500);

  const payload = {
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    contact: phone,
    message: smsMessage,
  };

  try {
    const response = await fetch("https://app.smslenz.lk/api/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        // Adding User-Agent as some APIs block standard serverless/node requests
        "User-Agent": "CareLine360/1.0"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.success || response.ok) {
      console.log(
        `SMS sent to ${phone} | campaign: ${data.data?.campaign_id} | balance: ${data.data?.sms_credit_balance}`
      );
      return { success: true, data: data.data || data };
    } else {
      console.error(`SMSLenz error:`, data.message || data);
      return { success: false, error: data.message || JSON.stringify(data) };
    }
  } catch (err) {
    console.error("SMSLenz request error:", err.message);
    
    // Fallback to old domain if app.smslenz.lk fails
    try {
      const fallbackResponse = await fetch("https://smslenz.lk/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CareLine360/1.0" },
        body: JSON.stringify(payload)
      });
      const data = await fallbackResponse.json();
      if (data.success || fallbackResponse.ok) {
        return { success: true, data: data.data || data };
      }
      return { success: false, error: data.message || JSON.stringify(data) };
    } catch (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }
  }
};

/**
 * Send bulk SMS to multiple contacts
 * https://smslenz.lk/api/send-bulk-sms
 */
const sendBulkSMS = async ({ contacts, message }) => {
  const userId = process.env.SMSLENZ_USER_ID;
  const apiKey = process.env.SMSLENZ_API_KEY;
  const senderId = process.env.SMSLENZ_SENDER_ID || "SMSlenzDEMO";

  if (!userId || !apiKey) {
    console.error("SMSLENZ_USER_ID or SMSLENZ_API_KEY not configured");
    return { success: false, error: "SMS not configured" };
  }

  if (!contacts?.length) {
    return { success: false, error: "No contacts provided" };
  }

  // Normalize all numbers
  const normalized = contacts.map((n) => {
    let phone = n.replace(/\s+/g, "");
    if (phone.startsWith("0")) phone = "+94" + phone.slice(1);
    else if (phone.startsWith("94") && !phone.startsWith("+"))
      phone = "+" + phone;
    else if (!phone.startsWith("+")) phone = "+94" + phone;
    return phone;
  });

  const payload = {
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    contacts: normalized,
    message: message.slice(0, 1500),
  };

  try {
    const response = await fetch("https://app.smslenz.lk/api/send-bulk-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "CareLine360/1.0"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.success || response.ok) {
      console.log(
        `Bulk SMS sent to ${normalized.length} contacts | balance: ${data.data?.sms_credit_balance}`
      );
      return { success: true, data: data.data || data };
    } else {
      console.error("SMSLenz bulk error:", data.message || data);
      return { success: false, error: data.message || JSON.stringify(data) };
    }
  } catch (err) {
    try {
      const fallbackResponse = await fetch("https://smslenz.lk/api/send-bulk-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "CareLine360/1.0" },
        body: JSON.stringify(payload)
      });
      const data = await fallbackResponse.json();
      if (data.success || fallbackResponse.ok) {
        return { success: true, data: data.data || data };
      }
      return { success: false, error: data.message || JSON.stringify(data) };
    } catch (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }
  }
};

/**
 * Check SMSLenz account status & credit balance
 * https://smslenz.lk/api/account-status
 */
const getAccountStatus = async () => {
  const userId = process.env.SMSLENZ_USER_ID;
  const apiKey = process.env.SMSLENZ_API_KEY;

  if (!userId || !apiKey) {
    return { success: false, error: "SMS not configured" };
  }

  const qs = querystring.stringify({ user_id: userId, api_key: apiKey });

  try {
    const response = await fetch(`https://app.smslenz.lk/api/account-status?${qs}`, {
      headers: { "Accept": "application/json", "User-Agent": "CareLine360/1.0" }
    });
    const data = await response.json();
    if (data.success || response.ok) {
      return { success: true, data: data.data || data };
    }
    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err) {
    try {
      const fallbackResponse = await fetch(`https://smslenz.lk/api/account-status?${qs}`, {
        headers: { "Accept": "application/json", "User-Agent": "CareLine360/1.0" }
      });
      const data = await fallbackResponse.json();
      return (data.success || fallbackResponse.ok)
        ? { success: true, data: data.data || data }
        : { success: false, error: data.message || JSON.stringify(data) };
    } catch (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }
  }
};

module.exports = { sendSMS, sendBulkSMS, getAccountStatus };
