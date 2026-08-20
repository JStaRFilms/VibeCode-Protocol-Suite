# Parse YouTube Studio Inspiration HTML
# Extracts topics and their volume indicators from exported HTML
#
# USAGE:
#   1. Go to YouTube Studio → Inspiration → Search your topic
#   2. Right-click on the results section → Inspect
#   3. Find the parent <yta-section> element → Right-click → Copy → Copy outerHTML
#   4. Paste into a .html file
#   5. Run: .\parse_yt_studio.ps1 -InputFile "your_file.html"

param(
    [Parameter(Mandatory=$false)]
    [string]$InputFile = "inspiration.html",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile = "parsed_topics.md"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$htmlPath = if ([System.IO.Path]::IsPathRooted($InputFile)) { $InputFile } else { Join-Path (Get-Location) $InputFile }
$outputPath = if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path (Get-Location) $OutputFile }

if (-not (Test-Path $htmlPath)) {
    Write-Host "Error: File not found: $htmlPath" -ForegroundColor Red
    exit 1
}

Write-Host "Reading HTML file: $htmlPath" -ForegroundColor Cyan
$content = Get-Content $htmlPath -Raw -Encoding UTF8

if ([string]::IsNullOrWhiteSpace($content)) {
    Write-Host "Error: File is empty or could not be read" -ForegroundColor Red
    exit 1
}

# Pattern 1: Extract topic text from <p> tags inside topic cards
$topicPattern = '<p\s+class="style-scope yta-content-inspiration-freeform-topic-card">\s*([^<]+?)\s*</p>'
$topics = [regex]::Matches($content, $topicPattern) | ForEach-Object { $_.Groups[1].Value.Trim() }

# Pattern 2: Extract volume indicators (Low volume, Medium volume, High volume)
$volumePattern = '<div\s+class="additional-label[^"]*">\s*(Low volume|Medium volume|High volume|Content gap)\s*</div>'
$volumes = [regex]::Matches($content, $volumePattern) | ForEach-Object { $_.Groups[1].Value.Trim() }

Write-Host "Found $($topics.Count) topics and $($volumes.Count) volume indicators" -ForegroundColor Green

# Build results - pair topics with volumes
$results = @()
$volumeIndex = 0

for ($i = 0; $i -lt $topics.Count; $i++) {
    $topic = $topics[$i]
    $volume = if ($volumeIndex -lt $volumes.Count) { $volumes[$volumeIndex++] } else { "Unknown" }
    
    $results += [PSCustomObject]@{
        Topic = $topic
        Volume = $volume
    }
}

# Sort by volume priority (High > Medium > Low)
$volumePriority = @{
    "High volume" = 1
    "Medium volume" = 2
    "Content gap" = 3
    "Low volume" = 4
    "Unknown" = 5
}

$sorted = $results | Sort-Object { $volumePriority[$_.Volume] }

# Count by category
$highCount = ($results | Where-Object { $_.Volume -eq "High volume" }).Count
$medCount = ($results | Where-Object { $_.Volume -eq "Medium volume" }).Count
$gapCount = ($results | Where-Object { $_.Volume -eq "Content gap" }).Count
$lowCount = ($results | Where-Object { $_.Volume -eq "Low volume" }).Count

# Generate markdown output
$searchTerm = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
$md = @"
# YouTube Studio Inspiration - $searchTerm
> Parsed from YouTube Studio on $(Get-Date -Format "yyyy-MM-dd HH:mm")

## Summary
- **Total Topics**: $($results.Count)
- **High Volume**: $highCount
- **Medium Volume**: $medCount
- **Content Gap**: $gapCount
- **Low Volume**: $lowCount

---

## 🔥 High & Medium Volume Topics (Priority)

| Topic | Volume |
|-------|--------|
"@

$highMed = $sorted | Where-Object { $_.Volume -in @("High volume", "Medium volume") }
foreach ($item in $highMed) {
    $md += "`n| $($item.Topic) | **$($item.Volume)** |"
}

if ($gapCount -gt 0) {
    $md += @"

---

## 📊 Content Gaps (Opportunity)

| Topic | Volume |
|-------|--------|
"@
    $gaps = $sorted | Where-Object { $_.Volume -eq "Content gap" }
    foreach ($item in $gaps) {
        $md += "`n| $($item.Topic) | $($item.Volume) |"
    }
}

$md += @"

---

## 📉 Low Volume Topics (For Reference)

| Topic | Volume |
|-------|--------|
"@

$low = $sorted | Where-Object { $_.Volume -eq "Low volume" }
foreach ($item in $low) {
    $md += "`n| $($item.Topic) | $($item.Volume) |"
}

# Write output
$md | Out-File $outputPath -Encoding UTF8
Write-Host "`nResults saved to: $outputPath" -ForegroundColor Green

# Display top results
Write-Host "`nTop High/Medium Volume Topics:" -ForegroundColor Yellow
$highMed | Select-Object -First 10 | Format-Table -AutoSize

# Return summary for scripting
return @{
    TotalTopics = $results.Count
    HighVolume = $highCount
    MediumVolume = $medCount
    ContentGap = $gapCount
    LowVolume = $lowCount
    OutputFile = $outputPath
}
