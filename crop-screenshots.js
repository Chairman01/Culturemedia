const sharp = require('sharp');
const path = require('path');

async function cropImages() {
    try {
        // Crop Culture Alberta screenshot
        await sharp('public/instagram-culturealberta.png')
            .extract({ left: 0, top: 60, width: 400, height: 800 - 60 })
            .toFile('public/instagram-culturealberta-cropped.png');

        // Replace original with cropped
        const fs = require('fs');
        fs.renameSync('public/instagram-culturealberta-cropped.png', 'public/instagram-culturealberta.png');

        console.log('Culture Alberta screenshot cropped');

        // Crop Culture YYC screenshot
        await sharp('public/instagram-cultureyyc.png')
            .extract({ left: 0, top: 60, width: 400, height: 800 - 60 })
            .toFile('public/instagram-cultureyyc-cropped.png');

        fs.renameSync('public/instagram-cultureyyc-cropped.png', 'public/instagram-cultureyyc.png');

        console.log('Culture YYC screenshot cropped');
        console.log('Done! Status bars removed.');
    } catch (error) {
        console.error('Error:', error);
    }
}

cropImages();
