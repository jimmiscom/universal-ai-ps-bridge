# ================================================================
# BRIDGE TOOLS - ADVANCED SURGICAL BUILD (Range + Diff)
# ================================================================

# Track backups this session
$script:BackedUpThisSession = @{}

# Only allow one active snapshot at a time
$script:PendingSnapshot = $null

# ----------------------------------------------------------------
# Internal: Get-FileEncoding
# ----------------------------------------------------------------
function Get-FileEncoding {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path) | Select-Object -First 4
    if ($bytes.Count -ge 4 -and $bytes[0] -eq 255 -and $bytes[1] -eq 254 -and $bytes[2] -eq 0 -and $bytes[3] -eq 0) { return [System.Text.Encoding]::UTF32 }
    if ($bytes.Count -ge 2 -and $bytes[0] -eq 254 -and $bytes[1] -eq 255) { return [System.Text.Encoding]::BigEndianUnicode }
    if ($bytes.Count -ge 2 -and $bytes[0] -eq 255 -and $bytes[1] -eq 254) { return [System.Text.Encoding]::Unicode }
    if ($bytes.Count -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { return [System.Text.UTF8Encoding]::new($true) }
    return [System.Text.UTF8Encoding]::new($false)
}

# ----------------------------------------------------------------
# bridge_read - read lines with line numbers and hidden chars
# ----------------------------------------------------------------
function bridge_read {
    param([string]$Path, [int]$Start = 1, [int]$End = 0, [switch]$ShowHidden)
    $fullPath = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $fullPath) { Write-Output "READ ERROR: File not found: $Path"; return }
    $encoding = Get-FileEncoding -Path $fullPath.Path
    $lines = [System.IO.File]::ReadAllLines($fullPath.Path, $encoding)
    $total = $lines.Count
    if ($End -eq 0 -or $End -gt $total) { $End = $total }
    if ($Start -lt 1) { $Start = 1 }
    
    if ($ShowHidden) { Write-Output "LEGEND: [·] = Space | [»] = Tab | [¶] = End of Line" }
    Write-Output "FILE: $Path | LINES: $Start-$End of $total"
    Write-Output "---"
    for ($i = $Start; $i -le $End; $i++) {
        $line = $lines[$i-1]
        if ($ShowHidden) {
            $line = $line.Replace("`t", "»").Replace(" ", "·") + "¶"
        }
        Write-Output ("{0}    {1}" -f $i.ToString().PadLeft(4), $line)
    }
    Write-Output "---"
}

# ----------------------------------------------------------------
# bridge_find - surgical search with context
# ----------------------------------------------------------------
function bridge_find {
    param([string]$Path, [string]$Text, [int]$Before = 2, [int]$After = 2)
    $fullPath = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $fullPath) { Write-Output "FIND ERROR: File not found: $Path"; return }
    $encoding = Get-FileEncoding -Path $fullPath.Path
    $content = [System.IO.File]::ReadAllText($fullPath.Path, $encoding)
    $lines = $content -split "\r?\n"
    
    $cleanUser = ($Text -replace '\s+', ' ').Trim()
    $found = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $cleanFileLine = ($lines[$i] -replace '\s+', ' ').Trim()
        if ($cleanFileLine.Contains($cleanUser)) {
            $found++
            $s = [math]::Max(0, $i - $Before)
            $e = [math]::Min($lines.Count - 1, $i + $After)
            Write-Output "--- MATCH $found at line $($i+1) ---"
            for ($j = $s; $j -le $e; $j++) {
                $m = if ($j -eq $i) { ">>" } else { "  " }
                Write-Output ("{0} {1}    {2}" -f $m, ($j+1).ToString().PadLeft(4), $lines[$j])
            }
        }
    }
    if ($found -eq 0) { Write-Output "FIND: No matches for '$Text' in $Path" }
    else { Write-Output "--- TOTAL: $found match(es) ---" }
}

