const fs = require('fs');
const { createCanvas } = require('canvas');

function drawCMFavicon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, size, size);

    // Draw GREY circle
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.48;

    ctx.fillStyle = '#808080'; // Grey background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw white "CM" letters SIDE BY SIDE
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSize = size * 0.32;
    ctx.font = `900 ${fontSize}px Arial`;

    // Position letters horizontally side by side
    const letterSpacing = size * 0.15;

    ctx.fillText('C', centerX - letterSpacing, centerY);
    ctx.fillText('M', centerX + letterSpacing, centerY);

    return canvas;
}

// Generate all three favicon files
console.log('Generating CM favicons...');

// icon.png (512x512)
const icon512 = drawCMFavicon(512);
const buffer512 = icon512.toBuffer('image/png');
fs.writeFileSync('../public/icon.png', buffer512);
console.log('✓ Created icon.png (512x512)');

// apple-icon.png (180x180)
const icon180 = drawCMFavicon(180);
const buffer180 = icon180.toBuffer('image/png');
fs.writeFileSync('../public/apple-icon.png', buffer180);
console.log('✓ Created apple-icon.png (180x180)');

// favicon.ico (32x32) - save as PNG, browsers will handle it
const icon32 = drawCMFavicon(32);
const buffer32 = icon32.toBuffer('image/png');
fs.writeFileSync('../public/favicon.ico', buffer32);
console.log('✓ Created favicon.ico (32x32)');

console.log('\n✅ All favicon files created in public/ directory!');
console.log('Restart your dev server to see the changes.');
