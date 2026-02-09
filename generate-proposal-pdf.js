const puppeteer = require('puppeteer');
const path = require('path');

async function generatePDF() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport to a wide format for better PDF rendering
    await page.setViewport({ width: 1200, height: 800 });

    console.log('Navigating to proposal page...');
    await page.goto('https://www.culturemedia.ca/tutti-frutti-proposal', {
        waitUntil: 'networkidle0',
        timeout: 60000
    });

    // Wait for any animations to complete
    console.log('Waiting for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate PDF
    const outputPath = path.join(__dirname, 'Tutti_Frutti_Proposal.pdf');
    console.log('Generating PDF...');

    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        scale: 0.8,
        displayHeaderFooter: false
    });

    console.log(`PDF saved to: ${outputPath}`);

    await browser.close();
    console.log('Done!');
}

generatePDF().catch(console.error);
