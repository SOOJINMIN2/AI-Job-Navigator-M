
const { generateText } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');

async function testModel(modelName) {
    try {
        const fs = require('fs');
        const env = fs.readFileSync('.env.local', 'utf8');
        const key = env.split('\n').find(l => l.startsWith('GOOGLE_GENERATIVE_AI_API_KEY')).split('=')[1].trim();
        const google = createGoogleGenerativeAI({
            apiKey: key
        });
        console.log(`Testing model: ${modelName}`);
        const { text } = await generateText({
            model: google(modelName),
            prompt: 'say hi',
        });
        console.log(`Success with ${modelName}:`, text);
    } catch (e) {
        console.error(`Error with ${modelName}:`, e.message);
    }
}

async function run() {
    await testModel('gemini-2.5-flash');
    await testModel('gemini-1.5-pro');
    await testModel('gemini-1.5-flash');
    await testModel('gemini-1.5-flash-latest');
    await testModel('gemini-2.0-flash');
    await testModel('models/gemini-1.5-pro');
}

run();