# ----------------------------------------------------------------
# patch_draft - Prepare a surgical replacement (Line-Assisted)
# ----------------------------------------------------------------
function patch_draft {
    param(
        [Parameter(Mandatory=$true)] [string]$File,
        [string]$Find,
        [string]$StartAnchor,
        [string]$EndAnchor,
        [int]$StartLine = 0,
        [int]$EndLine = 0,
        [Parameter(Mandatory=$true)] [string]$Replace,
        [switch]$Force
    )
    $fullPath = Resolve-Path $File -ErrorAction SilentlyContinue
    if (-not $fullPath) { Write-Output "DRAFT ERROR: File not found."; return }
    
    $enc = Get-FileEncoding -Path $fullPath.Path
    $lines = [System.IO.File]::ReadAllLines($fullPath.Path, $enc)
    $total = $lines.Count

    $startIdx = -1
    $endIdx   = -1
    $matches  = @()

    if ($StartAnchor -and $EndAnchor) {
        # MODE: RANGE
        if ($StartLine -gt 0 -and $EndLine -gt 0) {
            # PRECISE MODE: Verify anchors at specific lines
            if ($StartLine -gt $total -or $EndLine -gt $total) { Write-Output "DRAFT ERROR: Line numbers out of range."; return }
            $fileStart = ($lines[$StartLine-1] -replace '\s+', ' ').Trim()
            $userStart = ($StartAnchor -replace '\s+', ' ').Trim()
            $fileEnd   = ($lines[$EndLine-1] -replace '\s+', ' ').Trim()
            $userEnd   = ($EndAnchor -replace '\s+', ' ').Trim()

            if (-not $fileStart.Contains($userStart)) { Write-Output "DRAFT ERROR: StartAnchor mismatch at line $StartLine."; return }
            if (-not $fileEnd.Contains($userEnd)) { Write-Output "DRAFT ERROR: EndAnchor mismatch at line $EndLine."; return }
            
            $startIdx = $StartLine - 1
            $endIdx   = $EndLine - 1
        } else {
            # DISCOVERY MODE: Search for unique anchors
            $cleanStart = ($StartAnchor -replace '\s+', ' ').Trim()
            $cleanEnd   = ($EndAnchor -replace '\s+', ' ').Trim()
            $startMatches = @(); $endMatches = @()
            for ($i = 0; $i -lt $total; $i++) {
                $cleanLine = ($lines[$i] -replace '\s+', ' ').Trim()
                if ($cleanLine.Contains($cleanStart)) { $startMatches += $i }
                if ($cleanLine.Contains($cleanEnd))   { $endMatches += $i }
            }
            if ($startMatches.Count -eq 1 -and $endMatches.Count -eq 1) {
                $startIdx = $startMatches[0]; $endIdx = $endMatches[0]
            } else {
                Write-Output "DRAFT ERROR: Anchors are not unique (Start: $($startMatches.Count), End: $($endMatches.Count))."
                Write-Output "HINT: Provide -StartLine and -EndLine to specify exactly which occurrence to use."
                return
            }
        }
        if ($endIdx -lt $startIdx) { Write-Output "DRAFT ERROR: End line is before start line."; return }
    } elseif ($Find) {
        # ... (Find mode logic remains same) ...
        # MODE: SURGICAL (String/Line replacement)
        $cleanFind = ($Find -replace '\s+', ' ').Trim()
        for ($i = 0; $i -lt $total; $i++) {
            if (($lines[$i] -replace '\s+', ' ').Trim().Contains($cleanFind)) { $matches += $i }
        }
        if ($matches.Count -eq 1) { $startIdx = $matches[0]; $endIdx = $matches[0] }
        elseif ($matches.Count -gt 1 -and -not $Force) {
            Write-Output "DRAFT BLOCKED: Found $($matches.Count) matches. Use -Force or Anchors."
            return
        } elseif ($matches.Count -eq 0) {
            Write-Output "DRAFT ERROR: Text not found."
            return
        } else {
            # Multi-match force handled by special flag in snapshot
            $startIdx = $matches[0]; $endIdx = $matches[-1] 
        }
    } else {
        Write-Output "DRAFT ERROR: You must provide either -Find or -StartAnchor/-EndAnchor"; return
    }

    # Generate Snapshot ID
    $id = Get-Random -Minimum 1000 -Maximum 9999
    
    # Store snapshot
    $script:PendingSnapshot = @{
        Id = "$id"
        File = $fullPath.Path
        StartLine = $startIdx
        EndLine = $endIdx
        Replace = $Replace
        FindText = $Find
        IsMultiMatch = ($matches.Count -gt 1)
        MatchList = $matches
        Enc = $enc
    }

    Write-Output "STATUS: PENDING (ID: $id)"
    Write-Output "--- DIFF PREVIEW ---"
    if ($StartAnchor) {
        for ($i = $startIdx; $i -le $endIdx; $i++) { Write-Output "- $($i+1): $($lines[$i].Trim())" }
    } else {
        foreach ($m in $matches) { Write-Output "- $($m+1): $($lines[$m].Trim())" }
    }
    Write-Output "REPLACE WITH:"
    $newLines = $Replace -split "\r?\n"
    foreach ($nl in $newLines) { Write-Output "+ $nl" }
    Write-Output "---------------"
    Write-Output "To execute: patch_apply -id $id"
}

