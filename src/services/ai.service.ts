import gooseAPI from '../config/gooseai'

export const makeGooseAIRequest = async () => {
  try {
    
    const response = await gooseAPI.post('/engines/gpt-j-6b/completions', {
        "prompt": "What is the miranda warning in us law?",
        "max_tokens": 100
    });

    return response.data.choices[0].text;

  } catch (error) {
    console.error('Error connecting to GooseAI:', error);
  }
};