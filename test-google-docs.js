const fs = require('fs');
const { google } = require('googleapis');

async function run() {
    const env = fs.readFileSync('.env.local', 'utf8');
    let email = '';
    let key = '';
    env.split('\n').forEach(line => {
        if (line.startsWith('GOOGLE_CLIENT_EMAIL=')) email = line.split('=')[1].trim();
        if (line.startsWith('GOOGLE_PRIVATE_KEY=')) {
            key = line.substring(line.indexOf('=') + 1).trim();
            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.slice(1, -1);
            }
            key = key.replace(/\\n/g, '\n');
        }
    });

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: email,
                private_key: key,
            },
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const drive = google.drive({ version: 'v3', auth });
        console.log('Attempting to create file via Drive API...');
        const createResponse = await drive.files.create({
            requestBody: {
                name: `Test Document 4`,
                mimeType: 'application/vnd.google-apps.document',
            },
        });
        console.log('Success via Drive:', createResponse.data.id);
    } catch (e) {
        console.error('Error Details from Drive API:');
        if (e.response && e.response.data) {
            console.error(JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

run();
