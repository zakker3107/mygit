# update-pr.ps1
# Update PR with labels, reviewers, title and body

$owner = "zakker3107"
$repo  = "mygit"
$prNumber = $null
$branchName = "chore/deps-eslint"
$reviewers = @("zakker3107","alice","bob")
$labelsToAdd = @("chore","dependencies","eslint","tests")
$defaultLabelColor = "FFB86C"
$defaultLabelDesc = "Auto-created label for lint/deps changes"
$newTitle = "chore(deps): upgrade dev dependencies and apply ESLint (AirBnB + React)"

# Get token from environment
$token = $env:GITHUB_TOKEN
if (-not $token -or $token -eq "") {
  Write-Host "Please set GITHUB_TOKEN environment variable first."
  Write-Host 'Example: $env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxx"'
  exit 1
}

$headers = @{
  Authorization = "token $token"
  "User-Agent"  = $owner
  "Accept"      = "application/vnd.github+json"
}

# Helper function to find PR by branch
function Get-PrNumberByBranch {
  param($owner,$repo,$branch)
  $encodedHead = [uri]::EscapeDataString("$owner`:$branch")
  $url = "https://api.github.com/repos/$owner/$repo/pulls?head=$encodedHead"
  try {
    $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
    if ($res -and $res.Count -gt 0) {
      return $res[0].number
    }
  } catch {
    Write-Error "Error querying PR by branch: $($_.Exception.Message)"
  }
  return $null
}

# Find PR number if not specified
if (-not $prNumber) {
  Write-Host "Searching for PR by branch: $branchName"
  $found = Get-PrNumberByBranch -owner $owner -repo $repo -branch $branchName
  if ($found) {
    $prNumber = $found
    Write-Host "Found PR number: $prNumber"
  } else {
    Write-Error "PR not found for branch: $branchName"
    exit 1
  }
}

# Step 1: Ensure labels exist (create if not found)
foreach ($label in $labelsToAdd) {
  $encLabel = [uri]::EscapeDataString($label)
  $getLabelUrl = "https://api.github.com/repos/$owner/$repo/labels/$encLabel"
  try {
    $existing = Invoke-RestMethod -Uri $getLabelUrl -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "Label already exists: $label"
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.Value__ } catch {}
    if ($status -eq 404) {
      Write-Host "Creating label: $label"
      $labelBody = @{ name = $label; color = $defaultLabelColor; description = $defaultLabelDesc } | ConvertTo-Json
      $createUrl = "https://api.github.com/repos/$owner/$repo/labels"
      try {
        $created = Invoke-RestMethod -Uri $createUrl -Headers $headers -Method Post -ContentType "application/json" -Body $labelBody
        Write-Host "Label created: $($created.name)"
      } catch {
        Write-Error "Failed to create label: $($_.Exception.Message)"
        exit 1
      }
    } else {
      Write-Error "Error checking label: $($_.Exception.Message)"
      exit 1
    }
  }
}

# Step 2: Add labels to PR (PR is also an issue)
$labelsJson = $labelsToAdd | ConvertTo-Json
$labelsUrl = "https://api.github.com/repos/$owner/$repo/issues/$prNumber/labels"
try {
  $resLabels = Invoke-RestMethod -Uri $labelsUrl -Headers $headers -Method Post -ContentType "application/json" -Body $labelsJson
  $labelNames = $resLabels.name -join ", "
  Write-Host "Added labels to PR #$prNumber : $labelNames"
} catch {
  Write-Error "Failed to add labels: $($_.Exception.Message)"
  exit 1
}

# Step 3: Request reviewers
$reviewersBody = @{ reviewers = $reviewers } | ConvertTo-Json
$reviewersUrl = "https://api.github.com/repos/$owner/$repo/pulls/$prNumber/requested_reviewers"
try {
  $resReview = Invoke-RestMethod -Uri $reviewersUrl -Headers $headers -Method Post -ContentType "application/json" -Body $reviewersBody
  if ($resReview.requested_reviewers) {
    $reviewerLogins = $resReview.requested_reviewers | ForEach-Object { $_.login } | Sort-Object -Unique
    Write-Host "Requested reviewers: $($reviewerLogins -join ', ')"
  } else {
    Write-Host "Reviewers request completed."
  }
} catch {
  Write-Error "Failed to request reviewers: $($_.Exception.Message)"
  exit 1
}

# Step 4: Update PR title
$patchTitleBody = @{ title = $newTitle } | ConvertTo-Json
$patchUrlTitle = "https://api.github.com/repos/$owner/$repo/pulls/$prNumber"
try {
  $patchedTitle = Invoke-RestMethod -Uri $patchUrlTitle -Headers $headers -Method Patch -ContentType "application/json" -Body $patchTitleBody
  Write-Host "Updated PR title: $($patchedTitle.title)"
} catch {
  Write-Error "Failed to update PR title: $($_.Exception.Message)"
  exit 1
}

# Step 5: Update PR body
$newBody = @"
### Summary
Maintenance work on the repository:
- Upgraded dev dependencies (Jest, ESLint and plugins) with npm-check-updates
- Applied ESLint AirBnB ruleset (including React rules) and configured .eslintrc.json
- Installed react and react-dom to satisfy lint plugin peer dependencies
- Restructured and added minimal test example: src/add.js and __tests__/add.test.js (Jest)

### What I changed
- Updated package.json (upgraded devDependencies, added lint/test scripts)
- Created/updated .eslintrc.json (AirBnB + React)
- Added src/add.js, __tests__/add.test.js
- Added README.md (with PowerShell npm.ps1 workarounds)
- Ran npx npm-check-updates -u, npm install, npm dedupe, npm prune
- Fixed peer dependency conflicts (pinned ESLint to v8.x to preserve .eslintrc.json format)

### Verification
Locally verified:
- npm install (completed successfully)
- npm test → Jest all tests passed
- npm run lint → ESLint passed (auto-fixed AirBnB issues)
- npm audit → No known vulnerabilities

### Suggested reviewers
- @zakker3107
- @alice

### Suggested labels
- chore, dependencies, eslint
"@

$patchBody = @{ body = $newBody } | ConvertTo-Json
try {
  $patched = Invoke-RestMethod -Uri $patchUrlTitle -Headers $headers -Method Patch -ContentType "application/json" -Body $patchBody
  Write-Host "Updated PR body for PR #$prNumber"
} catch {
  Write-Error "Failed to update PR body: $($_.Exception.Message)"
  exit 1
}

Write-Host "Success: labels, reviewers, PR title and body updated for PR #$prNumber."
