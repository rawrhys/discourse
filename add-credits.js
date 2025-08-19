import axios from 'axios';

const updateUserCredits = async () => {
  try {
    const response = await axios.post('https://thediscourse.ai/api/debug/add-credits', {
      email: 'rhys.higgs@outlook.com',
      credits: 10
    });
    console.log('Successfully updated credits:', response.data);
  } catch (error) {
    console.error('Error updating credits:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Data:', error.response.data);
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.error('Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error', error.message);
    }
    console.error('Config:', error.config);
  }
};

updateUserCredits(); 