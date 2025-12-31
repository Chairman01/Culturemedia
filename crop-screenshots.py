from PIL import Image

# Crop Culture Alberta Instagram screenshot
img1 = Image.open(r'c:\Users\Admin\Documents\culture-media-agency\public\instagram-culturealberta.png')
# Remove top 60 pixels (status bar)
cropped1 = img1.crop((0, 60, img1.width, img1.height))
cropped1.save(r'c:\Users\Admin\Documents\culture-media-agency\public\instagram-culturealberta.png')
print("Culture Alberta screenshot cropped")

# Crop Culture YYC Instagram screenshot
img2 = Image.open(r'c:\Users\Admin\Documents\culture-media-agency\public\instagram-cultureyyc.png')
# Remove top 60 pixels (status bar)
cropped2 = img2.crop((0, 60, img2.width, img2.height))
cropped2.save(r'c:\Users\Admin\Documents\culture-media-agency\public\instagram-cultureyyc.png')
print("Culture YYC screenshot cropped")
