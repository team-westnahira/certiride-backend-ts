import { chromium } from 'playwright';
import fs from 'fs';


export const generatePDF = async (htmlPath: string) => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await page.pdf({ path: 'output.pdf', format: 'A4' });
    await browser.close();
}