# ----------------------------------------------------------------
# patch_apply - Executes the pending draft
# ----------------------------------------------------------------
function patch_apply {
    param([Parameter(Mandatory=$true)] [string]$id)
    
    if ($null -eq $script:PendingSnapshot -or $script:PendingSnapshot.Id -ne $id) {
        Write-Output "APPLY ERROR: Snapshot ID $id not found or expired."
        return
    }
    
    $snap = $script:PendingSnapshot
    $lines = [System.IO.File]::ReadAllLines($snap.File, $snap.Enc)
    
    # Auto-backup
    if (-not $script:BackedUpThisSession.ContainsKey($snap.File)) {
        $backupDir = Join-Path $PSScriptRoot "backups"
        if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
        $fName = Split-Path $snap.File -Leaf
        $ts = Get-Date -Format 'yyyy-MM-dd_HH-mm'
        Copy-Item $snap.File (Join-Path $backupDir "${fName}_${ts}.bak") -Force
        $script:BackedUpThisSession[$snap.File] = $true
        Write-Output "BACKUP CREATED: ${fName}_${ts}.bak"
    }

    $final = @()
    if ($snap.FindText -and $snap.IsMultiMatch) {
        # MULTI-SURGICAL MODE
        $cleanFind = ($snap.FindText -replace '\s+', ' ').Trim()
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if (($lines[$i] -replace '\s+', ' ').Trim().Contains($cleanFind)) { $final += $snap.Replace }
            else { $final += $lines[$i] }
        }
    } else {
        # BLOCK/RANGE MODE
        if ($snap.StartLine -gt 0) { $final += $lines[0..($snap.StartLine - 1)] }
        $final += $snap.Replace -split "\r?\n"
        if ($snap.EndLine -lt ($lines.Count - 1)) { $final += $lines[($snap.EndLine + 1)..($lines.Count - 1)] }
    }
    
    [System.IO.File]::WriteAllLines($snap.File, $final, $snap.Enc)
    $script:PendingSnapshot = $null
    Write-Output "PATCH $id APPLIED SUCCESSFULLY."
}

# ----------------------------------------------------------------
# patch_list / patch_void
# ----------------------------------------------------------------
function patch_list {
    if ($null -eq $script:PendingSnapshot) { Write-Output "No active drafts."; return }
    $s = $script:PendingSnapshot
    Write-Output "ACTIVE SNAPSHOT: $($s.Id) | File: $($s.File) | Range: $($s.StartLine+1)-$($s.EndLine+1)"
}

function patch_void {
    $script:PendingSnapshot = $null
    Write-Output "ALL DRAFTS CLEARED."
}
