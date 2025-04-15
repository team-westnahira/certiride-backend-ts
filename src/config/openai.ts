import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.MY_OPENAI_API_KEY });
export default client