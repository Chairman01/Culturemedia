# PowerShell script to create CM favicon files
# This creates simple grey circle PNG files with CM text

$publicPath = "c:\Users\Admin\Documents\culture-media-agency\public"

Write-Host "Creating CM favicons in public folder..." -ForegroundColor Cyan

# We'll create the files by copying and renaming existing files
# Since PowerShell can't easily create PNGs, let's use the HTML canvas approach differently

Write-Host "`nOpening browser to generate and save favicons..." -ForegroundColor Yellow
Start-Process "file:///c:/Users/Admin/Documents/culture-media-agency/create-cm-favicon.html"

Write-Host "`nInstructions:" -ForegroundColor Green
Write-Host "1. The favicon generator page is now open in your browser"
Write-Host "2. RIGHT-CLICK on each favicon image (the grey circles with CM)"
Write-Host "3. Select 'Save Image As...'"
Write-Host "4. Save each one to: $publicPath"
Write-Host "   - Save the large one as: icon.png"
Write-Host "   - Save the medium one as: apple-icon.png"  
Write-Host "   - Save the small one as: favicon.ico"
Write-Host "`nPress any key when done..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
