const axios = require('axios');

class KarzaService {
  constructor() {
    this.apiKey = process.env.KARZA_API_KEY;
    this.baseUrl = 'https://api.karza.in/v3';
  }

  async verifyPAN(panNumber) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/pan`,
        { pan: panNumber },
        { headers: { 'x-karza-key': this.apiKey } }
      );
      
      return {
        success: response.data.status === 'VALID',
        data: response.data
      };
    } catch (error) {
      console.error('PAN verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify PAN');
    }
  }

  async verifyAadhaar(aadhaarNumber) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/aadhaar`,
        { aadhaarNumber },
        { headers: { 'x-karza-key': this.apiKey } }
      );
      
      return {
        success: response.data.valid,
        data: response.data
      };
    } catch (error) {
      console.error('Aadhaar verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify Aadhaar');
    }
  }

  async verifyDrivingLicense(dlNumber) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/dl`,
        { dlNumber },
        { headers: { 'x-karza-key': this.apiKey } }
      );
      
      return {
        success: response.data.valid,
        data: response.data
      };
    } catch (error) {
      console.error('DL verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify Driving License');
    }
  }
}

module.exports = new KarzaService();